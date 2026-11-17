import {
  type AggregateType,
  indexTopology,
  parseTopologyDocument,
  type ProcessManagerType,
  RouteUnavailable,
  TOPOLOGY_NODE_KINDS,
} from "@keiro-ui/client-keiro"
import { joinedAggregateTypes, joinedProcessManagerTypes, topologyGolden } from "@keiro-ui/testing"
import { expect, test } from "vitest"

import {
  aggregateJoin,
  type Catalogue,
  catalogueOf,
  compareAggregates,
  declarationForAggregateType,
  declarationForProcessCategory,
  declarationForSubscription,
  declarationForWorkflow,
  JOINABLE_KINDS,
  joinFor,
  type LiveCatalogues,
  processJoin,
  projectionOwnerJoin,
  sagaAggregateOf,
  unjoinableReason,
  workflowJoin,
} from "./joins"

type Json = Record<string, any>
const documentOf = (name: Parameters<typeof topologyGolden>[0]) =>
  JSON.parse(new TextDecoder().decode(topologyGolden(name))) as Json
const index = indexTopology(parseTopologyDocument(documentOf("hospital-capacity")))
const node = (key: string) => index.node(key)!

const ready = <T>(items: T[]): Catalogue<T> => ({ status: "ready", items })
// SYNTHETIC catalogues: what a host running this service's generated catalogues would report.
const joined: LiveCatalogues = {
  aggregates: ready(joinedAggregateTypes as AggregateType[]),
  processManagers: ready(joinedProcessManagerTypes as ProcessManagerType[]),
}
// Recorded from Jitsurei, which the document does not describe.
const jitsurei: AggregateType[] = ["credit-limit", "incident", "order"].map((name) => ({
  name,
  category: name,
  snapshots_configured: false,
  snapshot_policy: "never",
}))

test("an aggregate joins by its category to the mounted type of that name", () => {
  expect(aggregateJoin(node("aggregate:Reservation"), joined.aggregates)).toMatchObject({
    status: "linked",
    target: { to: "/aggregates/$type", params: { type: "reservation" } },
    label: "Instances of reservation",
  })
  expect(aggregateJoin(node("aggregate:Reservation"), ready(jitsurei))).toEqual({
    status: "no-match",
    value: "reservation",
  })
  // A type whose category matches but whose name does not is not the join keiro guarantees.
  expect(
    aggregateJoin(
      node("aggregate:Reservation"),
      ready([{ ...jitsurei[0]!, name: "bookings", category: "reservation" }]),
    ),
  ).toEqual({ status: "no-match", value: "reservation" })
})

test("an aggregate without a category has no join, whatever the host mounts", () => {
  const older = structuredClone(node("aggregate:Reservation"))
  delete older.details.category
  expect(aggregateJoin(older, joined.aggregates)).toEqual({ status: "no-field", field: "category" })
  expect(aggregateJoin(older, { status: "not-mounted" })).toEqual({
    status: "no-field",
    field: "category",
  })
})

test("a catalogue that is loading, refused or failed is reported as that, never as no match", () => {
  const error = new Error("boom")
  for (const state of [
    { status: "pending" },
    { status: "not-mounted" },
    { status: "failed", error },
  ] as const) {
    expect(aggregateJoin(node("aggregate:Surge"), state)).toEqual(state)
    expect(processJoin(node("process:HospitalSurge"), state)).toEqual(state)
  }
})

test("a process joins by its saga category to exactly one manager, whose name the host chose", () => {
  expect(processJoin(node("process:HospitalSurge"), joined.processManagers)).toMatchObject({
    status: "linked",
    target: { to: "/process-managers/$name", params: { name: "hospital-surge" } },
  })
  expect(
    processJoin(
      node("process:HospitalSurge"),
      ready([
        { ...joinedProcessManagerTypes[0]!, category: "fulfillment" },
      ] as ProcessManagerType[]),
    ),
  ).toEqual({ status: "no-match", value: "hospitalSurge" })
  const two = ["surge-a", "surge-b"].map((name) =>
    Object.assign({}, joinedProcessManagerTypes[0], { name }),
  ) as ProcessManagerType[]
  expect(processJoin(node("process:HospitalSurge"), ready(two))).toEqual({
    status: "ambiguous",
    value: "hospitalSurge",
    names: ["surge-a", "surge-b"],
  })
})

test("a workflow always links by its stable name; a projection owner by its subscription", () => {
  expect(workflowJoin(node("workflow:HospitalTransferReservation"))).toMatchObject({
    status: "linked",
    target: { to: "/workflows", search: { workflow_name: "hospital-transfer-reservation" } },
  })
  expect(projectionOwnerJoin(node("projection-owner:transfer_candidates_writer"))).toMatchObject({
    status: "linked",
    target: {
      to: "/subscriptions/$name",
      params: { name: "hospital-capacity-transfer-candidates-router" },
    },
  })
  const inline = structuredClone(node("projection-owner:transfer_candidates_writer"))
  inline.details.subscription = null
  expect(projectionOwnerJoin(inline)).toEqual({ status: "inline" })
  const bare = { ...inline, details: {} }
  expect(projectionOwnerJoin(bare)).toEqual({ status: "no-field", field: "subscription" })
  expect(workflowJoin({ ...node("workflow:HospitalTransferReservation"), details: {} })).toEqual({
    status: "no-field",
    field: "stableName",
  })
})

test("every linked join states when it holds", () => {
  for (const key of [
    "aggregate:Surge",
    "process:HospitalSurge",
    "workflow:HospitalTransferReservation",
    "projection-owner:transfer_candidates_writer",
  ]) {
    const join = joinFor(node(key), joined)
    expect(join?.status, key).toBe("linked")
    expect(join?.status === "linked" && join.caveat, key).toMatch(/^Holds when /)
  }
})

test("only four kinds join; three say why they do not; the rest have no live counterpart", () => {
  expect(JOINABLE_KINDS).toEqual(["aggregate", "process", "workflow", "projection-owner"])
  for (const kind of TOPOLOGY_NODE_KINDS) {
    const sample = { kind, name: "x", context: "c", member: "m", line: 1, details: {} }
    const joinable = JOINABLE_KINDS.includes(kind)
    expect(joinFor(sample, joined) !== undefined, kind).toBe(joinable)
    const reason = unjoinableReason(kind)
    expect(reason !== undefined, kind).toBe(["workqueue", "intake", "emit"].includes(kind))
    if (reason) expect(reason, kind).toMatch(/^Not linked\. /)
  }
})

test("a query becomes a catalogue: data, a refused command word, another failure, or pending", () => {
  expect(catalogueOf({ data: { items: [1] }, error: null, isError: false })).toEqual(ready([1]))
  const refused = new RouteUnavailable("aggregate", { status: 400 } as never)
  expect(catalogueOf({ error: refused, isError: true })).toEqual({ status: "not-mounted" })
  const other = new Error("503")
  expect(catalogueOf({ error: other, isError: true })).toEqual({ status: "failed", error: other })
  expect(catalogueOf({ error: null, isError: false })).toEqual({ status: "pending" })
  // Data from an earlier read outlives a failed refetch.
  expect(catalogueOf({ data: { items: [] }, error: other, isError: true })).toEqual(ready([]))
})

test("document and host: agreement, disagreement on both sides, and what cannot be compared", () => {
  const agree = compareAggregates(index, joinedAggregateTypes as AggregateType[])
  expect(agree.agrees).toBe(true)
  expect(agree.matched.map((m) => [m.node.name, m.type.name])).toEqual([
    ["Capacity", "capacity"],
    ["Hospital", "hospital"],
    ["Reservation", "reservation"],
    ["Supply", "supply"],
    ["Surge", "surge"],
  ])

  const disagree = compareAggregates(index, jitsurei)
  expect(disagree.agrees).toBe(false)
  expect(disagree.matched).toEqual([])
  expect(disagree.declaredOnly.map((d) => [d.node.name, d.category])).toEqual([
    ["Capacity", "capacity"],
    ["Hospital", "hospital"],
    ["Reservation", "reservation"],
    ["Supply", "supply"],
    ["Surge", "surge"],
  ])
  expect(disagree.mountedOnly.map((type) => type.name)).toEqual([
    "credit-limit",
    "incident",
    "order",
  ])

  const partial = compareAggregates(index, [
    ...(joinedAggregateTypes.slice(0, 2) as AggregateType[]),
    jitsurei[2]!,
  ])
  expect(partial.matched).toHaveLength(2)
  expect(partial.declaredOnly).toHaveLength(3)
  expect(partial.mountedOnly.map((type) => type.name)).toEqual(["order"])

  // An older document: aggregates without a category are set aside, not counted as missing.
  const older = documentOf("hospital-capacity")
  for (const n of older.nodes) delete n.details.category
  const without = compareAggregates(indexTopology(parseTopologyDocument(older)), [])
  expect(without.withoutCategory).toHaveLength(5)
  expect(without.declaredOnly).toEqual([])
  expect(without.agrees).toBe(true)
})

test("from live state back to its declaration", () => {
  expect(declarationForAggregateType(index, "reservation")?.name).toBe("Reservation")
  expect(declarationForAggregateType(index, "order")).toBeUndefined()
  expect(declarationForProcessCategory(index, "hospitalSurge")?.name).toBe("HospitalSurge")
  expect(declarationForProcessCategory(index, "fulfillment")).toBeUndefined()
  expect(declarationForWorkflow(index, "hospital-transfer-reservation")?.name).toBe(
    "HospitalTransferReservation",
  )
  // The declared block name is not the stable name the live routes use.
  expect(declarationForWorkflow(index, "HospitalTransferReservation")).toBeUndefined()
  expect(declarationForSubscription(index, "hospital-capacity-accepted-transfer-needs")?.name).toBe(
    "accepted_transfer_needs_writer",
  )
  expect(declarationForSubscription(index, "jitsurei-order-reporting")).toBeUndefined()
  expect(sagaAggregateOf(index, node("process:HospitalSurge"))?.name).toBe("Surge")
})

test("two declarations sharing a join value are not chosen between", () => {
  const document = documentOf("hospital-capacity")
  const surge = document.nodes.find((n: Json) => n.kind === "aggregate" && n.name === "Surge")
  surge.details.category = "reservation"
  const twins = indexTopology(parseTopologyDocument(document))
  expect(declarationForAggregateType(twins, "reservation")).toBeUndefined()
})
