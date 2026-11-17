import { type ApiError, int64, isApiError } from "@keiro-ui/client-core"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { z } from "zod"

// The service topology is the document `keiro-dsl topology` writes and a keiro inspection host
// serves unchanged at /topology/show, with a snake_case header at /topology/summary. Contract:
// mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35. Compatibility policy
// (mori://shinzui/keiro/okf/adrs/concepts/ADR-62): keiro may add object fields within a schema
// id, so every object here passes unknown fields through; a schema id, node kind or relation
// this client does not know rejects the whole document (docs/adr, ADR-16).

export const TOPOLOGY_SCHEMA_V1 = "keiro-dsl/service-topology/1"
export const TOPOLOGY_SCHEMA_V2 = "keiro-dsl/service-topology/2"
export const TOPOLOGY_SCHEMA_IDS = [TOPOLOGY_SCHEMA_V1, TOPOLOGY_SCHEMA_V2] as const
export type TopologySchemaId = (typeof TOPOLOGY_SCHEMA_IDS)[number]

/** The 17 node kinds of both schema ids, in the contract's order. */
export const TOPOLOGY_NODE_KINDS = [
  "aggregate",
  "process",
  "workflow",
  "router",
  "contract",
  "intake",
  "emit",
  "publisher",
  "workqueue",
  "dispatch",
  "read-model",
  "operation",
  "projection-target",
  "rebuild-group",
  "projection-owner",
  "projection-revision",
  "external-read",
] as const
export type TopologyNodeKind = (typeof TOPOLOGY_NODE_KINDS)[number]

/** The 22 relations of `keiro-dsl/service-topology/1`, in the contract's order. */
export const TOPOLOGY_RELATIONS_V1 = [
  "dispatches",
  "saga",
  "reads",
  "projects",
  "publishes",
  "subscribes",
  "delivers",
  "enqueues",
  "commands",
  "queries",
  "signals",
  "runs",
  "depends-on",
  "groups",
  "consumes",
  "writes",
  "member-of",
  "revises",
  "observes",
  "backed-by",
  "exposes",
  "compatible-with",
] as const
/** `/2` is `/1` plus `feeds` (a declared input source; ADR-64 upstream). */
export const TOPOLOGY_RELATIONS_V2 = [...TOPOLOGY_RELATIONS_V1, "feeds"] as const
export type TopologyRelation = (typeof TOPOLOGY_RELATIONS_V2)[number]

const RELATIONS_BY_SCHEMA: Record<TopologySchemaId, readonly string[]> = {
  [TOPOLOGY_SCHEMA_V1]: TOPOLOGY_RELATIONS_V1,
  [TOPOLOGY_SCHEMA_V2]: TOPOLOGY_RELATIONS_V2,
}

export const isTopologySchemaId = (value: unknown): value is TopologySchemaId =>
  (TOPOLOGY_SCHEMA_IDS as readonly unknown[]).includes(value)

// --- errors ----------------------------------------------------------------------------------

/** The schema id is not one this client understands; nothing of the document is used. */
export class UnsupportedTopologySchema extends Error {
  readonly schemaId: string
  override readonly cause?: ApiError
  constructor(schemaId: string, cause?: unknown) {
    super(`This console does not understand the service topology schema "${schemaId}"`)
    this.name = "UnsupportedTopologySchema"
    this.schemaId = schemaId
    if (isApiError(cause)) this.cause = cause
  }
}

/**
 * The document cannot be used as a whole: it is not shaped as the contract says, or it names a
 * node kind or relation unknown to its schema id, repeats a node, or has an edge to no node.
 * `reason` names the first offence.
 */
export class TopologyDocumentInvalid extends Error {
  readonly reason: string
  override readonly cause?: ApiError
  constructor(reason: string, cause?: unknown) {
    super(`The served service topology is not usable: ${reason}`)
    this.name = "TopologyDocumentInvalid"
    this.reason = reason
    if (isApiError(cause)) this.cause = cause
  }
}

export interface TopologyDigestPair {
  /** `document_sha256` of the summary read first. */
  advertised: string
  /** The digest of the bytes `/topology/show` then returned. */
  received: string
}

/** Two summary/document pairs in a row disagreed: the deployment is changing under the read. */
export class TopologyChanging extends Error {
  readonly attempts: readonly [TopologyDigestPair, TopologyDigestPair]
  override readonly cause?: ApiError
  constructor(attempts: readonly [TopologyDigestPair, TopologyDigestPair], cause?: unknown) {
    super("The served service topology changed between its summary and its document, twice")
    this.name = "TopologyChanging"
    this.attempts = attempts
    if (isApiError(cause)) this.cause = cause
  }
}

export const isUnsupportedTopologySchema = (error: unknown): error is UnsupportedTopologySchema =>
  error instanceof UnsupportedTopologySchema
export const isTopologyDocumentInvalid = (error: unknown): error is TopologyDocumentInvalid =>
  error instanceof TopologyDocumentInvalid
export const isTopologyChanging = (error: unknown): error is TopologyChanging =>
  error instanceof TopologyChanging

// --- the summary -----------------------------------------------------------------------------

const digestText = z.string()

export const TopologySummary = z
  .object({
    schema_id: z.string(),
    service: z.string(),
    generator_version: z.string(),
    document_bytes: int64(),
    document_sha256: digestText,
    members: z.array(z.object({ path: z.string(), sha256: digestText }).passthrough()),
    node_counts: z.record(z.string(), int64()),
    edge_counts: z.record(z.string(), int64()),
    /** Present only when the document's own `source` is well formed. */
    source: z.object({ kind: z.string(), path: z.string() }).passthrough().optional(),
  })
  .passthrough()
export type TopologySummary = z.output<typeof TopologySummary>

// --- the document ----------------------------------------------------------------------------

export interface TopologyNodeRef {
  kind: TopologyNodeKind
  name: string
}

export interface TopologyNode {
  kind: TopologyNodeKind
  name: string
  context: string
  /** The path of the member that declares the node, and the declaration's line in it. */
  member: string
  line: number
  details: Record<string, unknown>
}

export interface TopologyEdge {
  from: TopologyNodeRef
  to: TopologyNodeRef
  relation: TopologyRelation
  attributes: Record<string, unknown>
}

export interface TopologyMember {
  path: string
  sha256: string
  declaredLanguageVersion?: number | null
  effectiveLanguageVersion?: number
}

export interface ServiceTopologyDocument {
  schema: TopologySchemaId
  service: string
  source: { kind: string; path: string }
  effectiveSemanticContract: {
    languageVersion?: number
    languageSupport?: string
    runtimeSemantics?: string
  }
  generator: { tool: string; version: string }
  members: TopologyMember[]
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

const openRecord = z.record(z.string(), z.unknown())
const nodeRefShape = z.object({ kind: z.string(), name: z.string() }).passthrough()

// Kinds and relations are plain strings here and checked afterwards, so the refusal can name
// the first unknown one instead of reporting a union mismatch.
const documentShape = z
  .object({
    schema: z.string(),
    service: z.string(),
    source: z.object({ kind: z.string(), path: z.string() }).passthrough(),
    effectiveSemanticContract: z
      .object({
        languageVersion: z.number().optional(),
        languageSupport: z.string().optional(),
        runtimeSemantics: z.string().optional(),
      })
      .passthrough(),
    generator: z.object({ tool: z.string(), version: z.string() }).passthrough(),
    members: z.array(
      z
        .object({
          path: z.string(),
          sha256: digestText,
          declaredLanguageVersion: z.number().nullable().optional(),
          effectiveLanguageVersion: z.number().optional(),
        })
        .passthrough(),
    ),
    nodes: z.array(
      z
        .object({
          kind: z.string(),
          name: z.string(),
          context: z.string(),
          member: z.string(),
          line: z.number(),
          details: openRecord,
        })
        .passthrough(),
    ),
    edges: z.array(
      z
        .object({
          from: nodeRefShape,
          to: nodeRefShape,
          relation: z.string(),
          attributes: openRecord,
        })
        .passthrough(),
    ),
  })
  .passthrough()

/** `kind`, a colon and `name`. Kinds never contain a colon, so the first colon splits them. */
export function topologyNodeKey(kind: string, name: string): string {
  return `${kind}:${name}`
}

/** The inverse of `topologyNodeKey`; undefined when the text has no colon. */
export function parseTopologyNodeKey(key: string): { kind: string; name: string } | undefined {
  const at = key.indexOf(":")
  return at < 0 ? undefined : { kind: key.slice(0, at), name: key.slice(at + 1) }
}

const isKind = (value: string): value is TopologyNodeKind =>
  (TOPOLOGY_NODE_KINDS as readonly string[]).includes(value)

function issuePath(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.map((part) => String(part)).join(".")
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Validates a parsed document, whole or not at all. The schema id is checked first, so a
 * document under a newer id is reported as unsupported, never as having an unknown relation.
 */
export function parseTopologyDocument(value: unknown): ServiceTopologyDocument {
  const schema =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as { schema?: unknown }).schema
      : undefined
  if (typeof schema !== "string")
    throw new TopologyDocumentInvalid("the body is not an object with a schema id")
  if (!isTopologySchemaId(schema)) throw new UnsupportedTopologySchema(schema)

  const shaped = documentShape.safeParse(value)
  if (!shaped.success) {
    const first = shaped.error.issues[0]
    throw new TopologyDocumentInvalid(first ? issuePath(first) : "the document is malformed")
  }
  const document = shaped.data
  const relations = RELATIONS_BY_SCHEMA[schema]

  const keys = new Set<string>()
  for (const node of document.nodes) {
    if (!isKind(node.kind)) throw new TopologyDocumentInvalid(`unknown node kind "${node.kind}"`)
    const key = topologyNodeKey(node.kind, node.name)
    if (keys.has(key))
      throw new TopologyDocumentInvalid(`duplicate node ${node.kind} "${node.name}"`)
    keys.add(key)
  }
  for (const edge of document.edges) {
    if (!relations.includes(edge.relation))
      throw new TopologyDocumentInvalid(`unknown relation "${edge.relation}" for schema ${schema}`)
    for (const end of [edge.from, edge.to]) {
      if (!isKind(end.kind))
        throw new TopologyDocumentInvalid(`unknown node kind "${end.kind}" in an edge endpoint`)
      if (!keys.has(topologyNodeKey(end.kind, end.name)))
        throw new TopologyDocumentInvalid(
          `the ${edge.relation} edge names ${end.kind} "${end.name}", which is not a node`,
        )
    }
  }
  return document as ServiceTopologyDocument
}

// --- the index -------------------------------------------------------------------------------

export interface TopologyIndex {
  document: ServiceTopologyDocument
  node(key: string): TopologyNode | undefined
  /** Nodes of one kind in document order (sorted by name). */
  byKind(kind: TopologyNodeKind): readonly TopologyNode[]
  /** Edges leaving / entering the node, in document order. */
  outgoing(key: string): readonly TopologyEdge[]
  incoming(key: string): readonly TopologyEdge[]
}

const NONE: readonly never[] = Object.freeze([])

function push<T>(map: Map<string, T[]>, key: string, item: T) {
  const list = map.get(key)
  if (list) list.push(item)
  else map.set(key, [item])
}

export function indexTopology(document: ServiceTopologyDocument): TopologyIndex {
  const nodes = new Map<string, TopologyNode>()
  const kinds = new Map<string, TopologyNode[]>()
  const out = new Map<string, TopologyEdge[]>()
  const into = new Map<string, TopologyEdge[]>()
  for (const node of document.nodes) {
    nodes.set(topologyNodeKey(node.kind, node.name), node)
    push(kinds, node.kind, node)
  }
  for (const edge of document.edges) {
    push(out, topologyNodeKey(edge.from.kind, edge.from.name), edge)
    push(into, topologyNodeKey(edge.to.kind, edge.to.name), edge)
  }
  return {
    document,
    node: (key) => nodes.get(key),
    byKind: (kind) => kinds.get(kind) ?? NONE,
    outgoing: (key) => out.get(key) ?? NONE,
    incoming: (key) => into.get(key) ?? NONE,
  }
}

// --- typed views of `details` ----------------------------------------------------------------
// Applied on demand; each answers undefined, never throws, when the details do not match.

const names = z.array(z.string())

export const AggregateMachine = z
  .object({
    ownership: z.string(),
    initial: z.string(),
    states: z.array(z.object({ name: z.string(), terminal: z.boolean() }).passthrough()),
    edges: z.array(
      z
        .object({
          source: z.string(),
          edgeIndex: z.number(),
          target: z.string(),
          mode: z.enum(["Live", "ReplayOnly"]),
          command: z.string(),
          events: names,
        })
        .passthrough(),
    ),
  })
  .passthrough()
export type AggregateMachine = z.output<typeof AggregateMachine>
export type AggregateMachineEdge = AggregateMachine["edges"][number]

/** `category` and `machine` are absent from documents emitted by older keiro-dsl versions. */
export const AggregateDetails = z
  .object({
    states: names,
    commands: names,
    events: names,
    category: z.string().optional(),
    machine: AggregateMachine.optional(),
  })
  .passthrough()
export type AggregateDetails = z.output<typeof AggregateDetails>

export const ProcessDetails = z
  .object({
    stableName: z.string(),
    saga: z.object({ aggregate: z.string(), category: z.string() }).passthrough(),
  })
  .passthrough()
export type ProcessDetails = z.output<typeof ProcessDetails>

export const WorkflowDetails = z
  .object({
    stableName: z.string(),
    steps: z.array(z.object({ form: z.string(), label: z.string().optional() }).passthrough()),
  })
  .passthrough()
export type WorkflowDetails = z.output<typeof WorkflowDetails>

/** `subscription` is null for inline delivery, which has no durable subscription. */
export const ProjectionOwnerDetails = z
  .object({
    subscription: z.string().nullable(),
    delivery: z.string(),
    group: z.string(),
  })
  .passthrough()
export type ProjectionOwnerDetails = z.output<typeof ProjectionOwnerDetails>

function detailsOf<S extends z.ZodTypeAny>(
  kind: TopologyNodeKind,
  schema: S,
  node: TopologyNode,
): z.output<S> | undefined {
  if (node.kind !== kind) return undefined
  const parsed = schema.safeParse(node.details)
  return parsed.success ? parsed.data : undefined
}

export const aggregateDetails = (node: TopologyNode): AggregateDetails | undefined =>
  detailsOf("aggregate", AggregateDetails, node)
export const processDetails = (node: TopologyNode): ProcessDetails | undefined =>
  detailsOf("process", ProcessDetails, node)
export const workflowDetails = (node: TopologyNode): WorkflowDetails | undefined =>
  detailsOf("workflow", WorkflowDetails, node)
export const projectionOwnerDetails = (node: TopologyNode): ProjectionOwnerDetails | undefined =>
  detailsOf("projection-owner", ProjectionOwnerDetails, node)

// --- digests and the verified result ---------------------------------------------------------

/**
 * `sha256:` and the lowercase hex SHA-256 of the bytes, as keiro writes digests. A pure
 * implementation: `crypto.subtle` is absent when the console is served over plain HTTP.
 */
export function topologyDigest(bytes: Uint8Array): string {
  return `sha256:${bytesToHex(sha256(bytes))}`
}

export interface ShownTopology {
  /** The exact bytes `/topology/show` returned. */
  bytes: Uint8Array
  /** The digest of `bytes`, computed here. */
  digest: string
  document: ServiceTopologyDocument
}

/** A document whose bytes hashed to the digest its host advertised, validated and indexed. */
export interface LoadedTopology {
  summary: TopologySummary
  digest: string
  document: ServiceTopologyDocument
  index: TopologyIndex
}
