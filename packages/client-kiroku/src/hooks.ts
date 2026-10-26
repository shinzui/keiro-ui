import { useSurfaceAvailable } from "@keiro-ui/client-core"
import {
  type FeedStatus,
  type Frame,
  useCursorPages,
  useFeedSubscription,
  useSurfaceQuery,
  webSocketUrlFor,
} from "@keiro-ui/client-core"
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, createElement, type ReactNode, useContext, useMemo, useState } from "react"

import { createKirokuClient, type KirokuClient } from "./client"
import {
  EventFrame,
  kirokuEventsDialect,
  kirokuMetricsDialect,
  MetricsSnapshotFrame,
} from "./feeds"
import { kirokuKeys } from "./query-keys"
import type {
  Category,
  DeadLetter,
  KirokuEvent,
  KirokuNameCursor,
  KirokuPositionCursor,
  StreamInfo,
} from "./schemas"

const KirokuClientContext = createContext<KirokuClient | null>(null)

/** Provides the kiroku client; the application builds it from the active connection profile. */
export function KirokuClientProvider(props: { client: KirokuClient; children: ReactNode }) {
  return createElement(KirokuClientContext.Provider, { value: props.client }, props.children)
}

export function useKirokuClient(): KirokuClient {
  const client = useContext(KirokuClientContext)
  if (!client) throw new Error("useKirokuClient requires <KirokuClientProvider>")
  return client
}

const BROWSE_MS = 10_000
const STATE_MS = 5_000

// --- reads ---------------------------------------------------------------------------------

export function useKirokuCapabilities() {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.capabilities(),
    queryFn: ({ signal }) => client.capabilities(signal),
    poll: false,
  })
}

export function useKirokuMetrics() {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.metrics(),
    queryFn: ({ signal }) => client.metrics.all(signal),
    poll: STATE_MS,
  })
}

type HealthKind = "live" | "ready" | "combined"
type HealthOf<K extends HealthKind> = Awaited<ReturnType<KirokuClient["health"][K]>>

/** `{status, body}` for 200 and 503 alike: a not-ready answer carries the diagnostic body. */
export function useKirokuHealth<K extends HealthKind = "ready">(kind?: K) {
  const client = useKirokuClient()
  const which = (kind ?? "ready") as K
  return useSurfaceQuery<HealthOf<K>>({
    surface: "kiroku",
    queryKey: kirokuKeys.health(which),
    queryFn: ({ signal }) => client.health[which](signal) as Promise<HealthOf<K>>,
    poll: STATE_MS,
  })
}

export function useKirokuLiveSubscriptions(name?: string) {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.liveSubscriptions(name),
    queryFn: ({ signal }) =>
      name ? client.subscriptions.liveOne(name, signal) : client.subscriptions.live(signal),
    poll: STATE_MS,
  })
}

export function useKirokuCheckpoints() {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.checkpoints(),
    queryFn: ({ signal }) => client.checkpoints.inventory(signal),
    poll: STATE_MS,
  })
}

export function useKirokuDeadLetters(
  subscription: string,
  filter: { member?: number; limit?: number } = {},
) {
  const client = useKirokuClient()
  return useCursorPages<DeadLetter, KirokuNameCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.deadLetters(subscription, filter),
    fetchPage: (from, signal) => client.deadLetters.page(subscription, { ...filter, from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuStreams(
  filter: { category?: string; prefix?: string; limit?: number } = {},
) {
  const client = useKirokuClient()
  return useCursorPages<StreamInfo, KirokuNameCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.streams(filter),
    fetchPage: (from, signal) => client.streams.page({ ...filter, from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuStream(name: string) {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.stream(name),
    queryFn: ({ signal }) => client.streams.get(name, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuStreamEvents(
  name: string,
  params: { from?: bigint; direction?: "forward" | "backward"; limit?: number } = {},
) {
  const client = useKirokuClient()
  const { from, ...filter } = params
  return useCursorPages<KirokuEvent, KirokuPositionCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.streamEvents(name, { ...filter, from: from?.toString() }),
    fetchPage: (cursor, signal) =>
      client.streams.events(name, { ...filter, from: cursor ?? from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuCategories(filter: { limit?: number } = {}) {
  const client = useKirokuClient()
  return useCursorPages<Category, KirokuNameCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.categories(filter),
    fetchPage: (from, signal) => client.categories.page({ ...filter, from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuCategoryEvents(
  name: string,
  params: { from?: bigint; limit?: number } = {},
) {
  const client = useKirokuClient()
  const { from, ...filter } = params
  return useCursorPages<KirokuEvent, KirokuPositionCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.categoryEvents(name, { ...filter, from: from?.toString() }),
    fetchPage: (cursor, signal) =>
      client.categories.events(name, { ...filter, from: cursor ?? from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuAllEvents(
  params: { from?: bigint; direction?: "forward" | "backward"; limit?: number } = {},
) {
  const client = useKirokuClient()
  const { from, ...filter } = params
  return useCursorPages<KirokuEvent, KirokuPositionCursor>({
    surface: "kiroku",
    queryKey: kirokuKeys.allEvents({ ...filter, from: from?.toString() }),
    fetchPage: (cursor, signal) => client.events.all({ ...filter, from: cursor ?? from }, signal),
    poll: BROWSE_MS,
  })
}

export function useKirokuEvent(id: string) {
  const client = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.event(id),
    queryFn: ({ signal }) => client.events.get(id, signal),
    poll: false,
  })
}

// --- feeds ---------------------------------------------------------------------------------

export type TailStatus = "idle" | "connecting" | "live" | "reconnecting" | "error"

function tailStatus(feed: FeedStatus, enabled: boolean, errored: boolean): TailStatus {
  if (!enabled) return "idle"
  if (errored) return "error"
  if (feed === "open") return "live"
  if (feed === "closed") return "idle"
  return feed
}

function lastPosition(events: KirokuEvent[] | undefined): bigint | undefined {
  return events?.length ? events[events.length - 1]!.globalPosition : undefined
}

/** Inserts by global position, ignoring duplicates, keeping the newest `limit` events. */
function mergeEvents(
  current: KirokuEvent[],
  incoming: KirokuEvent[],
  limit: number,
): KirokuEvent[] {
  const byPosition = new Map(current.map((event) => [event.globalPosition, event]))
  for (const event of incoming) byPosition.set(event.globalPosition, event)
  const merged = [...byPosition.values()].toSorted((a, b) =>
    a.globalPosition < b.globalPosition ? -1 : 1,
  )
  return merged.length > limit ? merged.slice(merged.length - limit) : merged
}

/**
 * A live tail of the `$all` log (or one category). Events live in the query cache under
 * `kirokuKeys.tail(...)`; pushed `event` frames are appended. On `event_stream_overflowed`
 * (or any reconnect) the tail query re-reads forward from the last seen global position
 * until the cursor is absent, so dropped events are recovered from the poll path (ADR-3).
 */
export function useKirokuEventTail(options: {
  enabled?: boolean
  /** Omit to tail live from now. */
  fromPosition?: bigint
  category?: string
  limit?: number
  onOverflow?(frame: Frame): void
  onError?(frame: Frame): void
}): { status: TailStatus; events: KirokuEvent[] } {
  const client = useKirokuClient()
  const queryClient = useQueryClient()
  const { category, fromPosition, onOverflow, onError } = options
  const limit = options.limit ?? 500
  const available = useSurfaceAvailable("kiroku")
  const enabled = available && options.enabled !== false
  const key = useMemo(
    () => kirokuKeys.tail({ category, fromPosition: fromPosition?.toString() }),
    [category, fromPosition],
  )
  const [errored, setErrored] = useState(false)

  // The authoritative catch-up read: everything after the last event held (or after
  // fromPosition), forward, until the cursor is absent.
  const tail = useQuery({
    queryKey: key,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const held = queryClient.getQueryData<KirokuEvent[]>(key) ?? []
      const from = lastPosition(held) ?? fromPosition
      if (from === undefined) return held
      const readPage = (cursor: bigint) =>
        category
          ? client.categories.events(category, { from: cursor, limit: 1000 }, signal)
          : client.events.all({ from: cursor, limit: 1000 }, signal)
      // Each page's cursor is the next request's `from`, so the reads chain.
      const catchUp = async (cursor: bigint, collected: KirokuEvent[]): Promise<KirokuEvent[]> => {
        const page = await readPage(cursor)
        const merged = mergeEvents(collected, page.items, limit)
        return page.nextCursor === undefined ? merged : catchUp(page.nextCursor, merged)
      }
      const collected = await catchUp(from, held)
      // Merge into whatever the feed appended meanwhile; never overwrite pushed events.
      return mergeEvents(queryClient.getQueryData<KirokuEvent[]>(key) ?? [], collected, limit)
    },
  })

  const subscriptions = useMemo(() => [{ fromPosition, category }], [fromPosition, category])
  const feed = useFeedSubscription({
    enabled,
    url: webSocketUrlFor(client.http.baseUrl, "/ws/events"),
    dialect: kirokuEventsDialect,
    subscriptions,
    invalidate: key,
    applyToCache: (cache: QueryClient, frame, kind) => {
      if (kind !== "delta") return
      const parsed = EventFrame.safeParse(frame)
      if (!parsed.success) return
      setErrored(false)
      cache.setQueryData<KirokuEvent[]>(key, (current) =>
        mergeEvents(current ?? [], [parsed.data.event], limit),
      )
    },
    onResync: (reason) => {
      if (reason.frame) onOverflow?.(reason.frame)
    },
    onError: (frame) => {
      setErrored(true)
      onError?.(frame)
    },
  })

  return { status: tailStatus(feed.status, enabled, errored), events: tail.data ?? [] }
}

/** Writes each `/ws/metrics` snapshot into the cache entry behind `useKirokuMetrics()`. */
export function useKirokuMetricsFeed(options: { enabled?: boolean } = {}): { status: FeedStatus } {
  const client = useKirokuClient()
  return useFeedSubscription({
    enabled: options.enabled,
    url: webSocketUrlFor(client.http.baseUrl, "/ws/metrics"),
    dialect: kirokuMetricsDialect,
    subscriptions: [undefined],
    invalidate: kirokuKeys.metrics(),
    applyToCache: (cache, frame) => {
      const parsed = MetricsSnapshotFrame.safeParse(frame)
      if (parsed.success) cache.setQueryData(kirokuKeys.metrics(), parsed.data.metrics)
    },
  })
}

export { createKirokuClient }
