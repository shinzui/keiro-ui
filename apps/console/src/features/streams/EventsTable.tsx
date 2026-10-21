import type { KirokuEvent } from "@keiro-ui/client-kiroku"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"

import { GlobalPosition } from "@/components/GlobalPosition"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"
import { useRightSheet } from "@/shell/right-sheet"

/** Events with version, type, global position, created, causation; a row opens the event sheet. */
export function EventsTable({
  events,
  showStream = false,
  highlight,
  label = "Events",
}: {
  events: KirokuEvent[]
  showStream?: boolean
  highlight?: Set<string>
  label?: string
}) {
  const { open } = useRightSheet()
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableHead isRowHeader>Type</TableHead>
        {showStream ? <TableHead>Stream</TableHead> : <TableHead>Version</TableHead>}
        <TableHead>Global position</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Caused by</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">No events.</p>
        )}
      >
        {events.map((event) => (
          <TableRow
            key={event.eventId}
            id={event.eventId}
            onAction={() => open({ kind: "event", ref: event.eventId })}
            data-highlight={highlight?.has(event.eventId) || undefined}
            className="cursor-pointer data-highlight:bg-amber-100/60 dark:data-highlight:bg-amber-900/30"
          >
            <TableCell className="font-medium">{event.eventType}</TableCell>
            {showStream ? (
              <TableCell>
                {event.original_stream_name ? (
                  <Link
                    {...links.stream(event.original_stream_name)}
                    className="underline-offset-2 hover:underline"
                  >
                    {event.original_stream_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    stream #{event.originalStreamId.toString()}
                  </span>
                )}
              </TableCell>
            ) : (
              <TableCell>
                <PositionBadge value={event.streamVersion} label="stream version" />
              </TableCell>
            )}
            <TableCell>
              <GlobalPosition value={event.globalPosition} />
            </TableCell>
            <TableCell>
              <Timestamp value={event.createdAt} />
            </TableCell>
            <TableCell className="font-mono text-xs">
              {event.causationId ? event.causationId.slice(0, 8) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
