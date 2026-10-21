import type { WorkflowJournalEntry } from "@keiro-ui/client-keiro"
import { keiroKeys } from "@keiro-ui/client-keiro"
import { useKirokuEvent } from "@keiro-ui/client-kiroku"
import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { type InfiniteData, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { JsonViewer } from "@/components/JsonViewer"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"
import type { SheetProps } from "@/shell/right-sheet"

import { parseJournalEntryRef } from "../journal"

/** keiro's decoded entry, when a loaded journal page holds it. */
function useCachedEntry(name: string, id: string, eventId: string) {
  const queryClient = useQueryClient()
  const pages = queryClient.getQueriesData<InfiniteData<{ items: WorkflowJournalEntry[] }>>({
    queryKey: keiroKeys.workflows.journal(name, id).slice(0, -1),
  })
  for (const [, data] of pages) {
    for (const page of data?.pages ?? []) {
      const entry = page.items.find((item) => item.event_id === eventId)
      if (entry) return entry
    }
  }
  return undefined
}

/**
 * Sheet kind `journal-entry`, ref `<name>/<id>/<event_id>`. keiro's journal entry gives the
 * step and decoded payload; kiroku's record of the same event id gives the global position
 * and the journal stream, which keiro's journal read does not report.
 */
export function JournalEntrySheet({ entityRef }: SheetProps) {
  const { name, id, eventId } = parseJournalEntryRef(entityRef)
  const entry = useCachedEntry(name, id, eventId)
  const stored = useKirokuEvent(eventId)
  const event = stored.data
  return (
    <>
      <SheetHeader>
        <SheetTitle>{entry?.step_name ?? event?.eventType ?? "Journal entry"}</SheetTitle>
        <SheetDescription className="font-mono text-xs break-all">
          {name} / {id}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {stored.isPending && !entry && <Skeleton className="h-32" />}
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">event type</dt>
          <dd>{entry?.event_type ?? event?.eventType ?? "—"}</dd>
          <dt className="text-muted-foreground">recorded</dt>
          <dd>
            {entry ? (
              <Timestamp value={entry.recorded_at} />
            ) : event ? (
              <Timestamp value={event.createdAt} />
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted-foreground">stream version</dt>
          <dd className="tabular-nums">
            {(entry?.stream_version ?? event?.streamVersion)?.toString() ?? "—"}
          </dd>
          <dt className="text-muted-foreground">global position</dt>
          <dd>
            {event ? <PositionBadge value={event.globalPosition} label="global position" /> : "—"}
          </dd>
          <dt className="text-muted-foreground">journal stream</dt>
          <dd className="font-mono text-xs break-all">
            {event?.original_stream_name ? (
              <Link
                {...links.stream(event.original_stream_name)}
                className="underline-offset-2 hover:underline"
              >
                {event.original_stream_name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        {stored.isError && (
          <p className="text-xs text-muted-foreground">
            The event store did not return this event ({stored.error.message}); store links are
            unavailable.
          </p>
        )}
        {entry && <JsonViewer label="Payload" value={entry.payload} />}
        {!entry && event && <JsonViewer label="Stored payload" value={event.payload} />}
        <div className="flex flex-col gap-1 text-sm">
          {event && (
            <Link
              {...links.allEvents({ from: String(event.globalPosition - 1n) })}
              className="underline-offset-2 hover:underline"
            >
              Open in the $all log
            </Link>
          )}
          <Link {...links.event(eventId)} className="underline-offset-2 hover:underline">
            Open event
          </Link>
        </div>
      </div>
    </>
  )
}
