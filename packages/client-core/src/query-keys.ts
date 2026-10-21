import type { Surface } from "./surface"

export type QueryKeyPart = string | number | boolean | null | Record<string, unknown>

/**
 * A value safe inside a TanStack Query key: bigint (which JSON.stringify, the key hasher,
 * rejects) becomes its decimal string, including inside objects and arrays.
 */
export function keyPart(value: unknown): QueryKeyPart {
  if (typeof value === "bigint") return value.toString()
  if (value === undefined) return null
  if (Array.isArray(value)) return { items: value.map(keyPart) }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [
          k,
          typeof v === "object" && v !== null && !Array.isArray(v)
            ? keyPart(v)
            : Array.isArray(v)
              ? v.map(keyPart)
              : keyPart(v),
        ]),
    )
  }
  return value as QueryKeyPart
}

/** A query key whose first element is the surface, so one surface invalidates as `[surface]`. */
export function surfaceKey(
  surface: Surface,
  ...parts: QueryKeyPart[]
): readonly [Surface, ...QueryKeyPart[]] {
  return [surface, ...parts.map(keyPart)] as const
}

export const queryKeys: Record<
  Surface,
  (...parts: QueryKeyPart[]) => readonly [Surface, ...QueryKeyPart[]]
> = {
  kiroku: (...parts) => surfaceKey("kiroku", ...parts),
  pgmq: (...parts) => surfaceKey("pgmq", ...parts),
  shibuya: (...parts) => surfaceKey("shibuya", ...parts),
  keiro: (...parts) => surfaceKey("keiro", ...parts),
}
