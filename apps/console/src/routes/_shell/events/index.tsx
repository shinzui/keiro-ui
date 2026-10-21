import { useKirokuClient, type KirokuEvent } from "@keiro-ui/client-kiroku"
import { Button } from "@keiro-ui/ui/components/button"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { PageHeader } from "@/components/page-header"
import { EventsTable } from "@/features/streams/EventsTable"
import {
  LiveTailControls,
  mergeNewestFirst,
  OverflowNotice,
  useEventTail,
} from "@/features/streams/EventTail"
import { useNewestEvents } from "@/features/streams/queries"
import { allEventsSearch, DEFAULT_LIMIT } from "@/features/streams/search"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/events/")({
  validateSearch: allEventsSearch,
  component: AllEventsPage,
})

/**
 * The `$all` log, newest first, following the store live. With `?category=` it tails that
 * category from the current head; its history is browsed on /categories/$name.
 */
function AllEventsPage() {
  const search = Route.useSearch()
  const kiroku = useKirokuClient()
  const limit = search.limit ?? DEFAULT_LIMIT
  const newest = useNewestEvents(search.category ? 1 : limit)
  const [older, setOlder] = useState<KirokuEvent[]>([])
  const [olderExhausted, setOlderExhausted] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // The tail starts at the head first seen; later polls only add rows (no resubscription).
  const [startedAt, setStartedAt] = useState<bigint | undefined>(undefined)
  const head = newest.data?.items[0]?.globalPosition ?? (newest.data ? 0n : undefined)
  if (startedAt === undefined && head !== undefined) setStartedAt(head)

  const tail = useEventTail({
    fromPosition: startedAt,
    category: search.category,
    enabled: newest.isSuccess,
    onOverflow: () => void newest.refetch(),
  })
  const pageItems = useMemo(
    () => (search.category ? [] : (newest.data?.items ?? [])),
    [search.category, newest.data],
  )
  const fresh = useMemo(() => new Set(tail.events.map((event) => event.eventId)), [tail.events])
  const shown = useMemo(
    () => mergeNewestFirst(tail.events, pageItems, older),
    [tail.events, pageItems, older],
  )

  const loadOlder = async () => {
    const lowest = shown.at(-1)?.globalPosition
    if (lowest === undefined || lowest <= 1n) return setOlderExhausted(true)
    setLoadingOlder(true)
    try {
      const page = await kiroku.events.all({ from: lowest, direction: "backward", limit })
      setOlder((prev) => [...prev, ...page.items])
      if (page.nextCursor === undefined) setOlderExhausted(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  return (
    <>
      <PageHeader
        title={search.category ? `Live: ${search.category}` : "All events"}
        description={
          search.category ? (
            <Link
              {...links.category(search.category)}
              className="underline-offset-2 hover:underline"
            >
              Browse history of {search.category}
            </Link>
          ) : (
            "The $all log, newest first."
          )
        }
        actions={<LiveTailControls status={tail.status} onRefresh={() => void newest.refetch()} />}
      />
      <div className="flex flex-col gap-3 p-6">
        {tail.overflow && <OverflowNotice message={tail.overflow} onDismiss={tail.clearOverflow} />}
        {newest.isError && <p className="text-sm text-destructive">{newest.error.message}</p>}
        <EventsTable events={shown} showStream highlight={fresh} label="All events" />
        {!search.category && (
          <Button
            size="sm"
            variant="outline"
            isDisabled={olderExhausted || loadingOlder || shown.length === 0}
            onPress={() => void loadOlder()}
            className="self-start"
          >
            {olderExhausted ? "No older events" : "Load older"}
          </Button>
        )}
      </div>
    </>
  )
}
