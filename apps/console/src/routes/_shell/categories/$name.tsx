import { Button } from "@keiro-ui/ui/components/button"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { EventsTable } from "@/features/streams/EventsTable"
import {
  LiveTailControls,
  mergeNewestFirst,
  OverflowNotice,
  useEventTail,
} from "@/features/streams/EventTail"
import { useCategoryEventsPage } from "@/features/streams/queries"
import { categoryEventsSearch, positionFrom } from "@/features/streams/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

export const Route = createFileRoute("/_shell/categories/$name")({
  validateSearch: categoryEventsSearch,
  component: CategoryPage,
})

function CategoryPage() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  const page = useCategoryEventsPage(name, { from: positionFrom(search.from), limit: search.limit })
  const pager = useCursorTrail()
  const [following, setFollowing] = useState(false)
  useRecordVisit({ kind: "category", label: name, href: hrefOf(links.category(name)) })

  const items = useMemo(() => page.data?.items ?? [], [page.data])
  const lastPage = page.data !== undefined && page.data.nextCursor === undefined
  const highest = items.at(-1)?.globalPosition ?? positionFrom(search.from) ?? 0n
  const tail = useEventTail({
    fromPosition: following ? highest : undefined,
    category: name,
    enabled: following && lastPage,
    onOverflow: () => void page.refetch(),
  })
  // Forward order on this page; the tail appends after the page's last event.
  const shown = useMemo(
    () => mergeNewestFirst(items, tail.events).toReversed(),
    [items, tail.events],
  )

  return (
    <>
      <PageHeader
        title={`Category ${name}`}
        description={
          <Link
            {...links.streams({ category: name })}
            className="underline-offset-2 hover:underline"
          >
            Streams in {name}
          </Link>
        }
        actions={
          lastPage &&
          (following ? (
            <LiveTailControls status={tail.status} onRefresh={() => void page.refetch()} />
          ) : (
            <Button size="sm" variant="outline" onPress={() => setFollowing(true)}>
              Follow live
            </Button>
          ))
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {tail.overflow && <OverflowNotice message={tail.overflow} onDismiss={tail.clearOverflow} />}
        {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
        <EventsTable events={shown} showStream label={`Events in category ${name}`} />
        <CursorPager
          cursor={search.from}
          nextCursor={page.data?.nextCursor?.toString()}
          trail={pager.trail}
          onNavigate={pager.go}
          itemCount={items.length}
        />
      </div>
    </>
  )
}
