import { createHttpClient, type HttpClient } from "@keiro-ui/client-core"
import type { z } from "zod"

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
import { classifyError } from "./errors"
import { commandRoute, type Flags } from "./route"
import {
  AggregateDetail,
  AggregateListPage,
  AggregateSnapshot,
  AggregateTypes,
  AwakeablesPage,
  Backlog,
  ChildrenPage,
  Health,
  InboxRow,
  JournalPage,
  OutboxRow,
  ProcessManagerDetail,
  ProcessManagerListPage,
  ProjectionPosition,
  ProjectionStatusPage,
  ShardList,
  ShardStatus,
  StepsPage,
  StreamShow,
  StreamSubscriptions,
  StuckTimers,
  TimerPage,
  WorkflowInstance,
  WorkflowListPage,
} from "./schemas"

/** Page sizes are 1–500 everywhere; anything else is refused before sending. */
function checkLimit(limit: number | undefined): number | undefined {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
    throw new RangeError(`keiro limit must be 1–500, got ${limit}`)
  }
  return limit
}

export interface WorkflowListFilters {
  status_class?: readonly string[]
  workflow_name?: string
  created_since?: string
  created_before?: string
  updated_since?: string
  updated_before?: string
  ordering?: string
  limit?: number
  after?: WorkflowListCursor
}

const workflowPath = (kind: string) => ["wf", "inspect", kind]

export function createKeiroClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const http: HttpClient = createHttpClient({
    surface: "keiro",
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  })

  /** A GET over the command tree, validated, with keiro's typed errors. */
  async function read<S extends z.ZodTypeAny>(
    schema: S,
    words: string[],
    positionals: string[] = [],
    flags: Flags = {},
    signal?: AbortSignal,
  ): Promise<z.output<S>> {
    const route = commandRoute(words, positionals, flags)
    try {
      return schema.parse(await http.get(route.path, { query: route.query, signal }))
    } catch (error) {
      throw classifyError(error, route.word)
    }
  }

  return {
    http,
    health: {
      /** 503 bodies (`schema_drift`, `unavailable`, `inspection_busy`) are the health answer, not a failure. */
      get: async (signal?: AbortSignal) =>
        Health.parse(await http.get("/health", { okStatuses: [200, 503], signal })),
    },
    workflows: {
      list: (filters: WorkflowListFilters = {}, signal?: AbortSignal) =>
        read(
          WorkflowListPage,
          workflowPath("list"),
          [],
          { ...filters, limit: checkLimit(filters.limit) },
          signal,
        ),
      header: (name: string, id: string, signal?: AbortSignal) =>
        read(WorkflowInstance, workflowPath("header"), [name, id], {}, signal),
      journal: (
        name: string,
        id: string,
        query: { after?: JournalCursor; limit?: number; generation?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          JournalPage,
          workflowPath("journal"),
          [name, id],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      steps: (
        name: string,
        id: string,
        query: { after?: StepsCursor; limit?: number; generation?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          StepsPage,
          workflowPath("steps"),
          [name, id],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      children: (
        name: string,
        id: string,
        query: { after?: ChildrenCursor; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          ChildrenPage,
          workflowPath("children"),
          [name, id],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      awakeables: (
        name: string,
        id: string,
        query: { after?: AwakeablesCursor; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          AwakeablesPage,
          workflowPath("awakeables"),
          [name, id],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
    },
    timers: {
      pending: (
        filters: {
          manager?: string
          correlation?: string
          after?: TimerCursor
          limit?: number
        } = {},
        signal?: AbortSignal,
      ) =>
        read(
          TimerPage,
          ["timer", "pending", "list"],
          [],
          { ...filters, limit: checkLimit(filters.limit) },
          signal,
        ),
      /** A bare array (no `observed_at` envelope, no `due_in_seconds`). */
      stuck: (filters: { min_age?: string; min_attempts?: number } = {}, signal?: AbortSignal) =>
        read(StuckTimers, ["timer", "stuck", "list"], [], filters, signal),
    },
    projections: {
      status: (
        query: { after?: ProjectionStatusCursor; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          ProjectionStatusPage,
          ["projection", "status"],
          [],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      position: (query: { subscription: string }, signal?: AbortSignal) =>
        read(ProjectionPosition, ["projection", "position"], [], query, signal),
    },
    shards: {
      list: (signal?: AbortSignal) => read(ShardList, ["shard", "list"], [], {}, signal),
      status: (query: { subscription: string }, signal?: AbortSignal) =>
        read(ShardStatus, ["shard", "status"], [], query, signal),
    },
    streams: {
      show: (
        stream: string,
        query: { from?: bigint | number; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        read(
          StreamShow,
          ["stream", "show"],
          [stream],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      causation: (eventId: string, signal?: AbortSignal) =>
        read(StreamShow, ["stream", "causation"], [eventId], {}, signal),
      subscriptions: (signal?: AbortSignal) =>
        read(StreamSubscriptions, ["stream", "subscriptions"], [], {}, signal),
    },
    outbox: {
      backlog: (signal?: AbortSignal) => read(Backlog, ["outbox", "backlog"], [], {}, signal),
      list: (
        query: { source: string; status?: string; destination?: string; limit?: number },
        signal?: AbortSignal,
      ) => read(OutboxRow.array(), ["outbox", "list"], [], query, signal),
      show: (id: string, signal?: AbortSignal) =>
        read(OutboxRow, ["outbox", "show"], [id], {}, signal),
    },
    inbox: {
      backlog: (signal?: AbortSignal) => read(Backlog, ["inbox", "backlog"], [], {}, signal),
      list: (query: { source: string; status?: string; limit?: number }, signal?: AbortSignal) =>
        read(InboxRow.array(), ["inbox", "list"], [], query, signal),
      show: (source: string, messageId: string, signal?: AbortSignal) =>
        read(InboxRow, ["inbox", "show"], [source, messageId], {}, signal),
    },
    /** Hook-gated: a host without AppHooks rejects these with RouteUnavailable. */
    aggregates: {
      types: (signal?: AbortSignal) => read(AggregateTypes, ["aggregate", "types"], [], {}, signal),
      list: (
        query: { name: string; limit?: number; after?: AggregateListCursor },
        signal?: AbortSignal,
      ) =>
        read(
          AggregateListPage,
          ["aggregate", "list"],
          [],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      show: (query: { name: string; id: string }, signal?: AbortSignal) =>
        read(AggregateDetail, ["aggregate", "show"], [], query, signal),
      snapshot: (query: { name: string; id: string }, signal?: AbortSignal) =>
        read(AggregateSnapshot, ["aggregate", "snapshot"], [], query, signal),
    },
    /** Hook-gated, like `aggregates`. `show` resolves to null for an unknown correlation id. */
    processManagers: {
      list: (
        query: { name: string; limit?: number; after?: ProcessManagerListCursor },
        signal?: AbortSignal,
      ) =>
        read(
          ProcessManagerListPage,
          ["pm", "list"],
          [],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        ),
      show: (
        query: { name: string; correlation: string; timer_limit?: number },
        signal?: AbortSignal,
      ) => read(ProcessManagerDetail.nullable(), ["pm", "show"], [], query, signal),
    },
  }
}

export type KeiroClient = ReturnType<typeof createKeiroClient>

/** The name the workflows screens use. */
export type WorkflowListQuery = WorkflowListFilters
