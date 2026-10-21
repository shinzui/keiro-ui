import { parseSearchWith, stringifySearchWith } from "@tanstack/react-router"

/**
 * Search values stay strings unless they are a JSON array or object. TanStack's default
 * JSON-parses every value, which turns `?from=9007199254740993` into a lossy number and makes
 * `z.string()` search schemas reject hand-written URLs; positions and ids that are int64 on
 * the wire must reach the screens as their exact decimal strings.
 */
function parseValue(value: string): unknown {
  if (value.startsWith("[") || value.startsWith("{")) return JSON.parse(value)
  // parseSearchWith keeps the raw string when the parser throws.
  throw new Error("scalar search values stay strings")
}

export const parseSearch = parseSearchWith(parseValue)
export const stringifySearch = stringifySearchWith(JSON.stringify, parseValue)
