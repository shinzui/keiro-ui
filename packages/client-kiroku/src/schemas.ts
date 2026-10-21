import { int64, type Int64, pageSchema } from "@keiro-ui/client-core"
import { z } from "zod"

// kiroku-metrics 0.3.0.1 (mori://shinzui/kiroku docs/guides/building-an-inspection-ui.md,
// docs/user/metrics.md). New fields are snake_case; the event record keeps its published
// camelCase keys plus `original_stream_name`. Unknown fields are ignored (passthrough on
// events), per kiroku's compatibility rule.

/** A stream name, category name, or dead-letter "position:id" token, echoed back as `from`. */
export type KirokuNameCursor = string & { readonly __brand: "KirokuNameCursor" }
/** A global position or stream version, echoed back as `from` on event pages. */
export type KirokuPositionCursor = Int64 & { readonly __kirokuCursor: "position" }

const nameCursor = z.string().transform((value) => value as KirokuNameCursor)
const positionCursor = int64().transform((value) => value as KirokuPositionCursor)

export const StreamInfo = z.object({
  stream_id: int64(),
  name: z.string(),
  category: z.string(),
  version: int64(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  /** Never null; 0 means nothing truncated. */
  truncate_before: int64(),
})
export type StreamInfo = z.output<typeof StreamInfo>

export const KirokuEvent = z
  .object({
    eventId: z.string(),
    eventType: z.string(),
    globalPosition: int64(),
    streamVersion: int64(),
    originalStreamId: int64(),
    originalVersion: int64(),
    original_stream_name: z.string().nullable().optional(),
    causationId: z.string().nullable(),
    correlationId: z.string().nullable(),
    createdAt: z.string(),
    payload: z.unknown(),
    metadata: z.unknown(),
  })
  .passthrough()
export type KirokuEvent = z.output<typeof KirokuEvent>

export const DeadLetterReason = z
  .object({ kind: z.string(), detail: z.string().optional() })
  .passthrough()

export const DeadLetter = z.object({
  dead_letter_id: int64(),
  subscription: z.string(),
  member: z.number(),
  global_position: int64(),
  event_id: z.string(),
  /** Stored JSON, unchanged. */
  reason: z.unknown(),
  reason_summary: z.string(),
  attempt_count: z.number(),
  created_at: z.string(),
})
export type DeadLetter = z.output<typeof DeadLetter>

export const Checkpoint = z.object({
  subscription: z.string(),
  member: z.number(),
  checkpoint_position: int64(),
  updated_at: z.string(),
})
export const CheckpointInventory = z.object({
  /** The greatest global position ever allocated (durable truth). */
  store_position: int64(),
  checkpoints: z.array(Checkpoint),
})
export type CheckpointInventory = z.output<typeof CheckpointInventory>

export const LiveSubscription = z.object({
  subscription: z.string(),
  member: z.number(),
  /** catching_up | live | paused | reconnecting | retrying (additively extensible). */
  phase: z.string(),
  global_position: int64(),
})
export type LiveSubscription = z.output<typeof LiveSubscription>

export const SubscriptionMetrics = z.object({
  last_known_position: int64(),
  /**
   * `global_position − last_known_position`: an upper bound computed by the answering
   * process. keiro-facing screens call head-versus-position differences "global position
   * distance"; this is kiroku's own field and keeps its name.
   */
  lag: int64(),
  db_error_count: z.number(),
  last_stop_reason: z.string().nullable(),
})
export type SubscriptionMetrics = z.output<typeof SubscriptionMetrics>

export const MetricsSnapshot = z.object({
  store: z.object({
    global_position: int64(),
    active_subscribers: z.number(),
    pool_connecting: z.number(),
    pool_ready: z.number(),
    pool_in_use: z.number(),
    pool_established_total: z.number(),
    pool_terminated_total: z.number(),
  }),
  counters: z.record(z.string(), int64()),
  subscriptions: z.record(z.string(), SubscriptionMetrics),
})
export type MetricsSnapshot = z.output<typeof MetricsSnapshot>

export const Capabilities = z
  .object({
    package: z.string(),
    version: z.string().optional(),
    routes: z.record(z.string(), z.boolean()),
    cors: z.object({ enabled: z.boolean() }).passthrough(),
    process_local: z.array(z.string()),
  })
  .passthrough()
export type Capabilities = z.output<typeof Capabilities>

export const Liveness = z.object({ alive: z.boolean() })
export type Liveness = z.output<typeof Liveness>

export const DependencyCheck = z.object({
  name: z.string(),
  healthy: z.boolean(),
  latency_ms: z.number().nullable(),
  error: z.string().nullable(),
})
export const Readiness = z.object({
  ready: z.boolean(),
  lag_ok: z.boolean(),
  no_overflow: z.boolean(),
  dependencies: z.array(DependencyCheck),
})
export type Readiness = z.output<typeof Readiness>

export const CombinedHealth = z.object({ status: Readiness, metrics: MetricsSnapshot })
export type CombinedHealth = z.output<typeof CombinedHealth>

export const Category = z.object({ name: z.string() })
export type Category = z.output<typeof Category>

export const StreamPage = pageSchema(StreamInfo, nameCursor)
export const CategoryPage = pageSchema(Category, nameCursor)
export const DeadLetterPage = pageSchema(DeadLetter, nameCursor)
export const EventPage = pageSchema(KirokuEvent, positionCursor)

/** A health route's answer: its HTTP status (200 or 503) and decoded body. */
export interface HealthResult<T> {
  status: number
  body: T
}
