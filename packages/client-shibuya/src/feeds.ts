import type { Dialect, Frame } from "@keiro-ui/client-core"
import { z } from "zod"

import { ProcessorMap, ProcessorMetrics } from "./schemas"

// shibuya-metrics `/ws` (docs/architecture/METRICS.md): a snapshot of all live processors on
// connect, updates per processor (age-only changes omitted), terminal frames, in-band errors.

/** Subscribe to every processor (default) or a finite set. */
export type ShibuyaSubscription = { processors?: string[] } | undefined

export const ShibuyaSnapshotFrame = z.object({ type: z.literal("snapshot"), metrics: ProcessorMap })
export const ShibuyaUpdateFrame = z.object({
  type: z.literal("update"),
  processor: z.string(),
  metrics: ProcessorMetrics,
})
export const ShibuyaTerminalFrame = z.union([
  z.object({ type: z.literal("terminal"), processor: z.string(), status: z.literal("stopped") }),
  z.object({
    type: z.literal("terminal"),
    processor: z.string(),
    status: z.literal("failed"),
    error: z.string(),
    messageId: z.string().nullable(),
  }),
])

/**
 * `queue_overflow` is followed immediately by a replacement snapshot from the server; the
 * owning query still re-reads `/metrics`. `subscription_limit_exceeded` is a feed error.
 */
export const shibuyaDialect: Dialect<ShibuyaSubscription> = {
  name: "shibuya",
  subscribe: (args): Frame =>
    args?.processors
      ? { type: "subscribe", processors: args.processors }
      : { type: "subscribe_all" },
  unsubscribe: (args) =>
    args?.processors ? { type: "unsubscribe", processors: args.processors } : null,
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
    extra: ["terminal"],
  },
  overflowCodes: ["queue_overflow"],
  isResync: () => false,
}
