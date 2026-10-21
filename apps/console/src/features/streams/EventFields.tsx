import type { KirokuEvent } from "@keiro-ui/client-kiroku"
import { Link } from "@tanstack/react-router"

import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

export function categoryOfStream(stream: string): string {
  const dash = stream.indexOf("-")
  return dash === -1 ? stream : stream.slice(0, dash)
}

/** The event's identity and envelope fields as a definition list. */
export function EventFields({ event }: { event: KirokuEvent }) {
  const stream = event.original_stream_name ?? null
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">type</dt>
      <dd className="font-medium">{event.eventType}</dd>
      <dt className="text-muted-foreground">event id</dt>
      <dd className="font-mono text-xs break-all">{event.eventId}</dd>
      <dt className="text-muted-foreground">stream</dt>
      <dd>
        {stream ? (
          <>
            <Link {...links.stream(stream)} className="underline-offset-2 hover:underline">
              {stream}
            </Link>{" "}
            <span className="text-muted-foreground">
              in{" "}
              <Link
                {...links.category(categoryOfStream(stream))}
                className="underline-offset-2 hover:underline"
              >
                {categoryOfStream(stream)}
              </Link>
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">stream #{event.originalStreamId.toString()}</span>
        )}
      </dd>
      <dt className="text-muted-foreground">stream version</dt>
      <dd>
        <PositionBadge value={event.streamVersion} label="stream version" />
      </dd>
      <dt className="text-muted-foreground">global position</dt>
      <dd>
        <PositionBadge value={event.globalPosition} label="global position" />
      </dd>
      <dt className="text-muted-foreground">created</dt>
      <dd>
        <Timestamp value={event.createdAt} />
      </dd>
    </dl>
  )
}
