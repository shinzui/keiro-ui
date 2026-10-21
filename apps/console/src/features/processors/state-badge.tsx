import type { ProcessorState } from "@keiro-ui/client-shibuya"
import { Badge } from "@keiro-ui/ui/components/badge"
import { cn } from "cn"

const tone: Record<ProcessorState["status"], string> = {
  idle: "border-border text-muted-foreground",
  processing: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  stopped: "border-border bg-muted text-muted-foreground",
}

/** The processor's `state.status` as a badge with a distinct tone per state. */
export function StateBadge({ status }: { status: ProcessorState["status"] }) {
  return (
    <Badge variant="outline" className={cn(tone[status])} data-status={status}>
      {status}
    </Badge>
  )
}
