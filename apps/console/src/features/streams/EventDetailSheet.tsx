import { useKirokuEvent } from "@keiro-ui/client-kiroku"
import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { Link } from "@tanstack/react-router"

import { JsonViewer } from "@/components/JsonViewer"
import { links } from "@/lib/links"
import type { SheetProps } from "@/shell/right-sheet"

import { EventFields } from "./EventFields"

/** Sheet kind `event`: one event by id, with payload and metadata. */
export function EventDetailSheet({ entityRef }: SheetProps) {
  const event = useKirokuEvent(entityRef)
  return (
    <>
      <SheetHeader>
        <SheetTitle>{event.data?.eventType ?? "Event"}</SheetTitle>
        <SheetDescription className="font-mono text-xs break-all">{entityRef}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {event.isPending && <Skeleton className="h-32" />}
        {event.isError && (
          <p className="text-sm text-destructive">
            {event.error.status === 404
              ? "No event with this id in the store."
              : event.error.message}
          </p>
        )}
        {event.data && (
          <>
            <EventFields event={event.data} />
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">caused by</dt>
              <dd className="font-mono text-xs break-all">
                {event.data.causationId ? (
                  <Link
                    {...links.event(event.data.causationId)}
                    className="underline-offset-2 hover:underline"
                  >
                    {event.data.causationId}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted-foreground">correlation</dt>
              <dd className="font-mono text-xs break-all">{event.data.correlationId ?? "—"}</dd>
            </dl>
            <JsonViewer label="Payload" value={event.data.payload} />
            <JsonViewer label="Metadata" value={event.data.metadata} />
            <Link
              {...links.event(entityRef)}
              className="text-sm underline-offset-2 hover:underline"
            >
              Open full page
            </Link>
          </>
        )}
      </div>
    </>
  )
}
