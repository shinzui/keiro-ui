import type { TopologyNodeKind, TopologyRelation } from "@keiro-ui/client-keiro"

// The words the console uses for the contract's node kinds and relations
// (mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35). One module, because the
// inventory, the detail page, the map and the live-screen panels must agree.

const KIND_LABELS: Record<TopologyNodeKind, { one: string; many: string }> = {
  aggregate: { one: "Aggregate", many: "Aggregates" },
  process: { one: "Process", many: "Processes" },
  workflow: { one: "Workflow", many: "Workflows" },
  router: { one: "Router", many: "Routers" },
  contract: { one: "Contract", many: "Contracts" },
  intake: { one: "Intake", many: "Intakes" },
  emit: { one: "Emit", many: "Emits" },
  publisher: { one: "Publisher", many: "Publishers" },
  workqueue: { one: "Work queue", many: "Work queues" },
  dispatch: { one: "Dispatch", many: "Dispatches" },
  "read-model": { one: "Read model", many: "Read models" },
  operation: { one: "Operation", many: "Operations" },
  "projection-target": { one: "Projection target", many: "Projection targets" },
  "rebuild-group": { one: "Rebuild group", many: "Rebuild groups" },
  "projection-owner": { one: "Projection owner", many: "Projection owners" },
  "projection-revision": { one: "Projection revision", many: "Projection revisions" },
  "external-read": { one: "External read", many: "External reads" },
}

/** The five groups the map tints and filters by. Every kind belongs to exactly one. */
export const KIND_GROUPS = [
  { id: "messaging", label: "Messaging", kinds: ["contract", "intake", "emit", "publisher"] },
  {
    id: "coordination",
    label: "Coordination",
    kinds: ["process", "router", "workflow", "operation"],
  },
  { id: "state", label: "State", kinds: ["aggregate"] },
  { id: "queues", label: "Queues", kinds: ["dispatch", "workqueue"] },
  {
    id: "projections",
    label: "Projections",
    kinds: [
      "projection-owner",
      "projection-target",
      "rebuild-group",
      "projection-revision",
      "read-model",
      "external-read",
    ],
  },
] as const satisfies readonly { id: string; label: string; kinds: readonly TopologyNodeKind[] }[]

export type KindGroupId = (typeof KIND_GROUPS)[number]["id"]

/**
 * The group's hue in HTML (the map tints its SVG nodes with the same hues), each with a
 * dark-theme variant. The group's name is always written next to it, so the hue is never
 * the only signal.
 */
export const GROUP_ACCENT: Record<KindGroupId, { dot: string; band: string }> = {
  messaging: { dot: "bg-sky-500 dark:bg-sky-400", band: "border-l-sky-500 dark:border-l-sky-400" },
  coordination: {
    dot: "bg-violet-500 dark:bg-violet-400",
    band: "border-l-violet-500 dark:border-l-violet-400",
  },
  state: {
    dot: "bg-emerald-500 dark:bg-emerald-400",
    band: "border-l-emerald-500 dark:border-l-emerald-400",
  },
  queues: {
    dot: "bg-amber-500 dark:bg-amber-400",
    band: "border-l-amber-500 dark:border-l-amber-400",
  },
  projections: {
    dot: "bg-rose-500 dark:bg-rose-400",
    band: "border-l-rose-500 dark:border-l-rose-400",
  },
}
export type KindGroup = (typeof KIND_GROUPS)[number]

export const KIND_GROUP_IDS: readonly KindGroupId[] = KIND_GROUPS.map((group) => group.id)

export function kindGroupOf(kind: TopologyNodeKind | string): KindGroup {
  return (
    KIND_GROUPS.find((group) => (group.kinds as readonly string[]).includes(kind)) ?? KIND_GROUPS[1]
  )
}

/** "Read model" for `read-model`. An unknown kind (never in a validated document) is itself. */
export function kindLabel(kind: TopologyNodeKind | string): string {
  return KIND_LABELS[kind as TopologyNodeKind]?.one ?? kind
}

/** "Read models" for `read-model`: the heading of a group of declarations. */
export function kindPluralLabel(kind: TopologyNodeKind | string): string {
  return KIND_LABELS[kind as TopologyNodeKind]?.many ?? kind
}

// Each relation read from its source ("dispatches a command to") and from its target
// ("receives a command from"), so one edge reads naturally on both declarations' pages.
const RELATION_LABELS: Record<TopologyRelation, { out: string; in: string }> = {
  dispatches: { out: "dispatches to", in: "dispatched to by" },
  saga: { out: "keeps its saga in", in: "is the saga of" },
  reads: { out: "reads", in: "read by" },
  projects: { out: "projects into a table of", in: "projected into by" },
  publishes: { out: "publishes to", in: "published to by" },
  subscribes: { out: "subscribes to", in: "subscribed to by" },
  delivers: { out: "delivers", in: "delivered by" },
  enqueues: { out: "enqueues to", in: "enqueued to by" },
  commands: { out: "commands", in: "commanded by" },
  queries: { out: "queries", in: "queried by" },
  signals: { out: "signals", in: "signalled by" },
  runs: { out: "runs", in: "run by" },
  "depends-on": { out: "depends on", in: "depended on by" },
  groups: { out: "groups", in: "grouped by" },
  consumes: { out: "consumes events of", in: "events consumed by" },
  writes: { out: "writes", in: "written by" },
  "member-of": { out: "member of", in: "has member" },
  revises: { out: "revises", in: "revised by" },
  observes: { out: "observes", in: "observed by" },
  "backed-by": { out: "backed by", in: "backs" },
  exposes: { out: "exposes", in: "exposed by" },
  "compatible-with": { out: "compatible with", in: "compatible with" },
  feeds: { out: "feeds", in: "fed by" },
}

/** The relation as read from its source declaration. */
export function relationLabel(relation: TopologyRelation | string): string {
  return RELATION_LABELS[relation as TopologyRelation]?.out ?? relation
}

/** The relation as read from its target declaration. */
export function incomingRelationLabel(relation: TopologyRelation | string): string {
  return RELATION_LABELS[relation as TopologyRelation]?.in ?? relation
}

/** `stableName` for the kinds that have one (process, router, workflow). */
export function stableNameOf(details: Record<string, unknown>): string | undefined {
  const value = details.stableName
  return typeof value === "string" ? value : undefined
}

/** "sha256:d34a4e15…14d0": enough to compare by eye; the full digest is copied. */
export function shortDigest(digest: string): string {
  const [scheme, hex] = digest.includes(":") ? digest.split(":", 2) : ["", digest]
  if (!hex || hex.length <= 16) return digest
  return `${scheme ? `${scheme}:` : ""}${hex.slice(0, 8)}…${hex.slice(-4)}`
}
