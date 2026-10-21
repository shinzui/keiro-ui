import { int64, type Int64, pageSchema } from "@keiro-ui/client-core"
import { z } from "zod"

// Mirrors of the OpenAPI components in openapi/pgmq-inspect.openapi.json (kept honest by
// test/openapi-parity.test.ts). Message ids are int64 and may exceed 2^53.

/** A message id, echoed back as `from` on message and archive pages. */
export type PgmqMessageCursor = Int64 & { readonly __pgmqCursor: "message" }
const messageCursor = int64().transform((value) => value as PgmqMessageCursor)

export const Queue = z.object({
  queue_name: z.string(),
  is_partitioned: z.boolean(),
  is_unlogged: z.boolean(),
  created_at: z.string(),
})
export type Queue = z.output<typeof Queue>

export const Message = z.object({
  msg_id: int64(),
  /** Typed int64 by the OpenAPI document, although it is a small attempt counter. */
  read_ct: int64(),
  enqueued_at: z.string(),
  last_read_at: z.string().nullable(),
  vt: z.string(),
  message: z.unknown(),
  headers: z.unknown(),
})
export type Message = z.output<typeof Message>

export const ArchivedMessage = Message.extend({ archived_at: z.string() })
export type ArchivedMessage = z.output<typeof ArchivedMessage>

export const QueueMetrics = z.object({
  queue_name: z.string(),
  /** Total rows ("total" on screen, never "depth" alone). */
  queue_length: int64(),
  /** Rows readable now ("visible"). */
  queue_visible_length: int64(),
  newest_msg_age_sec: z.number().nullable(),
  oldest_msg_age_sec: z.number().nullable(),
  /** The sequence high-water mark: a lifetime counter, not a size. */
  total_messages: int64(),
  scrape_time: z.string(),
  /** null means unknown. */
  default_partition_length: int64().nullable(),
})
export type QueueMetrics = z.output<typeof QueueMetrics>

export const TopicBinding = z.object({
  pattern: z.string(),
  queue_name: z.string(),
  bound_at: z.string(),
  compiled_regex: z.string(),
})
export type TopicBinding = z.output<typeof TopicBinding>

export const RoutingMatch = z.object({
  pattern: z.string(),
  queue_name: z.string(),
  compiled_regex: z.string(),
})
export type RoutingMatch = z.output<typeof RoutingMatch>

export const NotifyInsertThrottle = z.object({
  queue_name: z.string(),
  throttle_interval_ms: z.number(),
  last_notified_at: z.string().nullable(),
})
export type NotifyInsertThrottle = z.output<typeof NotifyInsertThrottle>

export const ServiceDescriptor = z.object({
  service: z.string(),
  version: z.string(),
  websocket_path: z.string(),
  openapi_path: z.string(),
})
export type ServiceDescriptor = z.output<typeof ServiceDescriptor>

export const Liveness = z.object({ alive: z.boolean() })
export type Liveness = z.output<typeof Liveness>

export const DependencyCheck = z.object({
  name: z.string(),
  healthy: z.boolean(),
  latency_ms: int64().nullable(),
  error: z.string().nullable(),
})
export const Readiness = z.object({ ready: z.boolean(), checks: z.array(DependencyCheck) })
export type Readiness = z.output<typeof Readiness>

export const MessagePage = pageSchema(Message, messageCursor)
export const ArchivedMessagePage = pageSchema(ArchivedMessage, messageCursor)

export interface HealthResult<T> {
  status: number
  body: T
}

/** zod mirrors of the OpenAPI component schemas, by component name (the parity test reads this). */
export const componentMirrors = {
  Queue,
  Message,
  ArchivedMessage,
  QueueMetrics,
  TopicBinding,
  RoutingMatch,
  NotifyInsertThrottle,
  ServiceDescriptor,
  Liveness,
  Readiness,
  DependencyCheck,
} as const
