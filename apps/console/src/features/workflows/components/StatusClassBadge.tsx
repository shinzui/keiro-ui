import { Badge } from "@keiro-ui/ui/components/badge"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { cn } from "cn"

const tone: Record<string, string> = {
  running: "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  retrying: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  sleeping: "border-violet-600/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  awaiting: "border-border bg-muted text-foreground",
  completed: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-border text-muted-foreground",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

/** The status class as the label; the raw status and attempts in the tooltip. */
export function StatusClassBadge({
  statusClass,
  status,
  attempts,
}: {
  statusClass: string
  status?: string
  attempts?: number
}) {
  const badge = (
    <Badge variant="outline" className={cn(tone[statusClass])} data-status-class={statusClass}>
      {statusClass}
    </Badge>
  )
  if (status === undefined) return badge
  return (
    <TooltipTrigger>
      <span role="button" tabIndex={0} className="outline-none">
        {badge}
      </span>
      <Tooltip>
        status {status}
        {attempts !== undefined && ` · attempts ${attempts}`}
      </Tooltip>
    </TooltipTrigger>
  )
}
