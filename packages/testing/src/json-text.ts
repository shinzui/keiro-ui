// Textual helpers over raw JSON. Fixtures are never parsed and re-serialized, because
// positions and ids are int64 and JSON.parse would round values above 2^53.

/** Index just past the JSON value starting at `start` (string, number, literal, array, or object). */
function valueEnd(text: string, start: number): number {
  const first = text[start]
  if (first === '"') {
    let i = start + 1
    while (i < text.length) {
      if (text[i] === "\\") i += 2
      else if (text[i] === '"') return i + 1
      else i += 1
    }
    throw new Error("unterminated string")
  }
  if (first === "[" || first === "{") {
    let depth = 0
    let i = start
    while (i < text.length) {
      const c = text[i]
      if (c === '"') {
        i = valueEnd(text, i)
        continue
      }
      if (c === "[" || c === "{") depth += 1
      else if (c === "]" || c === "}") {
        depth -= 1
        if (depth === 0) return i + 1
      }
      i += 1
    }
    throw new Error("unterminated container")
  }
  let i = start
  while (i < text.length && !/[,\]}\s]/.test(text[i]!)) i += 1
  return i
}

function skipSpace(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i]!)) i += 1
  return i
}

/** The raw text of each element of the top-level array under `key` (or of a top-level array). */
export function arrayElements(text: string, key?: string): string[] {
  let start: number
  if (key === undefined) {
    start = skipSpace(text, 0)
  } else {
    const match = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text)
    if (!match) return []
    start = match.index + match[0].length - 1
  }
  if (text[start] !== "[") return []
  const elements: string[] = []
  let i = skipSpace(text, start + 1)
  while (i < text.length && text[i] !== "]") {
    const end = valueEnd(text, i)
    elements.push(text.slice(i, end))
    i = skipSpace(text, end)
    if (text[i] === ",") i = skipSpace(text, i + 1)
  }
  return elements
}

/** The raw text of a top-level field's value, or undefined. */
export function fieldText(text: string, key: string): string | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*`).exec(text)
  if (!match) return undefined
  const start = match.index + match[0].length
  return text.slice(start, valueEnd(text, start))
}

/** A string field's value (unescaped), or undefined when absent or not a string. */
export function stringField(text: string, key: string): string | undefined {
  const raw = fieldText(text, key)
  return raw?.startsWith('"') ? (JSON.parse(raw) as string) : undefined
}

/** An integer field as bigint, read from the digits, or undefined. */
export function bigintField(text: string, key: string): bigint | undefined {
  const raw = fieldText(text, key)
  return raw !== undefined && /^-?\d+$/.test(raw) ? BigInt(raw) : undefined
}

/** `next_cursor` as written on the wire (a string cursor unquoted, a number as its digits). */
export function nextCursor(text: string): string | undefined {
  const raw = fieldText(text, "next_cursor")
  if (raw === undefined || raw === "null") return undefined
  return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw
}

/** Replaces a top-level field's raw value (first occurrence). */
export function replaceField(text: string, key: string, rawValue: string): string {
  const match = new RegExp(`"${key}"\\s*:\\s*`).exec(text)
  if (!match) return text
  const start = match.index + match[0].length
  return text.slice(0, start) + rawValue + text.slice(valueEnd(text, start))
}

/** The members of a top-level object as `[key, rawValueText]` pairs, in order. */
export function objectMembers(text: string): [string, string][] {
  let i = skipSpace(text, 0)
  if (text[i] !== "{") return []
  const members: [string, string][] = []
  i = skipSpace(text, i + 1)
  while (i < text.length && text[i] !== "}") {
    const keyEnd = valueEnd(text, i)
    const key = JSON.parse(text.slice(i, keyEnd)) as string
    i = skipSpace(text, keyEnd)
    i = skipSpace(text, i + 1) // past ':'
    const end = valueEnd(text, i)
    members.push([key, text.slice(i, end)])
    i = skipSpace(text, end)
    if (text[i] === ",") i = skipSpace(text, i + 1)
  }
  return members
}
