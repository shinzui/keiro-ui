import { isApiError, queryKeys, useSurfaceQuery } from "@keiro-ui/client-core"
import {
  type ArchivedMessage,
  type Message,
  type PgmqMessageCursor,
  pgmqKeys,
  type Queue,
  type QueueMetrics,
  usePgmqBindings,
  usePgmqClient,
  usePgmqNotifyThrottles,
  usePgmqQueueMetrics,
  usePgmqQueueMetricsFeed,
  usePgmqRoutingTest,
} from "@keiro-ui/client-pgmq"
import { useMemo } from "react"

// Every pgmq call of the Queues section goes through this file. Pages are one query per URL
// cursor (the cursor lives in `from`); the client core's useCursorPages ("load more") is not
// used here.

const INVENTORY_MS = 5_000
const BROWSE_MS = 10_000

export const DEFAULT_LIMIT = 50

export interface QueueRow {
  queue: Queue
  metrics?: QueueMetrics
}

/**
 * `/queues` joined with `/metrics` on `queue_name`. `/metrics` counts every queue, so the
 * list polls it at the surface default and never opens feed subscriptions.
 */
export function useQueueInventory() {
  const pgmq = usePgmqClient()
  const queues = useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.queues(),
    queryFn: ({ signal }) => pgmq.queues.list(signal),
    poll: INVENTORY_MS,
  })
  const metrics = useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.allMetrics(),
    queryFn: ({ signal }) => pgmq.metrics.all(signal),
    poll: INVENTORY_MS,
  })
  const rows = useMemo<QueueRow[]>(() => {
    const byName = new Map((metrics.data ?? []).map((m) => [m.queue_name, m]))
    return (queues.data ?? []).map((queue) => ({ queue, metrics: byName.get(queue.queue_name) }))
  }, [queues.data, metrics.data])
  return { rows, isPending: queues.isPending, error: queues.error ?? metrics.error }
}

/** The authoritative poll, with the queue's feed writing into the same cache entry. */
export function useQueueMetrics(name: string) {
  const metrics = usePgmqQueueMetrics(name)
  const feed = usePgmqQueueMetricsFeed(name)
  return { metrics, feed }
}

/** One page of the queue's messages at the URL's cursor; a peek, never a lease. */
export function useMessagesPage(queue: string, params: { from?: bigint; limit?: number }) {
  const pgmq = usePgmqClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  const from = params.from as PgmqMessageCursor | undefined
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: queryKeys.pgmq("messages", queue, { limit, from: from?.toString() }),
    queryFn: ({ signal }) => pgmq.messages.page(queue, { from, limit }, signal),
    poll: BROWSE_MS,
  })
}

/** One page of the queue's archive at the URL's cursor. */
export function useArchivePage(queue: string, params: { from?: bigint; limit?: number }) {
  const pgmq = usePgmqClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  const from = params.from as PgmqMessageCursor | undefined
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: queryKeys.pgmq("archive", queue, { limit, from: from?.toString() }),
    queryFn: ({ signal }) => pgmq.archive.page(queue, { from, limit }, signal),
    poll: BROWSE_MS,
  })
}

export type LocatedMessage =
  | { where: "messages"; message: Message }
  | { where: "archive"; message: ArchivedMessage }

/**
 * A message by id: the live queue first, then the archive when the queue answers
 * `message_not_found` (a message archived since the row was listed). `where` forces one table.
 */
export function useQueueMessage(queue: string, msgId: bigint | undefined, where?: "archive") {
  const pgmq = usePgmqClient()
  return useSurfaceQuery<LocatedMessage>({
    surface: "pgmq",
    queryKey: queryKeys.pgmq("located-message", queue, msgId?.toString() ?? null, where ?? null),
    enabled: msgId !== undefined,
    queryFn: async ({ signal }) => {
      const id = msgId as bigint
      if (where === "archive")
        return { where: "archive", message: await pgmq.archive.get(queue, id, signal) }
      try {
        return { where: "messages", message: await pgmq.messages.get(queue, id, signal) }
      } catch (error) {
        if (!isApiError(error, "message_not_found")) throw error
        return { where: "archive", message: await pgmq.archive.get(queue, id, signal) }
      }
    },
    poll: BROWSE_MS,
  })
}

export const useQueueBindings = usePgmqBindings
export const useRoutingTest = usePgmqRoutingTest

/** This queue's notify throttle, when one is configured. */
export function useNotifyThrottle(queue: string) {
  const throttles = usePgmqNotifyThrottles()
  return { ...throttles, data: throttles.data?.find((t) => t.queue_name === queue) }
}

/** A message id from the URL, or undefined when it is not a decimal integer. */
export function messageIdFrom(text: string | undefined): bigint | undefined {
  return text !== undefined && /^\d+$/.test(text) ? BigInt(text) : undefined
}
