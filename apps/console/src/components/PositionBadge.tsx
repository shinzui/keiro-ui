import { formatInt } from "@/lib/format"

/** A monospace position (bigint-safe) that copies its exact digits on click. */
export function PositionBadge({
  value,
  label,
}: {
  value: bigint | number | null | undefined
  label?: string
}) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  const digits = value.toString()
  return (
    <button
      type="button"
      title={`${label ?? "position"} ${digits} — click to copy`}
      aria-label={`${label ?? "position"} ${digits}`}
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard?.writeText(digits)
      }}
      className="rounded border bg-muted/40 px-1 font-mono text-xs tabular-nums hover:bg-muted"
    >
      {formatInt(value)}
    </button>
  )
}
