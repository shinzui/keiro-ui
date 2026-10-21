import { Badge } from "@keiro-ui/ui/components/badge"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"

interface Hydration {
  source: "snapshot" | "full_replay"
  snapshot_version?: bigint
  reason?: string
  miss?: string
  detail?: string
  error?: string
}

/** How keiro rebuilt the state: "snapshot @ vN" or "full replay: <reason>"; null is "no state". */
export function HydrationBadge({ hydration }: { hydration: Hydration | null }) {
  if (!hydration) return <Badge variant="outline">no state</Badge>
  const label =
    hydration.source === "snapshot"
      ? `snapshot @ v${hydration.snapshot_version?.toString() ?? "?"}`
      : `full replay: ${hydration.reason ?? "unspecified"}`
  const details = [
    hydration.miss && `miss: ${hydration.miss}`,
    hydration.detail,
    hydration.error && `error: ${hydration.error}`,
  ].filter(Boolean)
  const badge = (
    <Badge variant="outline" data-hydration={hydration.source}>
      {label}
    </Badge>
  )
  if (details.length === 0) return badge
  return (
    <TooltipTrigger>
      <span role="button" tabIndex={0} className="outline-none">
        {badge}
      </span>
      <Tooltip>{details.join(" · ")}</Tooltip>
    </TooltipTrigger>
  )
}
