import { createHttpClient, type HttpClient, parseJsonLossless } from "@keiro-ui/client-core"
import type { z } from "zod"

import type {
  AggregateListCursor,
  CategoryConsumersCursor,
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
  CategoryConsumersPage,
  WorkflowCounts,
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
  ProcessManagerTypes,
  StoredSnapshot,
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
import {
  indexTopology,
  isTopologySchemaId,
  type LoadedTopology,
  parseTopologyDocument,
  type ShownTopology,
  TopologyChanging,
  type TopologyDigestPair,
  topologyDigest,
  TopologyDocumentInvalid,
  TopologySummary,
  UnsupportedTopologySchema,
} from "./topology"

/** Page sizes are 1–500 everywhere; anything else is refused before sending. */
function checkLimit(limit: number | undefined): number | undefined {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
    throw new RangeError(`keiro limit must be 1–500, got ${limit}`)
  }
  return limit
}

export interface WorkflowCountsFilters {
  workflow_name?: string
}

export interface CategoryConsumersQuery {
  category: string
  limit?: number
  after?: CategoryConsumersCursor
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

/**
 * keiro-ops-http admits 4 concurrent inspection reads by default and answers 503
 * `inspection_busy` beyond that (InspectionLimits in keiro-ops-http's Config.hs); the client
 * keeps 3 in flight so a screen's reads plus the shell's health probe stay within it.
 */
export const KEIRO_MAX_CONCURRENT = 3

export function createKeiroClient(options: {
  baseUrl: string
  fetch?: typeof fetch
  maxConcurrent?: number
}) {
  const http: HttpClient = createHttpClient({
    surface: "keiro",
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    maxConcurrent: options.maxConcurrent ?? KEIRO_MAX_CONCURRENT,
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

  const topologySummary = (signal?: AbortSignal) =>
    read(TopologySummary, ["topology", "summary"], [], {}, signal)

  /** The mounted bytes exactly as served, their digest computed here, parsed and validated. */
  async function topologyShow(signal?: AbortSignal): Promise<ShownTopology> {
    const route = commandRoute(["topology", "show"], [], {})
    let raw
    try {
      raw = await http.getRaw(route.path, { query: route.query, signal })
    } catch (error) {
      throw classifyError(error, route.word)
    }
    const digest = topologyDigest(raw.bytes)
    let parsed: unknown
    try {
      parsed = parseJsonLossless(raw.text)
    } catch {
      throw new TopologyDocumentInvalid("the body is not JSON")
    }
    return { bytes: raw.bytes, digest, document: parseTopologyDocument(parsed) }
  }

  // One verified document, kept for this client instance (one connection session, ADR-15), so
  // /topology/show is requested once per digest: each read takes a host admission slot.
  let loadedTopology: LoadedTopology | undefined

  /** One summary/document pair: the verified document, or the two digests that disagreed. */
  async function topologyPair(signal?: AbortSignal): Promise<LoadedTopology | TopologyDigestPair> {
    const summary = await topologySummary(signal)
    if (!isTopologySchemaId(summary.schema_id))
      throw new UnsupportedTopologySchema(summary.schema_id)
    if (loadedTopology?.digest === summary.document_sha256) {
      loadedTopology = { ...loadedTopology, summary }
      return loadedTopology
    }
    const shown = await topologyShow(signal)
    if (shown.digest !== summary.document_sha256)
      return { advertised: summary.document_sha256, received: shown.digest }
    loadedTopology = {
      summary,
      digest: shown.digest,
      document: shown.document,
      index: indexTopology(shown.document),
    }
    return loadedTopology
  }

  /**
   * The read order of keiro's handoff: the summary is the mount probe and names the digest;
   * the document is used only when its bytes hash to that digest. A mismatch means the
   * deployment changed between the two requests, so the pair is read once more.
   */
  async function topologyLoad(signal?: AbortSignal): Promise<LoadedTopology> {
    const first = await topologyPair(signal)
    if ("index" in first) return first
    const second = await topologyPair(signal)
    if ("index" in second) return second
    throw new TopologyChanging([first, second])
  }

  return {
    http,
    /**
     * Hook-gated: a host that mounts no document, and one too old to know the command, both
     * refuse with RouteUnavailable (`word` "topology").
     */
    topology: {
      summary: topologySummary,
      show: topologyShow,
      load: topologyLoad,
    },
    health: {
      /** 503 bodies (`schema_drift`, `unavailable`, `inspection_busy`) are the health answer, not a failure. */
      get: async (signal?: AbortSignal) =>
        Health.parse(await http.get("/health", { okStatuses: [200, 503], signal })),
    },
    workflows: {
      counts: (filters: WorkflowCountsFilters = {}, signal?: AbortSignal) =>
        read(
          WorkflowCounts,
          workflowPath("counts"),
          [],
          { workflow_name: filters.workflow_name },
          signal,
        ),
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
      consumers: (query: CategoryConsumersQuery, signal?: AbortSignal) => {
        if (!query.category || query.category.trim() !== query.category)
          throw new RangeError("category must be nonempty and have no surrounding whitespace")
        return read(
          CategoryConsumersPage,
          ["projection", "consumers"],
          [],
          { ...query, limit: checkLimit(query.limit) },
          signal,
        )
      },
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
    /** Raw stored rows; resolves to null when the stream or its snapshot is missing. */
    snapshots: {
      show: (query: { stream: string }, signal?: AbortSignal) =>
        read(StoredSnapshot.nullable(), ["snapshot", "show"], [], query, signal),
    },
    /** Hook-gated, like `aggregates`. `show` resolves to null for an unknown correlation id. */
    processManagers: {
      types: (signal?: AbortSignal) => read(ProcessManagerTypes, ["pm", "types"], [], {}, signal),
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
