import {
  type FeedStatus,
  useCursorPages,
  useFeedSubscription,
  useSurfaceQuery,
  webSocketUrlFor,
} from "@keiro-ui/client-core"
import { createContext, createElement, type ReactNode, useContext, useMemo, useState } from "react"

import type { PgmqClient } from "./client"
import { PgmqSnapshotFrame, PgmqUpdateFrame, pgmqMetricsDialect } from "./feeds"
import { pgmqKeys } from "./query-keys"
import type { ArchivedMessage, Message, PgmqMessageCursor } from "./schemas"

const PgmqClientContext = createContext<PgmqClient | null>(null)

export function PgmqClientProvider(props: { client: PgmqClient; children: ReactNode }) {
  return createElement(PgmqClientContext.Provider, { value: props.client }, props.children)
}

export function usePgmqClient(): PgmqClient {
  const client = useContext(PgmqClientContext)
  if (!client) throw new Error("usePgmqClient requires <PgmqClientProvider>")
  return client
}

const METRICS_MS = 5_000
const PAGE_MS = 10_000
const STATE_MS = 5_000

export function usePgmqService() {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.service(),
    queryFn: ({ signal }) => client.service(signal),
    poll: false,
  })
}

export function usePgmqQueues() {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.queues(),
    queryFn: ({ signal }) => client.queues.list(signal),
    poll: PAGE_MS,
  })
}

export function usePgmqQueue(name: string) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.queue(name),
    queryFn: ({ signal }) => client.queues.get(name, signal),
    poll: PAGE_MS,
  })
}

export function usePgmqQueueMetrics(name: string) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.queueMetrics(name),
    queryFn: ({ signal }) => client.queues.metrics(name, signal),
    poll: METRICS_MS,
  })
}

export function usePgmqAllMetrics() {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.allMetrics(),
    queryFn: ({ signal }) => client.metrics.all(signal),
    poll: METRICS_MS,
  })
}

export function usePgmqMessages(queue: string, filter: { limit?: number } = {}) {
  const client = usePgmqClient()
  return useCursorPages<Message, PgmqMessageCursor>({
    surface: "pgmq",
    queryKey: pgmqKeys.messages(queue, filter),
    fetchPage: (from, signal) => client.messages.page(queue, { ...filter, from }, signal),
    poll: PAGE_MS,
  })
}

export function usePgmqMessage(queue: string, msgId: bigint) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.message(queue, msgId),
    queryFn: ({ signal }) => client.messages.get(queue, msgId, signal),
    poll: PAGE_MS,
  })
}

export function usePgmqArchive(queue: string, filter: { limit?: number } = {}) {
  const client = usePgmqClient()
  return useCursorPages<ArchivedMessage, PgmqMessageCursor>({
    surface: "pgmq",
    queryKey: pgmqKeys.archive(queue, filter),
    fetchPage: (from, signal) => client.archive.page(queue, { ...filter, from }, signal),
    poll: PAGE_MS,
  })
}

export function usePgmqArchivedMessage(queue: string, msgId: bigint) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.archivedMessage(queue, msgId),
    queryFn: ({ signal }) => client.archive.get(queue, msgId, signal),
    poll: false,
  })
}

export function usePgmqBindings(queue: string) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.bindings(queue),
    queryFn: ({ signal }) => client.bindings.forQueue(queue, signal),
    poll: PAGE_MS,
  })
}

export function usePgmqAllBindings() {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.bindings(),
    queryFn: ({ signal }) => client.bindings.all(signal),
    poll: PAGE_MS,
  })
}

export function usePgmqRoutingTest(routingKey: string, options: { enabled?: boolean } = {}) {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.routingTest(routingKey),
    queryFn: ({ signal }) => client.routing.test(routingKey, signal),
    enabled: options.enabled !== false && routingKey.length > 0,
    poll: false,
  })
}

export function usePgmqNotifyThrottles() {
  const client = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.notifyThrottles(),
    queryFn: ({ signal }) => client.notify.throttles(signal),
    poll: PAGE_MS,
  })
}

/** `{status, body}` for 200 and 503 alike. */
export function usePgmqHealth<K extends "live" | "ready" = "ready">(kind?: K) {
  const client = usePgmqClient()
  const which = (kind ?? "ready") as K
  type Result = Awaited<ReturnType<PgmqClient["health"][K]>>
  return useSurfaceQuery<Result>({
    surface: "pgmq",
    queryKey: pgmqKeys.health(which),
    queryFn: ({ signal }) => client.health[which](signal) as Promise<Result>,
    poll: STATE_MS,
  })
}

/**
 * Writes pushed `snapshot` and `update` metrics into `usePgmqQueueMetrics(queue)`'s entry
 * (screens read the metrics from that query); an `overflow` re-reads it.
 */
export function usePgmqQueueMetricsFeed(
  queue: string,
  options: { enabled?: boolean } = {},
): { status: FeedStatus; source?: "poll" | "notify"; push?: boolean } {
  const client = usePgmqClient()
  const [last, setLast] = useState<{ source?: "poll" | "notify"; push?: boolean }>({})
  const subscriptions = useMemo(() => [{ queue }], [queue])
  const { status } = useFeedSubscription({
    enabled: options.enabled,
    url: webSocketUrlFor(client.http.baseUrl, "/ws"),
    dialect: pgmqMetricsDialect,
    subscriptions,
    invalidate: pgmqKeys.queueMetrics(queue),
    applyToCache: (cache, frame, kind) => {
      if (kind === "snapshot") {
        const parsed = PgmqSnapshotFrame.safeParse(frame)
        if (!parsed.success || parsed.data.queue !== queue) return
        cache.setQueryData(pgmqKeys.queueMetrics(queue), parsed.data.metrics)
        setLast((prev) => ({ ...prev, push: parsed.data.push }))
      } else if (kind === "delta") {
        const parsed = PgmqUpdateFrame.safeParse(frame)
        if (!parsed.success || parsed.data.queue !== queue) return
        cache.setQueryData(pgmqKeys.queueMetrics(queue), parsed.data.metrics)
        setLast((prev) => ({ ...prev, source: parsed.data.source }))
      }
    },
  })
  return { status, ...last }
}
