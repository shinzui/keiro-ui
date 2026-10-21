import { stringifySearchWith } from "@tanstack/react-router"

/**
 * Search values stay strings unless they are a JSON array or object. TanStack's default
 * JSON-parses every value, which turns `?from=9007199254740993` into a lossy number and makes
 * `z.string()` search schemas reject hand-written URLs; positions and ids that are int64 on
 * the wire must reach the screens as their exact decimal strings.
 *
 * `parseSearchWith` cannot express this: its query decoder already converts `"2"` to `2` and
 * `"true"` to `true` before any custom parser runs, so the parser is written here over
 * `URLSearchParams` directly.
 */
function parseValue(value: string): unknown {
  if (value.startsWith("[") || value.startsWith("{")) return JSON.parse(value)
  // stringifySearchWith keeps the raw string when the parser throws.
  throw new Error("scalar search values stay strings")
}

function decodeValue(value: string): unknown {
  try {
    return parseValue(value)
  } catch {
    return value
  }
}

export function parseSearch(searchStr: string): Record<string, unknown> {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr)
  const search: Record<string, unknown> = {}
  for (const [key, raw] of params) {
    const value = decodeValue(raw)
    const previous = search[key]
    search[key] =
      previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value]
  }
  return search
}

export const stringifySearch = stringifySearchWith(JSON.stringify, parseValue)
