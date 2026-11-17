import {
  syntheticTopologySummary,
  topologyGolden,
  type TopologyGoldenName,
  topologyGoldenNames,
} from "@keiro-ui/testing"
import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import {
  aggregateDetails,
  createKeiroClient,
  indexTopology,
  isRouteUnavailable,
  isTooLarge,
  keiroKeys,
  parseTopologyDocument,
  parseTopologyNodeKey,
  processDetails,
  projectionOwnerDetails,
  TOPOLOGY_NODE_KINDS,
  TOPOLOGY_RELATIONS_V1,
  TOPOLOGY_RELATIONS_V2,
  TopologyChanging,
  topologyDigest,
  TopologyDocumentInvalid,
  topologyNodeKey,
  UnsupportedTopologySchema,
  workflowDetails,
} from "../src"
import { baseUrl } from "./support"

type Json = Record<string, any>
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)
const golden = (name: TopologyGoldenName): Json => JSON.parse(text(topologyGolden(name))) as Json
const caught = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

/** A host scripted per route: each handler answers the nth request to its route. */
function scriptedHost(routes: {
  summary: (n: number) => string | Response
  show: (n: number) => Uint8Array | Response
}) {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname
    requests.push(path)
    const count = requests.filter((p) => p === path).length
    const answer = path.endsWith("/topology/summary") ? routes.summary(count) : routes.show(count)
    if (answer instanceof Response) return answer
    return new Response(answer as BodyInit, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  }
  const client = createKeiroClient({ baseUrl: "http://keiro.test/keiro", fetch: fetchImpl })
  const count = (route: "summary" | "show") =>
    requests.filter((p) => p.endsWith(`/topology/${route}`)).length
  return { client, requests, count }
}

const tooLarge = () => refusal(413, "inspection_result_too_large")
const refusal = (status: number, code: string, details?: unknown) =>
  new Response(JSON.stringify({ error: { code, message: code, details } }), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("vocabulary", () => {
  test("17 node kinds, 22 relations, and /2 adds feeds", () => {
    expect(TOPOLOGY_NODE_KINDS).toHaveLength(17)
    expect(TOPOLOGY_RELATIONS_V1).toHaveLength(22)
    expect(TOPOLOGY_RELATIONS_V2).toEqual([...TOPOLOGY_RELATIONS_V1, "feeds"])
  })

  test("a node key splits at its first colon", () => {
    expect(topologyNodeKey("read-model", "a:b")).toBe("read-model:a:b")
    expect(parseTopologyNodeKey("read-model:a:b")).toEqual({ kind: "read-model", name: "a:b" })
    expect(parseTopologyNodeKey("nocolon")).toBeUndefined()
  })
})

describe("validation", () => {
  test.each(topologyGoldenNames)("the %s golden validates and indexes", (name) => {
    const document = parseTopologyDocument(golden(name))
    const index = indexTopology(document)
    expect(index.document).toBe(document)
    let grouped = 0
    for (const kind of TOPOLOGY_NODE_KINDS) {
      const nodes = index.byKind(kind)
      grouped += nodes.length
      expect(nodes.every((node) => node.kind === kind)).toBe(true)
    }
    expect(grouped).toBe(document.nodes.length)
    let out = 0
    let into = 0
    for (const node of document.nodes) {
      const key = topologyNodeKey(node.kind, node.name)
      expect(index.node(key)).toBe(node)
      out += index.outgoing(key).length
      into += index.incoming(key).length
    }
    expect(out).toBe(document.edges.length)
    expect(into).toBe(document.edges.length)
    expect(index.node("aggregate:no-such-node")).toBeUndefined()
    expect(index.outgoing("aggregate:no-such-node")).toEqual([])
  })

  test("the index keeps document order and both directions of an edge", () => {
    const index = indexTopology(parseTopologyDocument(golden("hospital-capacity")))
    expect(index.byKind("aggregate").map((node) => node.name)).toEqual([
      "Capacity",
      "Hospital",
      "Reservation",
      "Supply",
      "Surge",
    ])
    const saga = index.outgoing("process:HospitalSurge").find((edge) => edge.relation === "saga")
    expect(saga?.to).toEqual({ kind: "aggregate", name: "Surge" })
    expect(index.incoming("aggregate:Surge")).toContain(saga)
  })

  test("the /2 golden is accepted, and feeds under /1 is rejected", () => {
    const sourced = golden("incident-command-sourced")
    expect(sourced.schema).toBe("keiro-dsl/service-topology/2")
    expect(parseTopologyDocument(sourced).edges.some((edge) => edge.relation === "feeds")).toBe(
      true,
    )
    const error = caught(() =>
      parseTopologyDocument({ ...sourced, schema: "keiro-dsl/service-topology/1" }),
    )
    expect(error).toBeInstanceOf(TopologyDocumentInvalid)
    expect((error as TopologyDocumentInvalid).reason).toBe(
      'unknown relation "feeds" for schema keiro-dsl/service-topology/1',
    )
  })

  test("an unknown schema id is reported as such before anything else", () => {
    const document = golden("hospital-capacity")
    document.schema = "keiro-dsl/service-topology/3"
    document.edges[0].relation = "teleports"
    document.nodes[0].kind = "gizmo"
    const error = caught(() => parseTopologyDocument(document))
    expect(error).toBeInstanceOf(UnsupportedTopologySchema)
    expect((error as UnsupportedTopologySchema).schemaId).toBe("keiro-dsl/service-topology/3")
  })

  test.each([
    ["an unknown node kind", (d: Json) => (d.nodes[0].kind = "gizmo"), 'unknown node kind "gizmo"'],
    [
      "an unknown relation",
      (d: Json) => (d.edges[0].relation = "teleports"),
      'unknown relation "teleports" for schema keiro-dsl/service-topology/1',
    ],
    [
      "an unknown endpoint kind",
      (d: Json) => (d.edges[0].to.kind = "gizmo"),
      'unknown node kind "gizmo" in an edge endpoint',
    ],
    [
      "a duplicate node",
      (d: Json) => d.nodes.push({ ...d.nodes[0] }),
      'duplicate node aggregate "Capacity"',
    ],
    [
      "a dangling endpoint",
      (d: Json) => (d.edges[0].to.name = "nowhere"),
      'the enqueues edge names workqueue "nowhere", which is not a node',
    ],
    ["a node without details", (d: Json) => delete d.nodes[0].details, /^nodes\.0\.details: /],
    ["a missing node list", (d: Json) => delete d.nodes, /^nodes: /],
  ])("%s is rejected with its reason", (_label, corrupt, reason) => {
    const document = golden("hospital-capacity")
    corrupt(document)
    const error = caught(() => parseTopologyDocument(document))
    expect(error).toBeInstanceOf(TopologyDocumentInvalid)
    expect((error as TopologyDocumentInvalid).reason).toMatch(reason)
  })

  test.each([null, [], "text", 7, {}])("a body that is not a document is invalid: %j", (body) => {
    expect(caught(() => parseTopologyDocument(body))).toBeInstanceOf(TopologyDocumentInvalid)
  })

  test("added object fields are accepted and kept", () => {
    const document = golden("hospital-capacity")
    document.addedLater = { anything: true }
    document.nodes[0].addedLater = 1
    document.nodes[0].details.addedLater = "x"
    document.edges[0].addedLater = []
    document.edges[0].from.addedLater = null
    const parsed = parseTopologyDocument(document) as Json
    expect(parsed.addedLater).toEqual({ anything: true })
    expect(parsed.nodes[0].addedLater).toBe(1)
    expect(parsed.edges[0].from.addedLater).toBeNull()
  })
})

describe("typed details", () => {
  const index = indexTopology(parseTopologyDocument(golden("hospital-capacity")))

  test("an aggregate's category and machine", () => {
    const details = aggregateDetails(index.node("aggregate:Surge")!)
    expect(details?.category).toBe("surge")
    expect(details?.machine?.initial).toBe("SurgeIdle")
    expect(details?.machine?.states.at(-1)).toMatchObject({
      name: "SurgeFollowedUp",
      terminal: true,
    })
    expect(details?.machine?.edges[0]).toMatchObject({
      source: "SurgeIdle",
      edgeIndex: 0,
      target: "SurgeRequested",
      mode: "Live",
      command: "NoteSurgeThreshold",
      events: ["SurgeThresholdNoted"],
    })
  })

  test("a process, a workflow and a projection owner", () => {
    expect(processDetails(index.node("process:HospitalSurge")!)).toMatchObject({
      stableName: "hospital-surge",
      saga: { aggregate: "Surge", category: "hospitalSurge" },
    })
    const workflow = workflowDetails(index.node("workflow:HospitalTransferReservation")!)
    expect(workflow?.stableName).toBe("hospital-transfer-reservation")
    expect(workflow?.steps[1]).toEqual({ form: "await", label: "reservation-confirmation" })
    expect(
      projectionOwnerDetails(index.node("projection-owner:transfer_candidates_writer")!),
    ).toMatchObject({
      subscription: "hospital-capacity-transfer-candidates-router",
      delivery: "subscription",
      group: "hospital_routing",
    })
  })

  test("details from an older keiro-dsl lack category and machine and still match", () => {
    const node = structuredClone(index.node("aggregate:Surge")!)
    delete node.details.category
    delete node.details.machine
    const details = aggregateDetails(node)
    expect(details).toBeDefined()
    expect(details?.category).toBeUndefined()
    expect(details?.machine).toBeUndefined()
  })

  test("details that do not match, or the wrong kind, answer undefined and never throw", () => {
    const node = structuredClone(index.node("aggregate:Surge")!)
    ;(node.details.machine as Json).edges[0].mode = "Sideways"
    expect(aggregateDetails(node)).toBeUndefined()
    expect(aggregateDetails(index.node("process:HospitalSurge")!)).toBeUndefined()
    expect(workflowDetails({ ...node, kind: "workflow", details: {} })).toBeUndefined()
  })
})

describe("the recorded fixtures", () => {
  let mock: MockServer
  beforeAll(() => {
    mock = startMockServer()
  })
  afterEach(() => mock.reset())
  afterAll(() => mock.close())

  test("summary, show and load agree on the recorded hospital document", async () => {
    const keiro = createKeiroClient({ baseUrl })
    const summary = await keiro.topology.summary()
    expect(summary).toMatchObject({
      service: "hospital-capacity",
      schema_id: "keiro-dsl/service-topology/1",
      document_bytes: 18760n,
      source: { kind: "source", path: "hospital-capacity.keiro" },
    })
    expect(summary.node_counts.aggregate).toBe(5n)
    expect(summary.edge_counts["member-of"]).toBe(4n)

    const shown = await keiro.topology.show()
    expect(shown.digest).toBe(summary.document_sha256)
    expect(Buffer.from(shown.bytes).equals(Buffer.from(topologyGolden("hospital-capacity")))).toBe(
      true,
    )
    const loaded = await keiro.topology.load()
    expect(loaded.digest).toBe(summary.document_sha256)
    expect(loaded.document.nodes).toHaveLength(25)
    expect(loaded.document.edges).toHaveLength(27)
    expect(loaded.index.byKind("workflow")).toHaveLength(1)
  })
})

describe("load", () => {
  const hospital = topologyGolden("hospital-capacity")
  const incident = topologyGolden("incident-command")

  test("show is requested once per digest, and again when the digest changes", async () => {
    let served = hospital
    const host = scriptedHost({
      summary: () => syntheticTopologySummary(served),
      show: () => served,
    })
    const first = await host.client.topology.load()
    expect(first.summary.service).toBe("hospital-capacity")
    expect(first.digest).toBe(topologyDigest(hospital))
    const second = await host.client.topology.load()
    expect(second.document).toBe(first.document)
    expect(second.index).toBe(first.index)
    expect([host.count("summary"), host.count("show")]).toEqual([2, 1])

    served = incident
    const third = await host.client.topology.load()
    expect(third.summary.service).toBe("incident-command")
    expect(third.digest).toBe(topologyDigest(incident))
    expect([host.count("summary"), host.count("show")]).toEqual([3, 2])
    await host.client.topology.load()
    expect([host.count("summary"), host.count("show")]).toEqual([4, 2])
  })

  test("one mismatch between summary and document recovers on the second pair", async () => {
    // The deployment changes after the first summary: that summary describes the old document.
    const host = scriptedHost({
      summary: (n) => syntheticTopologySummary(n === 1 ? hospital : incident),
      show: () => incident,
    })
    const loaded = await host.client.topology.load()
    expect(loaded.summary.service).toBe("incident-command")
    expect(loaded.digest).toBe(topologyDigest(incident))
    expect([host.count("summary"), host.count("show")]).toEqual([2, 2])
  })

  test("one corrupted byte makes load throw TopologyChanging after exactly two shows", async () => {
    const corrupted = hospital.slice()
    const at = text(hospital).indexOf("hospital-capacity")
    corrupted[at] = "H".charCodeAt(0)
    const host = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: () => corrupted,
    })
    const error = await host.client.topology.load().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(TopologyChanging)
    const pair = { advertised: topologyDigest(hospital), received: topologyDigest(corrupted) }
    expect((error as TopologyChanging).attempts).toEqual([pair, pair])
    expect([host.count("summary"), host.count("show")]).toEqual([2, 2])
  })

  test("a leading byte-order mark changes the digest, so the bytes are hashed as received", async () => {
    const marked = new Uint8Array([0xef, 0xbb, 0xbf, ...hospital])
    const host = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: () => marked,
    })
    const shown = await host.client.topology.show()
    expect(shown.bytes.byteLength).toBe(hospital.byteLength + 3)
    expect(shown.digest).not.toBe(topologyDigest(hospital))
    await expect(host.client.topology.load()).rejects.toBeInstanceOf(TopologyChanging)
  })

  test("an unsupported schema id in the summary never requests the document", async () => {
    const host = scriptedHost({
      summary: () =>
        syntheticTopologySummary(hospital, { schema_id: "keiro-dsl/service-topology/3" }),
      show: () => hospital,
    })
    const error = await host.client.topology.load().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UnsupportedTopologySchema)
    expect((error as UnsupportedTopologySchema).schemaId).toBe("keiro-dsl/service-topology/3")
    expect([host.count("summary"), host.count("show")]).toEqual([1, 0])
  })

  test("a verified document that fails validation is rejected whole and not kept", async () => {
    const document = golden("hospital-capacity")
    document.nodes[0].kind = "gizmo"
    const bytes = encode(document)
    const host = scriptedHost({
      // The summary is computed from the corrupt bytes, so the digests agree.
      summary: () => syntheticTopologySummary(bytes),
      show: () => bytes,
    })
    for (const expected of [1, 2]) {
      const error = await host.client.topology.load().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(TopologyDocumentInvalid)
      expect((error as TopologyDocumentInvalid).reason).toBe('unknown node kind "gizmo"')
      expect(host.count("show")).toBe(expected)
    }
  })

  test("a body that is not JSON is an invalid document", async () => {
    const host = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: () => new TextEncoder().encode("<html>"),
    })
    const error = await host.client.topology.show().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(TopologyDocumentInvalid)
    expect((error as TopologyDocumentInvalid).reason).toBe("the body is not JSON")
  })

  test("a host that mounts no document, or is too old, is RouteUnavailable", async () => {
    const host = scriptedHost({
      summary: () => refusal(400, "invalid_request", { arguments: ["topology", "summary"] }),
      show: () => refusal(400, "invalid_request", { arguments: ["topology", "show"] }),
    })
    for (const call of [
      host.client.topology.summary,
      host.client.topology.show,
      host.client.topology.load,
    ]) {
      const error = await call().catch((e: unknown) => e)
      expect(isRouteUnavailable(error)).toBe(true)
      expect((error as { word: string }).word).toBe("topology")
      expect((error as { cause: { status: number } }).cause.status).toBe(400)
    }
    expect(host.count("show")).toBe(1)
  })

  test("a 413 stays a real failure, on the document and on the summary", async () => {
    const onShow = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: tooLarge,
    })
    const showError = await onShow.client.topology.load().catch((e: unknown) => e)
    expect(isTooLarge(showError)).toBe(true)
    expect(isRouteUnavailable(showError)).toBe(false)
    expect(onShow.count("show")).toBe(1)

    const onSummary = scriptedHost({ summary: tooLarge, show: () => hospital })
    expect(isTooLarge(await onSummary.client.topology.load().catch((e: unknown) => e))).toBe(true)
    expect(onSummary.count("show")).toBe(0)
  })

  test("two client instances share nothing", async () => {
    const one = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: () => hospital,
    })
    const two = scriptedHost({
      summary: () => syntheticTopologySummary(hospital),
      show: () => hospital,
    })
    await one.client.topology.load()
    await two.client.topology.load()
    expect([one.count("show"), two.count("show")]).toEqual([1, 1])
  })
})

test("query keys are scoped to the keiro surface", () => {
  expect(keiroKeys.topology.summary()).toEqual([...keiroKeys.topology.all(), "summary"])
  expect(keiroKeys.topology.loaded()).toEqual([...keiroKeys.topology.all(), "loaded"])
  expect(keiroKeys.topology.all()[0]).toBe(keiroKeys.all()[0])
})
