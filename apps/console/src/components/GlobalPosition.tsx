import { PositionBadge } from "./PositionBadge"

/**
 * A `$all` global position. kiroku's single-stream reads do not join `$all` and report 0
 * (kiroku-store's readStreamForwardSQL in mori://shinzui/kiroku), and `$all` never assigns
 * position 0, so 0 means "not reported by this read": the event's own page has the real one.
 */
export function GlobalPosition({ value }: { value: bigint | number | null | undefined }) {
  if (value === 0n || value === 0)
    return (
      <span
        className="text-xs text-muted-foreground"
        title="This read does not report the global position; open the event for it."
      >
        not reported
      </span>
    )
  return <PositionBadge value={value} label="global position" />
}
