import { keiroKeys, type TimerItem } from "@keiro-ui/client-keiro"
import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useSyncExternalStore } from "react"

import { JsonViewer } from "@/components/JsonViewer"
import { Timestamp } from "@/components/timestamp"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"
import type { SheetProps } from "@/shell/right-sheet"

import { TimerActionButtons } from "./timer-actions"
import { errorLine } from "./TimersTable"

/**
 * The timer from any loaded pending or stuck page, or a process-manager instance's pending
 * timers (keiro has no timer-by-id read).
 */
function useCachedTimer(id: string): TimerItem | undefined {
  const queryClient = useQueryClient()
  const cache = queryClient.getQueryCache()
  // Subscribed, so the sheet fills in when a page that holds the timer finishes loading.
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => findTimer(queryClient, id),
  )
}

function findTimer(queryClient: QueryClient, id: string): TimerItem | undefined {
  const cached = [
    ...queryClient.getQueriesData<unknown>({ queryKey: keiroKeys.timers.all() }),
    ...queryClient.getQueriesData<unknown>({ queryKey: ["keiro", "process-managers", "show"] }),
  ]
  for (const [, data] of cached) {
    const body = data as { items?: TimerItem[]; pending_timers?: { items?: TimerItem[] } } | null
    const items = Array.isArray(data)
      ? (data as TimerItem[])
      : (body?.items ?? body?.pending_timers?.items)
    const timer = items?.find((t) => t.timer_id === id)
    if (timer) return timer
  }
  return undefined
}

/** Sheet kind `timer`, ref `<timer_id>`: every field, the payload, and the full last error. */
export function TimerSheet({ entityRef }: SheetProps) {
  const timer = useCachedTimer(entityRef)
  useRecordVisit({
    kind: "timer",
    label: entityRef.slice(0, 8),
    href: hrefOf(links.timer(entityRef)),
  })
  return (
    <>
      <SheetHeader>
        <SheetTitle>Timer {entityRef.slice(0, 8)}</SheetTitle>
        <SheetDescription className="font-mono text-xs break-all">{entityRef}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
        {!timer ? (
          <p className="text-muted-foreground">
            Timer {entityRef} is not on the current page.{" "}
            <Link {...links.timer(entityRef)} className="underline-offset-2 hover:underline">
              Clear the filters
            </Link>
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">manager</dt>
              <dd>
                <Link
                  {...links.processManager(timer.process_manager_name)}
                  className="underline-offset-2 hover:underline"
                >
                  {timer.process_manager_name}
                </Link>
              </dd>
              <dt className="text-muted-foreground">correlation</dt>
              <dd className="font-mono text-xs">
                <Link
                  {...links.processManagerInstance(
                    timer.process_manager_name,
                    timer.correlation_id,
                  )}
                  className="underline-offset-2 hover:underline"
                >
                  {timer.correlation_id}
                </Link>
              </dd>
              <dt className="text-muted-foreground">fires</dt>
              <dd>
                <Timestamp value={timer.fire_at} />
              </dd>
              <dt className="text-muted-foreground">status</dt>
              <dd>{timer.status}</dd>
              <dt className="text-muted-foreground">attempts</dt>
              <dd>{timer.attempts}</dd>
              <dt className="text-muted-foreground">fired event</dt>
              <dd className="font-mono text-xs">
                {timer.fired_event_id ? (
                  <Link
                    {...links.event(timer.fired_event_id)}
                    className="underline-offset-2 hover:underline"
                  >
                    {timer.fired_event_id}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
            {errorLine(timer.last_error) && (
              <pre className="rounded-md bg-destructive/5 p-2 text-xs whitespace-pre-wrap text-destructive">
                {errorLine(timer.last_error)}
              </pre>
            )}
            <JsonViewer label="Payload" value={timer.payload} />
          </>
        )}
        <TimerActionButtons timerId={entityRef} />
      </div>
    </>
  )
}
