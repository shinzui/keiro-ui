import { queryKeys } from "@keiro-ui/client-core"

/** pgmq's query keys; every key starts with "pgmq". */
export const pgmqKeys = {
  all: () => queryKeys.pgmq(),
  service: () => queryKeys.pgmq("service"),
  queues: () => queryKeys.pgmq("queues"),
  queue: (name: string) => queryKeys.pgmq("queue", name),
  queueMetrics: (name: string) => queryKeys.pgmq("queue-metrics", name),
  allMetrics: () => queryKeys.pgmq("metrics"),
  messages: (queue: string, filter: { limit?: number }) =>
    queryKeys.pgmq("messages", queue, filter),
  message: (queue: string, msgId: bigint) => queryKeys.pgmq("message", queue, msgId.toString()),
  archive: (queue: string, filter: { limit?: number }) => queryKeys.pgmq("archive", queue, filter),
  archivedMessage: (queue: string, msgId: bigint) =>
    queryKeys.pgmq("archived-message", queue, msgId.toString()),
  bindings: (queue?: string) => queryKeys.pgmq("bindings", queue ?? null),
  routingTest: (routingKey: string) => queryKeys.pgmq("routing-test", routingKey),
  notifyThrottles: () => queryKeys.pgmq("notify-throttles"),
  health: (kind: "live" | "ready") => queryKeys.pgmq("health", kind),
}
