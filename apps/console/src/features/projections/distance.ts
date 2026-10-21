// The global position distance (mori://shinzui/keiro/okf/adrs/concepts/ADR-28): the visible
// store head minus a served position, in bigint. These screens never call it lag or backlog.

export type PositionDistance =
  | { kind: "unmanaged" }
  | { kind: "none" }
  | { kind: "caught-up" }
  | { kind: "behind"; distance: bigint }
  | { kind: "ahead"; distance: bigint }

const int = (value: bigint | number) => (typeof value === "bigint" ? value : BigInt(value))

export function positionDistance({
  head,
  applied,
  basis,
}: {
  head: bigint | number | null | undefined
  applied: bigint | number | null | undefined
  basis: string
}): PositionDistance {
  if (basis === "unmanaged") return { kind: "unmanaged" }
  if (applied === null || applied === undefined || head === null || head === undefined)
    return { kind: "none" }
  const difference = int(head) - int(applied)
  if (difference === 0n) return { kind: "caught-up" }
  return difference > 0n
    ? { kind: "behind", distance: difference }
    : { kind: "ahead", distance: -difference }
}
