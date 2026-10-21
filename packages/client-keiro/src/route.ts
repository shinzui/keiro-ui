// keiro has no hand-written route table (mori://shinzui/keiro/okf/adrs/concepts/ADR-53): path
// segments are keiro-ops command words then positional arguments, and each snake_case query
// key is the --kebab-case flag of the same name. Reads are GET, mutations POST.

export type Flag =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | ReadonlyArray<string | number | bigint>
export type Flags = Record<string, Flag>

/** Keys the server rejects with 400; refused here before sending. */
export const RESERVED_FLAGS = [
  "json",
  "force",
  "database_url",
  "allow_schema_drift",
  "help",
] as const

export interface CommandRoute {
  path: string
  query: Record<
    string,
    string | number | bigint | boolean | ReadonlyArray<string | number | bigint> | undefined
  >
  /** The first command word, used to recognize hook-gated routes. */
  word: string
}

export function commandRoute(
  words: string[],
  positionals: string[] = [],
  flags: Flags = {},
): CommandRoute {
  for (const key of Object.keys(flags)) {
    if ((RESERVED_FLAGS as readonly string[]).includes(key))
      throw new RangeError(`"${key}" is a reserved keiro-ops flag`)
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new RangeError(`flag "${key}" must be snake_case`)
  }
  const segments = [...words, ...positionals.map((value) => encodeURIComponent(value))]
  return { path: `/${segments.join("/")}`, query: { ...flags }, word: words[0] ?? "" }
}
