import { z } from "zod"

// JSON integers outside Number's safe range are revived as bigint; fields declared int64()
// always normalize to bigint; every other number stays a number. pgmq message ids and kiroku
// and keiro positions are int64 and may exceed 2^53, which JSON.parse alone would round.

export type Int64 = bigint & { readonly __brand: "Int64" }

type SourceReviver = (key: string, value: unknown, context?: { source?: string }) => unknown
const parseWithSource = JSON.parse as (text: string, reviver: SourceReviver) => unknown

function detectJsonSource(): boolean {
  let supported = false
  try {
    parseWithSource("1", (_key, value, context) => {
      supported = context !== undefined && typeof context.source === "string"
      return value
    })
  } catch {
    supported = false
  }
  return supported
}

/** Whether this runtime passes the literal source text to JSON.parse revivers (ES2025). */
export const supportsJsonSource: boolean = detectJsonSource()

let useJsonSource = supportsJsonSource

/** Forces the scanning fallback (false) or re-enables the source-text path when supported. */
export function setJsonSourceSupport(enabled: boolean): void {
  useJsonSource = enabled && supportsJsonSource
}

const INTEGER = /^-?\d+$/

function sourceReviver(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    !Number.isSafeInteger(value) &&
    context?.source !== undefined &&
    INTEGER.test(context.source)
  ) {
    return BigInt(context.source)
  }
  return value
}

const MARKER = "\u0000int64:"

/**
 * The fallback for runtimes without `context.source`: one pass over the text that skips
 * string literals, rewrites oversized integer tokens to marked strings, then revives them.
 */
export function parseJsonLosslessFallback(text: string): unknown {
  let out = ""
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (c === "-" || (c >= "0" && c <= "9")) {
      let j = i + 1
      while (j < text.length && text[j]! >= "0" && text[j]! <= "9") j += 1
      const next = text[j]
      if (next === "." || next === "e" || next === "E") {
        // A fractional or exponent number: copy it through unchanged.
        while (j < text.length && /[0-9eE.+-]/.test(text[j]!)) j += 1
        out += text.slice(i, j)
      } else {
        const token = text.slice(i, j)
        // The marker is written as a JSON escape; JSON.parse decodes it back to MARKER.
        out += Number.isSafeInteger(Number(token)) ? token : `"\\u0000int64:${token}"`
      }
      i = j
      continue
    }
    out += c
    i += 1
  }
  return JSON.parse(out, (_key, value: unknown) =>
    typeof value === "string" && value.startsWith(MARKER)
      ? BigInt(value.slice(MARKER.length))
      : value,
  )
}

/** JSON.parse that keeps integers beyond 2^53 exact as bigint. */
export function parseJsonLossless(text: string): unknown {
  return useJsonSource ? parseWithSource(text, sourceReviver) : parseJsonLosslessFallback(text)
}

const rawJSON = (JSON as unknown as { rawJSON?: (text: string) => unknown }).rawJSON

/**
 * JSON.stringify for request bodies: a bigint becomes a bare integer literal through
 * JSON.rawJSON; without it, its decimal string (the only lossy path; no current request
 * body carries a bigint).
 */
export function serializeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item !== "bigint") return item
    return rawJSON ? rawJSON(item.toString()) : item.toString()
  })
}

/** Converts a bigint, safe-integer number, or decimal string to Int64. */
export function toInt64(value: number | bigint | string): Int64 {
  if (typeof value === "bigint") return value as Int64
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`not a safe integer: ${value}`)
    return BigInt(value) as Int64
  }
  if (!INTEGER.test(value)) throw new RangeError(`not an integer: ${value}`)
  return BigInt(value) as Int64
}

/** A zod schema accepting a bigint, safe-integer number, or decimal string; output is Int64. */
export function int64(): z.ZodType<Int64, unknown> {
  return z
    .union([
      z.bigint(),
      z.number().refine(Number.isSafeInteger, "expected a safe integer"),
      z.string().regex(INTEGER, "expected a decimal integer"),
    ])
    .transform((value) => toInt64(value)) as unknown as z.ZodType<Int64, unknown>
}

/** Renders an integer for display; grouping uses thin spaces (U+2009) like the shell's formatInt. */
export function formatInt64(value: bigint | number, options?: { grouping?: boolean }): string {
  const text = typeof value === "bigint" ? value.toString() : Math.trunc(value).toString()
  if (!options?.grouping) return text
  const negative = text.startsWith("-")
  const digits = negative ? text.slice(1) : text
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return negative ? `-${grouped}` : grouped
}
