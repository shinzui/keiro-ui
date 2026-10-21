import { cn } from "cn"
import { TriangleAlert } from "lucide-react"

import { formatInt } from "@/lib/format"

import type { PositionDistance } from "./distance"

/** The global position distance as text: "n/a", "—", "caught up", the number, or "ahead by". */
export function DistanceCell({
  distance,
  large = false,
}: {
  distance: PositionDistance
  large?: boolean
}) {
  const size = large ? "text-2xl font-semibold" : "text-sm"
  switch (distance.kind) {
    case "unmanaged":
      return (
        <span
          className={cn(size, "text-muted-foreground")}
          title="keiro does not manage this group's position"
        >
          n/a
        </span>
      )
    case "none":
      return <span className={cn(size, "text-muted-foreground")}>—</span>
    case "caught-up":
      return <span className={cn(size, "text-emerald-700 dark:text-emerald-400")}>caught up</span>
    case "behind":
      return <span className={cn(size, "tabular-nums")}>{formatInt(distance.distance)}</span>
    case "ahead":
      return (
        <span
          className={cn(size, "inline-flex items-center gap-1 text-amber-700 dark:text-amber-400")}
        >
          <TriangleAlert aria-hidden className="size-3.5" />
          ahead by {formatInt(distance.distance)}
        </span>
      )
  }
}
