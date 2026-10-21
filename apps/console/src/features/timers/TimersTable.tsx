import type { StuckTimer, TimerItem } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { Link } from "@tanstack/react-router"

import { formatDuration } from "@/lib/format"
import { links } from "@/lib/links"
import { useRightSheet } from "@/shell/right-sheet"

/**
 * "due in 4 min 50 s" / "overdue by 40 s", recomputed from `fire_at` (keiro's feed strips
 * `due_in_seconds` before comparing, so a clock tick alone sends no update).
 */
export function dueText(fireAt: string, now: number): string {
  const seconds = (Date.parse(fireAt) - now) / 1000
  if (Number.isNaN(seconds)) return "—"
  return seconds >= 0
    ? `due in ${formatDuration(seconds)}`
    : `overdue by ${formatDuration(-seconds)}`
}

export function errorLine(error: unknown): string | null {
  if (error === null || error === undefined) return null
  return typeof error === "string" ? error : JSON.stringify(error)
}

/** A pending row, or a stuck row (which carries no `last_error` or `due_in_seconds`). */
export type TimerRow = TimerItem | StuckTimer

/** Pending or stuck timers; the id opens the `timer` sheet. Stuck rows carry no error or due. */
export function TimersTable({
  timers,
  now,
  isPending,
  stuck = false,
  label = "Timers",
}: {
  timers: TimerRow[]
  now: number
  isPending: boolean
  stuck?: boolean
  label?: string
}) {
  const { open } = useRightSheet()
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableHead isRowHeader>Timer</TableHead>
        <TableHead>Manager</TableHead>
        <TableHead>Correlation</TableHead>
        <TableHead>Fires</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Attempts</TableHead>
        {!stuck && <TableHead>Last error</TableHead>}
        <TableHead>Fired event</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : stuck ? "No stuck timers." : "No pending timers."}
          </p>
        )}
      >
        {timers.map((timer) => {
          const error = errorLine(timer.last_error)
          return (
            <TableRow key={timer.timer_id} id={timer.timer_id}>
              <TableCell textValue={timer.timer_id}>
                <button
                  type="button"
                  className="font-mono text-xs underline-offset-2 hover:underline"
                  onClick={() => open({ kind: "timer", ref: timer.timer_id })}
                >
                  {timer.timer_id.slice(0, 8)}
                </button>
              </TableCell>
              <TableCell>
                <Link
                  {...links.processManager(timer.process_manager_name)}
                  className="underline-offset-2 hover:underline"
                >
                  {timer.process_manager_name}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  {...links.processManagerInstance(
                    timer.process_manager_name,
                    timer.correlation_id,
                  )}
                  className="font-mono text-xs underline-offset-2 hover:underline"
                >
                  {timer.correlation_id}
                </Link>
              </TableCell>
              <TableCell>
                <TooltipTrigger>
                  <span role="button" tabIndex={0} className="outline-none" data-testid="due">
                    {stuck ? new Date(timer.fire_at).toISOString() : dueText(timer.fire_at, now)}
                  </span>
                  <Tooltip>{timer.fire_at}</Tooltip>
                </TooltipTrigger>
              </TableCell>
              <TableCell>
                <Badge variant={timer.status === "firing" ? "secondary" : "outline"}>
                  {timer.status}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">{timer.attempts}</TableCell>
              {!stuck && (
                <TableCell className="max-w-48 truncate text-xs text-destructive">
                  {error ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
              <TableCell>
                {timer.fired_event_id ? (
                  <Link
                    {...links.event(timer.fired_event_id)}
                    className="font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {timer.fired_event_id.slice(0, 8)}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
