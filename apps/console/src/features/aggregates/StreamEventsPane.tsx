import { useSurfaceAvailable } from "@keiro-ui/client-core"
import { ToggleGroup, ToggleGroupItem } from "@keiro-ui/ui/components/toggle-group"

import { CursorPager } from "@/components/CursorPager"
import { EventsTable } from "@/features/streams/EventsTable"
import { useCursorTrail } from "@/features/streams/useCursorTrail"

import { useStreamEvents } from "./queries"

/** The aggregate's raw events from kiroku; a row opens the `event` sheet. */
function ConfiguredStreamEventsPane({
  streamName,
  from,
  direction,
  onDirection,
}: {
  streamName: string | undefined
  from: string | undefined
  direction: "forward" | "backward"
  onDirection: (direction: "forward" | "backward") => void
}) {
  const pager = useCursorTrail()
  const events = useStreamEvents(streamName, {
    from: from === undefined ? undefined : BigInt(from),
    direction,
  })
  return (
    <section aria-label="Stream events" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Events</h2>
        <ToggleGroup
          aria-label="Direction"
          selectionMode="single"
          size="sm"
          selectedKeys={[direction]}
          onSelectionChange={(keys) => {
            const [value] = [...keys]
            if (!value) return
            pager.reset()
            onDirection(value as "forward" | "backward")
          }}
        >
          <ToggleGroupItem id="backward">Newest first</ToggleGroupItem>
          <ToggleGroupItem id="forward">Oldest first</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {events.isError && <p className="text-sm text-destructive">{events.error.message}</p>}
      <EventsTable events={events.data?.items ?? []} label="Aggregate events" />
      <CursorPager
        cursor={from}
        nextCursor={events.data?.nextCursor?.toString()}
        trail={pager.trail}
        onNavigate={pager.go}
        itemCount={events.data?.items.length}
      />
    </section>
  )
}

export function StreamEventsPane(props: Parameters<typeof ConfiguredStreamEventsPane>[0]) {
  return useSurfaceAvailable("kiroku") ? (
    <ConfiguredStreamEventsPane {...props} />
  ) : (
    <p className="p-4">Raw events: Not configured for this application</p>
  )
}
