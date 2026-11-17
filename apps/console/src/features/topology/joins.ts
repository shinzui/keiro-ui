import {
  type AggregateType,
  aggregateDetails,
  isRouteUnavailable,
  processDetails,
  type ProcessManagerType,
  projectionOwnerDetails,
  type TopologyIndex,
  type TopologyNode,
  type TopologyNodeKind,
  workflowDetails,
} from "@keiro-ui/client-keiro"

import { type LinkTarget, links } from "@/lib/links"

// A declaration links to live state only through a field keiro guarantees, and each of these
// joins is one keiro traces to code (mori://shinzui/keiro/okf/user-documentation/concepts/
// DOC-35, "Joins to live inspection routes"; docs/adr, ADR-16). Everything here is pure: the
// document and the host's catalogues go in, a join or the exact reason there is none comes out.

/** A live catalogue as a screen sees it: loading, answered, refused for lack of hooks, or failed. */
export type Catalogue<T> =
  | { status: "pending" }
  | { status: "ready"; items: readonly T[] }
  | { status: "not-mounted" }
  | { status: "failed"; error: unknown }

export interface LiveCatalogues {
  /** `/aggregate/types`. */
  aggregates: Catalogue<AggregateType>
  /** `/pm/types`. */
  processManagers: Catalogue<ProcessManagerType>
}

/** A query result as a catalogue. A refused command word is "not mounted", never "empty". */
export function catalogueOf<T>(query: {
  data?: { items: readonly T[] }
  error: unknown
  isError: boolean
}): Catalogue<T> {
  if (query.data) return { status: "ready", items: query.data.items }
  if (query.isError)
    return isRouteUnavailable(query.error)
      ? { status: "not-mounted" }
      : { status: "failed", error: query.error }
  return { status: "pending" }
}

export type LiveJoin =
  | { status: "linked"; target: LinkTarget; label: string; caveat: string }
  /** The document does not carry the field the join needs. */
  | { status: "no-field"; field: string }
  /** A projection owner delivered inline: it has no subscription to link. */
  | { status: "inline" }
  /** The host does not mount the catalogue the join is checked against. */
  | { status: "not-mounted" }
  /** The catalogue answered and nothing in it matches the declared value. */
  | { status: "no-match"; value: string }
  /** More than one process manager shares the saga category; none is chosen. */
  | { status: "ambiguous"; value: string; names: string[] }
  | { status: "pending" }
  | { status: "failed"; error: unknown }

const CAVEAT = {
  aggregate:
    "Holds when the host mounts the aggregate inspector catalog keiro generates, which names each aggregate by its stream category.",
  process:
    "Holds when the host builds this process manager's inspector from the category keiro generates. The manager's name is chosen by the host.",
  workflow:
    "Holds when the application runs the workflow under this stable name. The host has no list of workflow names to check it against.",
  "projection-owner":
    "Holds when the host runs the projection catalog keiro generates, which uses this text as the durable subscription name.",
} as const

/** `details.category` against the `name` of a mounted aggregate type. */
export function aggregateJoin(node: TopologyNode, catalogue: Catalogue<AggregateType>): LiveJoin {
  const category = aggregateDetails(node)?.category
  if (category === undefined) return { status: "no-field", field: "category" }
  if (catalogue.status !== "ready") return catalogue
  const type = catalogue.items.find((item) => item.name === category)
  if (!type) return { status: "no-match", value: category }
  return {
    status: "linked",
    target: links.aggregateType(type.name),
    label: `Instances of ${type.name}`,
    caveat: CAVEAT.aggregate,
  }
}

/** `details.saga.category` against the `category` of exactly one mounted process manager. */
export function processJoin(
  node: TopologyNode,
  catalogue: Catalogue<ProcessManagerType>,
): LiveJoin {
  const category = processDetails(node)?.saga.category
  if (category === undefined) return { status: "no-field", field: "saga.category" }
  if (catalogue.status !== "ready") return catalogue
  const matches = catalogue.items.filter((item) => item.category === category)
  if (matches.length === 0) return { status: "no-match", value: category }
  if (matches.length > 1)
    return { status: "ambiguous", value: category, names: matches.map((item) => item.name) }
  return {
    status: "linked",
    target: links.processManager(matches[0]!.name),
    label: `Instances of ${matches[0]!.name}`,
    caveat: CAVEAT.process,
  }
}

/** `details.stableName` is the name the workflow routes filter by; there is nothing to check. */
export function workflowJoin(node: TopologyNode): LiveJoin {
  const name = workflowDetails(node)?.stableName
  if (name === undefined) return { status: "no-field", field: "stableName" }
  return {
    status: "linked",
    target: links.workflows({ workflow_name: name }),
    label: `Workflow instances named ${name}`,
    caveat: CAVEAT.workflow,
  }
}

/** `details.subscription` is the durable subscription name; `null` means inline delivery. */
export function projectionOwnerJoin(node: TopologyNode): LiveJoin {
  const details = projectionOwnerDetails(node)
  if (!details) return { status: "no-field", field: "subscription" }
  if (details.subscription === null) return { status: "inline" }
  return {
    status: "linked",
    target: links.subscription(details.subscription),
    label: `Subscription ${details.subscription}`,
    caveat: CAVEAT["projection-owner"],
  }
}

/** The join for a node of a joinable kind; undefined for every other kind. */
export function joinFor(node: TopologyNode, catalogues: LiveCatalogues): LiveJoin | undefined {
  switch (node.kind) {
    case "aggregate":
      return aggregateJoin(node, catalogues.aggregates)
    case "process":
      return processJoin(node, catalogues.processManagers)
    case "workflow":
      return workflowJoin(node)
    case "projection-owner":
      return projectionOwnerJoin(node)
    default:
      return undefined
  }
}

export const JOINABLE_KINDS: readonly TopologyNodeKind[] = [
  "aggregate",
  "process",
  "workflow",
  "projection-owner",
]

const UNJOINABLE: Partial<Record<TopologyNodeKind, string>> = {
  workqueue:
    "Not linked. keiro's only routes for a job queue reserve, redrive, archive or purge its dead letters, and every one of them changes the queue, so a read-only console has no live queue screen to open from here.",
  intake:
    "Not linked. The inbox is listed by the producing context's source, and no field of an intake declaration is that source, so a link would be a guess.",
  emit: "Not linked. The declared outbox source is not enforced by generated code: the application supplies the source when it writes an integration event, so a link from the declaration could point at the wrong rows.",
}

/**
 * Why a kind that looks as if it should have a live counterpart has no link. Undefined for
 * the joinable kinds and for kinds with no live counterpart at all.
 */
export function unjoinableReason(kind: TopologyNodeKind): string | undefined {
  return UNJOINABLE[kind]
}

// --- document versus host --------------------------------------------------------------------

export interface AggregateAgreement {
  /** Declared with a category that a mounted type is named by. */
  matched: { node: TopologyNode; type: AggregateType }[]
  /** Declared with a category no mounted type is named by. */
  declaredOnly: { node: TopologyNode; category: string }[]
  /** Mounted under a name no declared aggregate's category equals. */
  mountedOnly: AggregateType[]
  /** Declared without a category (an older document): not comparable. */
  withoutCategory: TopologyNode[]
  agrees: boolean
}

/**
 * The one disagreement the console can observe between the committed document and the running
 * host: declared aggregate categories against mounted aggregate type names.
 */
export function compareAggregates(
  index: TopologyIndex,
  types: readonly AggregateType[],
): AggregateAgreement {
  const byName = new Map(types.map((type) => [type.name, type]))
  const matched: AggregateAgreement["matched"] = []
  const declaredOnly: AggregateAgreement["declaredOnly"] = []
  const withoutCategory: TopologyNode[] = []
  const used = new Set<string>()
  for (const node of index.byKind("aggregate")) {
    const category = aggregateDetails(node)?.category
    if (category === undefined) {
      withoutCategory.push(node)
      continue
    }
    const type = byName.get(category)
    if (type) {
      matched.push({ node, type })
      used.add(type.name)
    } else declaredOnly.push({ node, category })
  }
  const mountedOnly = types.filter((type) => !used.has(type.name))
  return {
    matched,
    declaredOnly,
    mountedOnly,
    withoutCategory,
    agrees: declaredOnly.length === 0 && mountedOnly.length === 0,
  }
}

// --- from live state back to its declaration -------------------------------------------------

const only = <T>(items: readonly T[]): T | undefined => (items.length === 1 ? items[0] : undefined)

/** The aggregate declared with the category this mounted type is named by. */
export function declarationForAggregateType(
  index: TopologyIndex,
  typeName: string,
): TopologyNode | undefined {
  return only(
    index.byKind("aggregate").filter((node) => aggregateDetails(node)?.category === typeName),
  )
}

/** The process whose saga category is this mounted manager's category, when exactly one is. */
export function declarationForProcessCategory(
  index: TopologyIndex,
  category: string,
): TopologyNode | undefined {
  return only(
    index.byKind("process").filter((node) => processDetails(node)?.saga.category === category),
  )
}

/** The workflow declared under this stable name. */
export function declarationForWorkflow(
  index: TopologyIndex,
  workflowName: string,
): TopologyNode | undefined {
  return only(
    index.byKind("workflow").filter((node) => workflowDetails(node)?.stableName === workflowName),
  )
}

/** The projection owner whose durable subscription has this name. */
export function declarationForSubscription(
  index: TopologyIndex,
  subscription: string,
): TopologyNode | undefined {
  return only(
    index
      .byKind("projection-owner")
      .filter((node) => projectionOwnerDetails(node)?.subscription === subscription),
  )
}

/** The aggregate a process keeps its progress in: the target of its `saga` edge. */
export function sagaAggregateOf(
  index: TopologyIndex,
  process: TopologyNode,
): TopologyNode | undefined {
  const saga = index
    .outgoing(`${process.kind}:${process.name}`)
    .find((edge) => edge.relation === "saga")
  return saga ? index.node(`${saga.to.kind}:${saga.to.name}`) : undefined
}
