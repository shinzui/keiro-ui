import { Badge } from "@keiro-ui/ui/components/badge"
import { Button } from "@keiro-ui/ui/components/button"
import { RefreshCw } from "lucide-react"

/** The live/paused indicator, a manual refresh, and the new-events pill shown when scrolled away. */
export function LiveTailControls({
  status,
  onRefresh,
  pendingCount = 0,
  onShowPending,
}: {
  status: "idle" | "connecting" | "live" | "reconnecting" | "error" | "paused"
  onRefresh: () => void
  pendingCount?: number
  onShowPending?: () => void
}) {
  const label = {
    idle: "Not following",
    connecting: "Connecting…",
    live: "Following live",
    reconnecting: "Reconnecting…",
    error: "Feed error",
    paused: "Paused",
  }[status]
  return (
    <div className="flex items-center gap-2 text-xs" data-slot="live-tail">
      <Badge variant={status === "live" ? "default" : "outline"} data-status={status}>
        <span
          className={
            status === "live"
              ? "size-1.5 animate-pulse rounded-full bg-emerald-400"
              : "size-1.5 rounded-full bg-muted-foreground"
          }
        />
        {label}
      </Badge>
      <Button size="xs" variant="ghost" onPress={onRefresh} aria-label="Refresh">
        <RefreshCw />
      </Button>
      {pendingCount > 0 && (
        <Button size="xs" onPress={onShowPending}>
          {pendingCount} new {pendingCount === 1 ? "event" : "events"}
        </Button>
      )}
    </div>
  )
}
