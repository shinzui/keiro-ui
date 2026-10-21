import { int64 } from "@keiro-ui/client-core"
import { z } from "zod"

// shibuya-metrics processor records are camelCase and frozen
// (docs/architecture/METRICS.md in mori://shinzui/shibuya). `latency`, `oldestInFlight`, and
// `progress` appear only when the host configures MetricsDetailed; they are absent, not null.

const Idle = z.object({ status: z.literal("idle") }).passthrough()
const Processing = z
  .object({
    status: z.literal("processing"),
    inFlight: z.number(),
    maxConcurrency: z.number(),
    lastActivity: z.string().optional(),
    lastProgress: z.string().optional(),
  })
  .passthrough()
const Paused = z
  .object({
    status: z.literal("paused"),
    pausedAt: z.string(),
    inFlight: z.number().optional(),
    maxConcurrency: z.number().optional(),
    lastProgress: z.string().optional(),
  })
  .passthrough()
const Failed = z
  .object({ status: z.literal("failed"), error: z.string(), timestamp: z.string() })
  .passthrough()
const Stopped = z.object({ status: z.literal("stopped") }).passthrough()

export const ProcessorState = z.discriminatedUnion("status", [
  Idle,
  Processing,
  Paused,
  Failed,
  Stopped,
])
export type ProcessorState = z.output<typeof ProcessorState>

export const ProcessorStats = z.object({ received: int64(), processed: int64(), failed: int64() })
export const BatchStats = z
  .object({
    batchedMessages: z.number(),
    batchesEmitted: z.number(),
    flushTriggered: z.number(),
    partialFailures: z.number(),
    sizeTriggered: z.number(),
    timeoutTriggered: z.number(),
  })
  .passthrough()
export const LatencyHistogram = z.object({
  count: int64(),
  sumSeconds: z.number(),
  buckets: z.array(z.object({ le: z.number(), count: int64() })),
})
export const OldestInFlight = z.object({
  messageId: z.string(),
  startedAt: z.string(),
  ageSeconds: z.number(),
})
export type OldestInFlight = z.output<typeof OldestInFlight>
export const ProgressCursor = z.object({ kind: z.string(), value: z.string() }).passthrough()
export const Progress = z.object({
  latest: ProgressCursor.optional(),
  partitions: z.record(z.string(), ProgressCursor),
  truncated: z.boolean(),
})

export const ProcessorMetrics = z
  .object({
    state: ProcessorState,
    stats: ProcessorStats,
    batch: BatchStats,
    startedAt: z.string(),
    latency: LatencyHistogram.optional(),
    oldestInFlight: OldestInFlight.optional(),
    progress: Progress.optional(),
  })
  .passthrough()
export type ProcessorMetrics = z.output<typeof ProcessorMetrics>

export const ProcessorMap = z.record(z.string(), ProcessorMetrics)
export type ProcessorMap = z.output<typeof ProcessorMap>

export const ReadinessStatus = z
  .object({
    ready: z.boolean(),
    application: z.string(),
    processors: z
      .object({ total: z.number(), healthy: z.number(), failed: z.number(), stuck: z.number() })
      .passthrough(),
    dependencies: z.array(z.unknown()),
  })
  .passthrough()
export type ReadinessStatus = z.output<typeof ReadinessStatus>

export const CombinedHealth = z.object({ status: ReadinessStatus, processors: ProcessorMap })
export type CombinedHealth = z.output<typeof CombinedHealth>

export const Liveness = z.object({ alive: z.boolean() })
export type Liveness = z.output<typeof Liveness>

export const ControlStatus = z.object({ enabled: z.boolean(), operations: z.array(z.string()) })
export type ControlStatus = z.output<typeof ControlStatus>

/**
 * A pause or resume answer (shibuya-metrics/src/Shibuya/Metrics/Control.hs in
 * mori://shinzui/shibuya): the processor's intake state; repeating an operation returns the
 * same body with the original `pausedAt`.
 */
export const ControlResult = z
  .object({
    processor: z.string(),
    state: z.enum(["running", "paused"]),
    pausedAt: z.string().optional(),
  })
  .passthrough()
export type ControlResult = z.output<typeof ControlResult>

/** The flat-envelope codes a control POST can refuse with. */
export type ShibuyaControlRefusal =
  | "control_disabled"
  | "origin_not_allowed"
  | "processor_not_found"
  | "processor_not_controllable"
  | "processor_terminal"
  | "processor_draining"
  | "method_not_allowed"

export interface HealthResult<T> {
  status: number
  body: T
}

/**
 * Updates omit age-only changes, so a screen extrapolates the oldest in-flight age between
 * frames: `ageSeconds + (now − receivedAt) / 1000`.
 */
export function extrapolateAge(
  oldestInFlight: OldestInFlight,
  receivedAt: Date,
  now: Date,
): number {
  return oldestInFlight.ageSeconds + (now.getTime() - receivedAt.getTime()) / 1000
}
