import { useKirokuEvent } from "@keiro-ui/client-kiroku"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { createFileRoute, Link } from "@tanstack/react-router"

import { JsonViewer } from "@/components/JsonViewer"
import { PageHeader } from "@/components/page-header"
import { EventFields } from "@/features/streams/EventFields"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/events/$id")({
  validateSearch: shellSearchSchema,
  component: EventPage,
})

/** A causation id may name a command rather than an event; a 404 says so instead of erroring. */
function CausedBy({ id }: { id: string }) {
  const cause = useKirokuEvent(id)
  if (cause.isError && cause.error.status === 404) {
    return (
      <span>
        <span className="font-mono text-xs">{id}</span>{" "}
        <span className="text-muted-foreground">— not an event in this store</span>
      </span>
    )
  }
  return (
    <Link {...links.event(id)} className="font-mono text-xs underline-offset-2 hover:underline">
      {id}
      {cause.data && (
        <span className="ml-2 font-sans text-muted-foreground">({cause.data.eventType})</span>
      )}
    </Link>
  )
}

function EventPage() {
  const { id } = Route.useParams()
  const event = useKirokuEvent(id)
  useRecordVisit({
    kind: "event",
    label: event.data?.eventType ? `${event.data.eventType} ${id.slice(0, 8)}` : id,
    href: hrefOf(links.event(id)),
  })
  return (
    <>
      <PageHeader
        title={event.data?.eventType ?? "Event"}
        description={<span className="font-mono text-xs">{id}</span>}
      />
      <div className="flex max-w-4xl flex-col gap-4 p-6">
        {event.isPending && <Skeleton className="h-40" />}
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
              <dd>{event.data.causationId ? <CausedBy id={event.data.causationId} /> : "—"}</dd>
              <dt className="text-muted-foreground">correlation</dt>
              <dd className="flex flex-col">
                <span className="font-mono text-xs select-all">
                  {event.data.correlationId ?? "—"}
                </span>
                {event.data.correlationId && (
                  <span className="text-xs text-muted-foreground">
                    correlation filtering is not available on this surface
                  </span>
                )}
              </dd>
            </dl>
            <JsonViewer label="Payload" value={event.data.payload} />
            <JsonViewer label="Metadata" value={event.data.metadata} />
          </>
        )}
      </div>
    </>
  )
}
