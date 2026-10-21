import { type Dialect, type Frame, int64 } from "@keiro-ui/client-core"
import { z } from "zod"

import { KirokuEvent, MetricsSnapshot } from "./schemas"

// kiroku's two WebSocket channels (docs/user/metrics.md, "Live push over WebSocket").

export interface KirokuEventsSubscription {
  /** Omit for live-from-now; given, the server replays history after it first. */
  fromPosition?: bigint
  category?: string
}

export const EventStreamStartedFrame = z.object({
  type: z.literal("event_stream_started"),
  from_position: int64(),
})
export const EventFrame = z.object({ type: z.literal("event"), event: KirokuEvent })
export const KirokuErrorFrame = z.object({
  type: z.literal("error"),
  code: z.string().optional(),
  message: z.string(),
})

/**
 * `/ws/events`. Overflow is `event_stream_overflowed`; its message names a dropped batch count
 * but carries no structured field, so it is displayed, never parsed. Recovery re-reads
 * `/events?from=<last seen>`.
 */
export const kirokuEventsDialect: Dialect<KirokuEventsSubscription> = {
  name: "kiroku-events",
  subscribe: ({ fromPosition, category }) => {
    const frame: Frame = { type: "subscribe_events" }
    if (fromPosition !== undefined) frame.from_position = fromPosition
    if (category) frame.category = category
    return frame
  },
  unsubscribe: () => ({ type: "unsubscribe_events" }),
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "event_stream_started",
    delta: "event",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
  },
  overflowCodes: ["event_stream_overflowed"],
  isResync: () => false,
}

export const MetricsSnapshotFrame = z.object({
  type: z.literal("snapshot"),
  metrics: MetricsSnapshot,
})

/**
 * `/ws/metrics`: a snapshot on connect and periodically; `subscribe_metrics` requests a fresh
 * snapshot (sent for explicitness), `unsubscribe_metrics` stops pushes. Every frame is a full
 * snapshot, so the "delta" is a snapshot too; a reconnect is the only resync.
 */
export const kirokuMetricsDialect: Dialect<void> = {
  name: "kiroku-metrics",
  subscribe: () => ({ type: "subscribe_metrics" }),
  unsubscribe: () => ({ type: "unsubscribe_metrics" }),
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
  },
  overflowCodes: [],
  isResync: () => false,
}
