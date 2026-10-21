import { useKirokuStream } from "@keiro-ui/client-kiroku"
import { Badge } from "@keiro-ui/ui/components/badge"
import { ToggleGroup, ToggleGroupItem } from "@keiro-ui/ui/components/toggle-group"
import { createFileRoute, Link } from "@tanstack/react-router"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { EventsTable } from "@/features/streams/EventsTable"
import { useStreamEventsPage } from "@/features/streams/queries"
import { positionFrom, streamEventsSearch } from "@/features/streams/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

export const Route = createFileRoute("/_shell/streams/$name")({
  validateSearch: streamEventsSearch,
  component: StreamPage,
})

function StreamPage() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const stream = useKirokuStream(name)
  const direction = search.direction ?? "forward"
  const events = useStreamEventsPage(name, {
    from: positionFrom(search.from),
    direction,
    limit: search.limit,
  })
  const pager = useCursorTrail()
  useRecordVisit({ kind: "stream", label: name, href: hrefOf(links.stream(name)) })

  const info = stream.data
  return (
    <>
      <PageHeader
        title={name}
        description={
          info ? (
            <span className="flex flex-wrap items-center gap-2">
              in{" "}
              <Link
                {...links.category(info.category)}
                className="underline-offset-2 hover:underline"
              >
                {info.category}
              </Link>
              · head version <PositionBadge value={info.version} label="head version" /> · created{" "}
              <Timestamp value={info.created_at} />
              {info.deleted_at && <Badge variant="destructive">deleted</Badge>}
              {info.truncate_before > 0n && (
                <span>· events before version {info.truncate_before.toString()} truncated</span>
              )}
            </span>
          ) : stream.isError ? (
            <span className="text-destructive">
              {stream.error.status === 404 ? "No stream with this name." : stream.error.message}
            </span>
          ) : (
            "Loading…"
          )
        }
        actions={
          <ToggleGroup
            aria-label="Direction"
            selectionMode="single"
            selectedKeys={[direction]}
            onSelectionChange={(keys) => {
              const [value] = [...keys]
              if (!value) return
              pager.reset()
              void navigate({
                search: (prev) => ({
                  ...prev,
                  direction: value as "forward" | "backward",
                  from: undefined,
                }),
              })
            }}
          >
            <ToggleGroupItem id="forward">Oldest first</ToggleGroupItem>
            <ToggleGroupItem id="backward">Newest first</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {events.isError && <p className="text-sm text-destructive">{events.error.message}</p>}
        <EventsTable events={events.data?.items ?? []} label={`Events in ${name}`} />
        <CursorPager
          cursor={search.from}
          nextCursor={events.data?.nextCursor?.toString()}
          trail={pager.trail}
          onNavigate={pager.go}
          itemCount={events.data?.items.length}
        />
      </div>
    </>
  )
}
