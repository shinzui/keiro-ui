import type { Dialect } from "@keiro-ui/client-core"
import { z } from "zod"

import { QueueMetrics } from "./schemas"

// pgmq-inspect's `/ws` (docs/user/queue-inspection.md in mori://shinzui/pgmq-hs): metrics only,
// never messages.

export const PgmqSnapshotFrame = z.object({
  type: z.literal("snapshot"),
  queue: z.string(),
  metrics: QueueMetrics,
  push: z.boolean(),
})
export const PgmqUpdateFrame = z.object({
  type: z.literal("update"),
  queue: z.string(),
  metrics: QueueMetrics,
  source: z.enum(["poll", "notify"]),
})
/** `queue: null` marks a connection-level error (overflow is one). */
export const PgmqErrorFrame = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
  queue: z.string().nullable(),
})

export const pgmqMetricsDialect: Dialect<{ queue: string }> = {
  name: "pgmq-metrics",
  subscribe: ({ queue }) => ({ type: "subscribe", queue }),
  unsubscribe: ({ queue }) => ({ type: "unsubscribe", queue }),
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
  },
  overflowCodes: ["overflow"],
  isResync: () => false,
}
