import { int64, pageSchema } from "@keiro-ui/client-core"
import { z } from "zod"

import type {
  AggregateListCursor,
  AwakeablesCursor,
  ChildrenCursor,
  JournalCursor,
  ProcessManagerListCursor,
  ProjectionStatusCursor,
  StepsCursor,
  TimerCursor,
  WorkflowListCursor,
} from "./cursors"

// Field names come from keiro's JSON encoders (mori://shinzui/keiro: keiro/src/Keiro/Workflow/
// Inspection.hs, Inspection/Aggregate.hs, ProcessManager/Inspect.hs, Timer/Schema.hs, and
// keiro-ops/src/Keiro/Ops/*.hs). Every object passes unknown fields through, so additive keiro
// changes never break validation. Positions are bigint and keep keiro's vocabulary
// (store_position, visible_store_head, global position distance; ADR-28).

const cursor = <C extends string>() => z.string().transform((value) => value as C)
const timestamp = z.string()
const observedAt = z.object({ observed_at: timestamp })

// --- health ----------------------------------------------------------------------------------

export const HealthStatus = z.enum(["ok", "schema_drift", "unavailable", "inspection_busy"])
export const Health = z
  .object({
    status: z.union([HealthStatus, z.string()]),
    schema_drift: z.array(z.string()).optional(),
    mutations_enabled: z.boolean().optional(),
    message: z.string().optional(),
  })
  .passthrough()
export type Health = z.output<typeof Health>

// --- workflows -------------------------------------------------------------------------------

export const StatusClass = z.enum([
  "running",
  "retrying",
  "sleeping",
  "awaiting",
  "completed",
  "cancelled",
  "failed",
])
export type StatusClass = z.output<typeof StatusClass>

export const WorkflowInstance = z
  .object({
    workflow_name: z.string(),
    workflow_id: z.string(),
    status: z.string(),
    status_class: z.union([StatusClass, z.string()]),
    attempts: z.number(),
    generation: z.number(),
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: timestamp.nullable(),
    next_attempt_at: timestamp.nullable(),
    wake_after: timestamp.nullable(),
    lease_expires_at: timestamp.nullable(),
    leased_by: z.string().nullable(),
    last_error: z.unknown(),
  })
  .passthrough()
export type WorkflowInstance = z.output<typeof WorkflowInstance>

export const JournalEntry = z
  .object({
    event_id: z.string(),
    event_type: z.string(),
    step_name: z.string().nullable().optional(),
    global_position: int64(),
    stream_version: int64(),
    recorded_at: timestamp,
    payload: z.unknown(),
  })
  .passthrough()
export type JournalEntry = z.output<typeof JournalEntry>

export const StepEntry = z
  .object({ step: z.string(), recorded_at: timestamp, result: z.unknown() })
  .passthrough()
export type StepEntry = z.output<typeof StepEntry>

export const ChildWorkflow = z
  .object({
    parent_name: z.string(),
    parent_id: z.string(),
    child_name: z.string(),
    child_id: z.string(),
    await_step: z.string().nullable().optional(),
    status: z.string(),
    result: z.unknown(),
    failure_reason: z.unknown(),
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: timestamp.nullable(),
  })
  .passthrough()
export type ChildWorkflow = z.output<typeof ChildWorkflow>

export const Awakeable = z
  .object({
    awakeable_id: z.string(),
    owner_workflow_name: z.string(),
    owner_workflow_id: z.string(),
    status: z.string(),
    payload: z.unknown(),
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: timestamp.nullable(),
  })
  .passthrough()
export type Awakeable = z.output<typeof Awakeable>

const generation = z.object({ generation: z.number() })

export const WorkflowListPage = pageSchema(
  WorkflowInstance,
  cursor<WorkflowListCursor>(),
  observedAt.partial(),
)
export const JournalPage = pageSchema(
  JournalEntry,
  cursor<JournalCursor>(),
  generation.extend({ observed_at: timestamp.optional() }),
)
export const StepsPage = pageSchema(
  StepEntry,
  cursor<StepsCursor>(),
  generation.extend({ observed_at: timestamp.optional() }),
)
export const ChildrenPage = pageSchema(ChildWorkflow, cursor<ChildrenCursor>(), observedAt)
export const AwakeablesPage = pageSchema(Awakeable, cursor<AwakeablesCursor>(), observedAt)

// --- timers ----------------------------------------------------------------------------------

export const TimerItem = z
  .object({
    timer_id: z.string(),
    process_manager_name: z.string(),
    correlation_id: z.string(),
    fire_at: timestamp,
    payload: z.unknown(),
    status: z.string(),
    attempts: z.number(),
    fired_event_id: z.string().nullable(),
    last_error: z.unknown(),
    /** Present on pending pages only. */
    due_in_seconds: z.number().optional(),
  })
  .passthrough()
export type TimerItem = z.output<typeof TimerItem>

export const TimerPage = pageSchema(TimerItem, cursor<TimerCursor>(), observedAt)
/**
 * `/timer/stuck/list` answers a bare array, without the `observed_at` envelope, and its rows
 * (`timerJson` in keiro-ops/src/Keiro/Ops/Timer.hs) carry no `last_error` key.
 */
export const StuckTimers = z.array(TimerItem.extend({ last_error: z.unknown().optional() }))
export type StuckTimer = z.output<typeof StuckTimers>[number]

// --- projections and shards ------------------------------------------------------------------

export const ProjectionGroupStatus = z
  .object({
    group_id: z.string(),
    query_models: z.array(z.string()),
    lifecycle_phase: z.string(),
    reads_allowed: z.boolean(),
    writes_allowed: z.boolean(),
    serving_epoch: z.number(),
    serving_position_basis: z.string(),
    serving_revision_id: z.string().nullable(),
    serving_applied_position: int64().nullable(),
    candidate_revision_id: z.string().nullable(),
    candidate_rebuild_position: int64().nullable(),
    candidate_rebuild_head: int64().nullable(),
    active_run_id: z.string().nullable(),
    rebuild_started_at: timestamp.nullable(),
    last_promoted_at: timestamp.nullable(),
    failed_at: timestamp.nullable(),
    failure_code: z.string().nullable(),
    failure_detail: z.unknown(),
  })
  .passthrough()
export type ProjectionGroupStatus = z.output<typeof ProjectionGroupStatus>

export const ProjectionStatusPage = pageSchema(
  ProjectionGroupStatus,
  cursor<ProjectionStatusCursor>(),
  z.object({ observed_at: timestamp.optional(), visible_store_head: int64().optional() }),
)

export const PositionMember = z
  .object({
    subscription: z.string(),
    member: z.number(),
    checkpoint_position: int64(),
    checkpoint_updated_at: timestamp.optional(),
    global_position_distance: int64().nullable().optional(),
  })
  .passthrough()
export const ProjectionPosition = z
  .object({
    subscription: z.string(),
    store_position: int64(),
    visible_store_head: int64(),
    members: z.array(PositionMember),
    minimum_checkpoint_position: int64().nullable(),
    maximum_global_position_distance: int64().nullable(),
  })
  .passthrough()
export type ProjectionPosition = z.output<typeof ProjectionPosition>

export const ShardSummary = z
  .object({
    subscription: z.string(),
    buckets_total: z.number(),
    buckets_live: z.number(),
    live_owners: z.number(),
  })
  .passthrough()
export const ShardList = z
  .object({ observed_at: timestamp, items: z.array(ShardSummary) })
  .passthrough()
export const ShardStatus = z
  .object({
    observed_at: timestamp,
    subscription: z.string(),
    shard_counts: z.array(z.unknown()),
    ownership: z.array(z.object({ bucket: z.number() }).passthrough()),
  })
  .passthrough()
export type ShardStatus = z.output<typeof ShardStatus>

// --- streams, outbox, inbox ------------------------------------------------------------------

export const StreamEvent = z
  .object({
    event_id: z.string(),
    event_type: z.string(),
    global_position: int64(),
    stream_version: int64(),
    original_stream_id: int64(),
    original_version: int64(),
    causation_id: z.string().nullable(),
    correlation_id: z.string().nullable(),
    created_at: timestamp,
    metadata: z.unknown(),
    payload: z.unknown(),
  })
  .passthrough()
export const StreamShow = z.object({ events: z.array(StreamEvent) }).passthrough()
export const StreamSubscriptions = z
  .object({
    store_position: int64(),
    visible_store_head: int64(),
    checkpoints: z.array(
      z
        .object({
          subscription: z.string(),
          member: z.number(),
          checkpoint_position: int64(),
          global_position_distance: int64().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough()
export type StreamSubscriptions = z.output<typeof StreamSubscriptions>

export const Backlog = z.object({ metric: z.string(), count: z.number() }).passthrough()
export const OutboxRow = z.object({ outbox_id: z.unknown(), status: z.string() }).passthrough()
export const InboxRow = z
  .object({ source: z.string(), message_id: z.string(), status: z.string() })
  .passthrough()

// --- aggregates ------------------------------------------------------------------------------

export const AggregateType = z
  .object({
    name: z.string(),
    category: z.string(),
    snapshots_configured: z.boolean(),
    snapshot_policy: z.string(),
  })
  .passthrough()
export const AggregateTypes = z.object({ items: z.array(AggregateType) }).passthrough()
export type AggregateType = z.output<typeof AggregateType>

export const AggregateSummary = z
  .object({
    aggregate_id: z.string(),
    stream_name: z.string(),
    stream_version: int64(),
    created_at: timestamp,
    deleted_at: timestamp.nullable(),
    truncate_before: int64(),
  })
  .passthrough()
export type AggregateSummary = z.output<typeof AggregateSummary>

export const AggregateListPage = pageSchema(
  AggregateSummary,
  cursor<AggregateListCursor>(),
  z.object({ name: z.string(), category: z.string(), skipped: z.number() }),
)

export const Hydration = z
  .object({
    source: z.enum(["snapshot", "full_replay"]),
    snapshot_version: int64().optional(),
    reason: z.string().optional(),
    miss: z.string().optional(),
    detail: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export const SnapshotStatus = z
  .object({
    status: z.enum(["present", "absent"]),
    observed_at: timestamp.optional(),
    configured: z.object({ policy: z.string() }).passthrough().nullable(),
    stored: z
      .object({
        stream_version: int64(),
        compatibility: z.string(),
        events_since: z.number().nullable().optional(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough()
export type SnapshotStatus = z.output<typeof SnapshotStatus>

export const AggregateDetail = z
  .object({
    name: z.string(),
    category: z.string(),
    aggregate_id: z.string(),
    stream_name: z.string(),
    stream_version: int64(),
    state_version: int64().nullable(),
    created_at: timestamp,
    deleted_at: timestamp.nullable(),
    truncate_before: int64(),
    hydration: Hydration.nullable(),
    state_label: z.string().nullable(),
    state: z.unknown(),
    snapshot: SnapshotStatus,
    history: z
      .object({ owner: z.string(), stream_name: z.string(), head_version: int64() })
      .passthrough(),
  })
  .passthrough()
export type AggregateDetail = z.output<typeof AggregateDetail>

export const AggregateSnapshot = SnapshotStatus.extend({
  name: z.string(),
  aggregate_id: z.string(),
  stream_name: z.string(),
  stream_version: int64(),
})

// --- process managers ------------------------------------------------------------------------

export const ProcessManagerSummary = z
  .object({
    correlation_id: z.string(),
    stream_name: z.string(),
    stream_version: int64(),
    created_at: timestamp,
    deleted_at: timestamp.nullable(),
    truncate_before: int64(),
  })
  .passthrough()
export type ProcessManagerSummary = z.output<typeof ProcessManagerSummary>

export const ProcessManagerListPage = pageSchema(
  ProcessManagerSummary,
  cursor<ProcessManagerListCursor>(),
  z.object({ skipped: z.number() }),
)

export const ProcessManagerDetail = z
  .object({
    name: z.string(),
    correlation_id: z.string(),
    journal_stream_name: z.string(),
    observed_head_version: int64(),
    stream_version: int64(),
    state_version: int64().nullable(),
    state_label: z.string().nullable(),
    state: z.unknown(),
    hydration: Hydration.nullable(),
    last_reaction: z
      .object({
        event_id: z.string(),
        event_type: z.string(),
        global_position: int64(),
        stream_version: int64(),
        recorded_at: timestamp,
        provenance_status: z.string(),
        provenance: z.unknown(),
      })
      .passthrough()
      .nullable(),
    pending_timers: TimerPage,
    waiting_for: z.array(z.object({ input: z.string(), target_state: z.string() }).passthrough()),
    observed_at: timestamp,
  })
  .passthrough()
export type ProcessManagerDetail = z.output<typeof ProcessManagerDetail>

// --- names the screen plans use (docs/plans/15-..., 16-...) ---------------------------------

export type WorkflowHeader = WorkflowInstance
export type WorkflowJournalEntry = JournalEntry
export type WorkflowStep = StepEntry
export type WorkflowChild = ChildWorkflow
export type WorkflowAwakeable = Awakeable
export type WorkflowStatusClass = StatusClass
export type AggregateView = AggregateDetail
export type AggregateTypes = z.output<typeof AggregateTypes>
export type AggregateListPage = z.output<typeof AggregateListPage>
export type PendingTimerPage = z.output<typeof TimerPage>
export type ProcessManagerInstancePage = z.output<typeof ProcessManagerListPage>
export type ProcessManagerInstanceView = ProcessManagerDetail
