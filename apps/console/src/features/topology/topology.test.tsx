import {
  indexTopology,
  keiroKeys,
  parseTopologyDocument,
  topologyDigest,
} from "@keiro-ui/client-keiro"
import {
  syntheticTopologySummary,
  topologyGolden,
  type TopologyGoldenName,
} from "@keiro-ui/testing"
import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

import { readModelsFedBy } from "./trace"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

type Json = Record<string, any>
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)) as Json
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)

/** Requests the mock answered, by route, since the last `serve`. */
let requests: { summary: number; show: number }

/**
 * Replaces the recorded document with other bytes. The summary is synthetic: computed from
 * the bytes as a host would, with `summary` overriding fields.
 */
function serve(
  document: TopologyGoldenName | Uint8Array,
  options: { summary?: Record<string, unknown> } = {},
) {
  const bytes = typeof document === "string" ? topologyGolden(document) : document
  requests = { summary: 0, show: 0 }
  mock.use(
    http.get("*/keiro/topology/summary", () => {
      requests.summary += 1
      return new HttpResponse(syntheticTopologySummary(bytes, options.summary), {
        headers: { "content-type": "application/json" },
      })
    }),
    http.get("*/keiro/topology/show", () => {
      requests.show += 1
      return new HttpResponse(bytes as BodyInit, {
        headers: { "content-type": "application/json" },
      })
    }),
  )
}

function refuse(route: "summary" | "show", status: number, code: string, details?: unknown) {
  mock.use(
    http.get(`*/keiro/topology/${route}`, () =>
      HttpResponse.json({ error: { code, message: `the host said ${code}`, details } }, { status }),
    ),
  )
}

const main = () => screen.getByRole("main")

test("the header, caption and members of the recorded document", async () => {
  await renderRoute("/topology")
  expect(await screen.findByTestId("topology-service")).toHaveTextContent("hospital-capacity")
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Service topology")
  expect(screen.getByTestId("topology-schema")).toHaveTextContent("keiro-dsl/service-topology/1")
  const header = screen.getByRole("region", { name: "Mounted document" })
  expect(header).toHaveTextContent("source hospital-capacity.keiro")
  // keiro's goldens carry a placeholder version; it is shown as given.
  expect(header).toHaveTextContent("keiro-dsl <version>")
  expect(header).toHaveTextContent("6 (candidate)")
  expect(header).toHaveTextContent("keiro-dsl/runtime-semantics/5")
  expect(header).toHaveTextContent("18 760 bytes")
  expect(screen.getByTestId("topology-digest")).toHaveTextContent("sha256:d34a4e15…14d0")
  expect(screen.getByTestId("topology-node-total")).toHaveTextContent("25")
  expect(screen.getByTestId("topology-edge-total")).toHaveTextContent("27")
  expect(screen.getByTestId("topology-caption")).toHaveTextContent(
    "This describes the committed specification the host mounted, not the running binary. The host does not check that they agree.",
  )
  const members = screen.getByRole("grid", { name: "Members" })
  expect(within(members).getAllByRole("row")).toHaveLength(2)
  expect(members).toHaveTextContent("hospital-capacity.keiro")
  expect(members).toHaveTextContent("sha256:0c849100…ae5e")
})

test("a member without a declared language version says none", async () => {
  const document = decode(topologyGolden("hospital-capacity"))
  document.members[0].declaredLanguageVersion = null
  serve(encode(document))
  await renderRoute("/topology")
  const members = await screen.findByRole("grid", { name: "Members" })
  expect(within(members).getAllByRole("row")[1]).toHaveTextContent("none")
})

test("the section is in the navigation", async () => {
  await renderRoute("/topology")
  await screen.findByTestId("topology-service")
  expect(screen.getByRole("link", { name: "Declarations" })).toHaveAttribute(
    "href",
    "/topology?target=same-origin",
  )
})

test("a host that mounts no topology is named as such, not shown as an empty service", async () => {
  refuse("summary", 400, "invalid_request", { arguments: ["topology", "summary"] })
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-not-served")
  expect(state).toHaveTextContent("This keiro host serves no service topology")
  expect(state).toHaveTextContent("--topology FILE")
  expect(state).toHaveTextContent("/keiro/topology/summary")
  expect(state).toHaveTextContent("older than the keiro release that added the route")
  expect(screen.queryByRole("region", { name: "Declarations" })).not.toBeInTheDocument()
  expect(main()).not.toHaveTextContent("0 declarations")
})

test("an unsupported schema id is named and the document is never requested", async () => {
  serve("hospital-capacity", { summary: { schema_id: "keiro-dsl/service-topology/3" } })
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-unsupported-schema")
  expect(state).toHaveTextContent("keiro-dsl/service-topology/3")
  expect(state).toHaveTextContent("keiro-dsl/service-topology/1")
  expect(state).toHaveTextContent("keiro-dsl/service-topology/2")
  expect(state).toHaveTextContent("shows nothing from one it cannot fully read")
  expect(requests.show).toBe(0)
})

test("an invalid document is rejected whole with the reason verbatim", async () => {
  const document = decode(topologyGolden("hospital-capacity"))
  document.edges[0].relation = "teleports"
  serve(encode(document))
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-invalid")
  expect(state).toHaveTextContent(
    'unknown relation "teleports" for schema keiro-dsl/service-topology/1',
  )
  expect(state).toHaveTextContent("rejected whole")
  expect(screen.queryByTestId("topology-service")).not.toBeInTheDocument()
})

test("a result the host refuses as too large says who can change that", async () => {
  serve("hospital-capacity")
  refuse("show", 413, "inspection_result_too_large")
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-too-large")
  expect(state).toHaveTextContent("inspectionLimits.maxResponseBytes")
  expect(state).toHaveTextContent("no parameters to narrow")
})

test("a document that keeps disagreeing with its summary is a changing deployment, with retry", async () => {
  serve("hospital-capacity", { summary: { document_sha256: `sha256:${"0".repeat(64)}` } })
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-changing")
  expect(state).toHaveTextContent("The deployment is probably rolling out")
  expect(requests.show).toBe(2)
  serve("hospital-capacity")
  fireEvent.click(within(state).getByRole("button", { name: "Retry" }))
  expect(await screen.findByTestId("topology-service")).toHaveTextContent("hospital-capacity")
})

test("any other refusal shows the server's code and message", async () => {
  refuse("summary", 409, "schema_drift")
  await renderRoute("/topology")
  const state = await screen.findByTestId("topology-failed")
  expect(state).toHaveTextContent("409 schema_drift")
  expect(state).toHaveTextContent("the host said schema_drift")
  expect(within(state).getByRole("button", { name: "Retry" })).toBeInTheDocument()
})

test("a deployment without a keiro surface says so and sends no topology request", async () => {
  serve("hospital-capacity")
  await renderRoute("/topology?target=store", {
    catalog: {
      version: 1,
      defaultTargetId: "store",
      targets: [
        {
          id: "store",
          label: "Store",
          app: "store",
          environment: "dev",
          surfaces: { kiroku: "/kiroku" },
        },
      ],
    },
  })
  expect(await screen.findByTestId("topology-not-configured")).toHaveTextContent(
    "Keiro inspection is not configured for this deployment",
  )
  expect(requests).toEqual({ summary: 0, show: 0 })
})

test("declarations are grouped by the map's kind groups, then by kind in the contract's order", async () => {
  await renderRoute("/topology")
  const inventory = await screen.findByRole("region", { name: "Declarations" })
  const headingsAt = (level: number) =>
    within(inventory)
      .getAllByRole("heading", { level })
      .map((heading) => heading.textContent)
  expect(headingsAt(3)).toEqual([
    "Messaging4 declarations",
    "Coordination5 declarations",
    "State5 declarations",
    "Queues2 declarations",
    "Projections9 declarations",
  ])
  expect(headingsAt(4)).toEqual([
    "Contracts 1",
    "Intakes 1",
    "Emits 1",
    "Publishers 1",
    "Processes 1",
    "Workflows 1",
    "Routers 1",
    "Operations 2",
    "Aggregates 5",
    "Work queues 1",
    "Dispatches 1",
    "Read models 4",
    "Projection targets 2",
    "Rebuild groups 1",
    "Projection owners 2",
  ])
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("25 declarations")
  const aggregates = within(inventory).getByRole("grid", { name: "Aggregates" })
  expect(within(aggregates).getByRole("link", { name: "Reservation" })).toHaveAttribute(
    "href",
    "/topology/aggregate/Reservation?target=same-origin",
  )
  expect(aggregates).toHaveTextContent("hospital-capacity.keiro:334")
  const workflows = within(inventory).getByRole("grid", { name: "Workflows" })
  expect(workflows).toHaveTextContent("hospital-transfer-reservation")
})

test("the text filter matches names and stable names and lives in the URL", async () => {
  const { router } = await renderRoute("/topology")
  const input = await screen.findByRole("textbox", { name: "Filter declarations by name" })
  fireEvent.change(input, { target: { value: "RES" } })
  await waitFor(() => expect(currentSearch(router).q).toBe("RES"))
  const inventory = screen.getByRole("region", { name: "Declarations" })
  const names = within(inventory)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/topology/"))
    .map((link) => link.textContent)
  // `HospitalTransferReservation` matches by name; its stable name would match too.
  expect(names).toEqual([
    "HospitalTransferReservation",
    "RunReservationWorkflow",
    "SignalReservationConfirmation",
    "Reservation",
    "reservation_work",
    "reservation_work_dispatch",
  ])
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("6 of 25 declarations match")
})

test("a stable name matches even when the declared name does not", async () => {
  await renderRoute("/topology?q=hospital-surge")
  const inventory = await screen.findByRole("region", { name: "Declarations" })
  expect(within(inventory).getByRole("link", { name: "HospitalSurge" })).toBeInTheDocument()
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("1 of 25 declarations match")
})

test("the kind filter narrows to one kind and keeps the text filter", async () => {
  const { router } = await renderRoute("/topology?q=s")
  const kinds = await screen.findByRole("navigation", { name: "Filter declarations by kind" })
  const readModels = within(kinds).getByRole("link", { name: "Read models 4" })
  expect(readModels).toHaveAttribute("href", "/topology?q=s&kind=read-model&target=same-origin")
  await act(() => router.navigate({ to: "/topology", search: { q: "s", kind: "read-model" } }))
  const inventory = screen.getByRole("region", { name: "Declarations" })
  expect(
    within(inventory)
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent?.replace(/\s+\d+$/, "")),
  ).toEqual(["Read models"])
  expect(within(kinds).getByRole("link", { name: /^Read models/ })).toHaveAttribute(
    "data-selected",
    "true",
  )
  expect(within(kinds).getByRole("link", { name: /^All/ })).toHaveAttribute(
    "data-selected",
    "false",
  )
})

test("a filter with no matches does not read as an empty service", async () => {
  await renderRoute("/topology?q=zzzz")
  const none = await screen.findByTestId("topology-no-match")
  expect(none).toHaveTextContent("No declarations match the filter")
  expect(none).toHaveTextContent("The service has declarations")
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("0 of 25 declarations match")
  expect(within(none).getByRole("link", { name: "Clear the filter" })).toHaveAttribute(
    "href",
    "/topology?target=same-origin",
  )
})

test("an unknown kind in the URL is named and ignored, not treated as empty", async () => {
  await renderRoute("/topology?kind=gizmo")
  expect(await screen.findByTestId("topology-unknown-kind")).toHaveTextContent(
    '"gizmo" is not a declaration kind this console knows',
  )
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("25 declarations")
  expect(screen.queryByTestId("topology-no-match")).not.toBeInTheDocument()
})

test("an aggregate's page: details, location, machine, relations", async () => {
  await renderRoute("/topology/aggregate/Reservation")
  expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
    "Aggregate Reservation",
  )
  expect(screen.getByTestId("topology-location")).toHaveTextContent("hospital-capacity.keiro:334")
  expect(screen.getByTestId("detail-category")).toHaveTextContent("reservation")
  expect(within(screen.getByTestId("detail-commands")).getAllByRole("listitem")).toHaveLength(5)
  // The machine has its own section and is not repeated as raw JSON in Details.
  expect(screen.queryByTestId("detail-machine")).not.toBeInTheDocument()

  const machine = screen.getByRole("region", { name: "State machine" })
  expect(machine).toHaveTextContent("Ownership generated")
  const states = within(machine).getByRole("list", { name: "States" })
  expect(
    within(states)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "ReservationUnrequested · initial",
    "ReservationHeld",
    "ReservationConfirmed",
    "ReservationExpired · terminal",
    "ReservationAdmitted · terminal",
    "ReservationReleased · terminal",
  ])
  const rows = within(within(machine).getByRole("grid", { name: "Transitions" })).getAllByRole(
    "row",
  )
  expect(rows).toHaveLength(7)
  expect(rows[3]).toHaveTextContent(
    "ReservationHeldExpireReservationTransferReservationExpiredReservationExpiredlive1",
  )
  expect(screen.queryByTestId("machine-replay-only")).not.toBeInTheDocument()

  expect(screen.getByRole("region", { name: "Outgoing relations" })).toHaveTextContent(
    "None declared.",
  )
  const incoming = screen.getByRole("grid", { name: "Incoming relations" })
  expect(incoming).toHaveTextContent("dispatched to by dispatches")
  expect(incoming).toHaveTextContent("commandRequestTransferReservation")
  expect(within(incoming).getAllByRole("link", { name: "TransferNeedRouter" })[0]).toHaveAttribute(
    "href",
    "/topology/router/TransferNeedRouter?target=same-origin",
  )
})

test("a document from an older keiro-dsl has no machine and says why", async () => {
  const document = decode(topologyGolden("hospital-capacity"))
  for (const node of document.nodes) {
    delete node.details.machine
    delete node.details.category
  }
  serve(encode(document))
  await renderRoute("/topology/aggregate/Reservation")
  expect(await screen.findByTestId("machine-absent")).toHaveTextContent(
    "produced by a keiro-dsl version that did not export machines",
  )
  expect(screen.queryByRole("grid", { name: "Transitions" })).not.toBeInTheDocument()
  expect(screen.queryByTestId("detail-category")).not.toBeInTheDocument()
})

test("replay-only transitions, eventless transitions and legacy ownership are marked", async () => {
  const document = decode(topologyGolden("hospital-capacity"))
  const machine = document.nodes.find(
    (node: Json) => node.kind === "aggregate" && node.name === "Surge",
  ).details.machine
  machine.ownership = "legacy-hole"
  machine.edges[0].mode = "ReplayOnly"
  machine.edges[1].events = []
  serve(encode(document))
  await renderRoute("/topology/aggregate/Surge")
  expect(await screen.findByTestId("machine-legacy-hole")).toHaveTextContent(
    "hand-written and is not proven to match",
  )
  const rows = within(screen.getByRole("grid", { name: "Transitions" })).getAllByRole("row")
  expect(rows[1]).toHaveTextContent("replay only")
  expect(rows[2]).toHaveTextContent("MarkSurgeTimerFirednoneSurgeFollowedUplive")
  expect(screen.getByTestId("machine-replay-only")).toHaveTextContent("serves no new commands")
})

test("kinds without a typed view show every field, null as none, nested values as JSON", async () => {
  await renderRoute("/topology/projection-owner/accepted_transfer_needs_writer")
  expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
    "Projection owner accepted_transfer_needs_writer",
  )
  expect(screen.getByTestId("detail-subscription")).toHaveTextContent(
    "hospital-capacity-accepted-transfer-needs",
  )
  expect(screen.getByTestId("detail-order")).toHaveTextContent("20")
  // `replay` is `{mode, reason: null}` and `sources` a list of objects: both stay JSON.
  expect(within(screen.getByTestId("detail-replay")).getByRole("region")).toHaveTextContent(
    "reason",
  )
  expect(screen.getByTestId("detail-sources")).toHaveTextContent("incidentInbox")
  expect(screen.getByTestId("detail-targets")).toHaveTextContent("accepted_transfer_needs_table")
  expect(screen.queryByRole("region", { name: "State machine" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Read models fed" })).not.toBeInTheDocument()
})

test("a null detail reads none, never blank", async () => {
  serve("projection-catalog")
  await renderRoute("/topology/read-model/order_inline")
  await screen.findByRole("region", { name: "Details" })
  const document = decode(topologyGolden("projection-catalog"))
  const details = document.nodes.find(
    (node: Json) => node.kind === "read-model" && node.name === "order_inline",
  ).details as Json
  const nullField = Object.keys(details).find((key) => details[key] === null)
  expect(nullField).toBeDefined()
  expect(screen.getByTestId(`detail-${nullField}`)).toHaveTextContent("none")
})

test("the /2 document's feeds edge is shown from both of its declarations", async () => {
  serve("incident-command-sourced")
  const { router } = await renderRoute("/topology/intake/hospitalInbox")
  const outgoing = await screen.findByRole("grid", { name: "Outgoing relations" })
  const feeds = within(outgoing)
    .getAllByRole("row")
    .find((row) => row.textContent?.includes("feeds"))!
  expect(feeds).toHaveTextContent("Router CapacityChangeRouter")
  expect(feeds).toHaveTextContent("inputAcceptedHospitalCapacitySnapshot")
  expect(feeds).toHaveTextContent("HospitalCapacitySnapshotPublished")
  fireEvent.click(within(feeds).getByRole("link", { name: "CapacityChangeRouter" }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/topology/router/CapacityChangeRouter"),
  )
  const incoming = await screen.findByRole("grid", { name: "Incoming relations" })
  const fedBy = within(incoming)
    .getAllByRole("row")
    .find((row) => row.textContent?.includes("fed by"))!
  expect(fedBy).toHaveTextContent("Intake hospitalInbox")
  expect(within(fedBy).getByRole("link", { name: "hospitalInbox" })).toHaveAttribute(
    "href",
    "/topology/intake/hospitalInbox?target=same-origin",
  )
})

test("a declaration that is not in the document says so and links back", async () => {
  await renderRoute("/topology/aggregate/Nope")
  const state = await screen.findByTestId("topology-no-such-node")
  expect(state).toHaveTextContent("No such declaration in the mounted document")
  expect(state).toHaveTextContent("hospital-capacity declares no Aggregate named Nope")
  expect(within(state).getByRole("link", { name: "All declarations" })).toHaveAttribute(
    "href",
    "/topology?target=same-origin",
  )
})

test("the node page shows the topology's own state when there is no document", async () => {
  refuse("summary", 400, "invalid_request", { arguments: ["topology", "summary"] })
  await renderRoute("/topology/aggregate/Reservation")
  expect(await screen.findByTestId("topology-not-served")).toBeInTheDocument()
})

test("the trace follows consumes, writes, then observes or backed-by", () => {
  const index = indexTopology(parseTopologyDocument(decode(topologyGolden("projection-catalog"))))
  expect(
    readModelsFedBy(index, "aggregate:Orders").map((path) => [
      path.readModel.name,
      path.via,
      path.target.name,
      path.owner.name,
    ]),
  ).toEqual([
    ["order_inline", "observes", "order_summary", "order_summary_writer"],
    ["order_overview", "backed-by", "order_summary", "order_summary_writer"],
    ["order_overview", "observes", "order_summary", "order_summary_writer"],
    ["order_overview", "observes", "order_totals", "order_summary_writer"],
    ["order_totals_lookup", "observes", "order_totals", "order_summary_writer"],
  ])
  expect(readModelsFedBy(index, "aggregate:Shipments").map((p) => p.readModel.name)).toEqual([
    "shipmentLookup",
  ])
  // audit_writer reads a category, so it has no `consumes` edge and is on no aggregate's path.
  expect(
    readModelsFedBy(index, "aggregate:Orders").some((p) => p.readModel.name === "catalogAudit"),
  ).toBe(false)
  expect(readModelsFedBy(index, "aggregate:Missing")).toEqual([])
})

test("an aggregate lists the read models it feeds, or says no owner consumes it", async () => {
  serve("projection-catalog")
  const view = await renderRoute("/topology/aggregate/Orders")
  const fed = await screen.findByRole("region", { name: "Read models fed" })
  expect(within(fed).getAllByRole("listitem")).toHaveLength(5)
  expect(within(fed).getAllByRole("listitem")[1]).toHaveTextContent(
    "order_overview is backed by target order_summary, written by owner order_summary_writer",
  )
  expect(within(fed).getByRole("link", { name: "order_totals_lookup" })).toHaveAttribute(
    "href",
    "/topology/read-model/order_totals_lookup?target=same-origin",
  )
  // The host redeploys with another document; the page for an aggregate no owner consumes.
  serve("hospital-capacity")
  await act(() =>
    view.router.navigate({
      to: "/topology/$kind/$name",
      params: { kind: "aggregate", name: "Surge" },
    }),
  )
  await act(() => view.queryClient.invalidateQueries({ queryKey: keiroKeys.topology.all() }))
  expect(await screen.findByTestId("read-models-none")).toHaveTextContent(
    "No projection owner consumes this aggregate",
  )
})

test("a later failure keeps the verified document as stale; a definite answer replaces it", async () => {
  serve("hospital-capacity")
  const view = await renderRoute("/topology")
  expect(await screen.findByTestId("topology-service")).toHaveTextContent("hospital-capacity")
  expect(requests).toEqual({ summary: 1, show: 1 })

  // An unchanged host: the poll costs one summary and no document.
  await act(() => view.queryClient.invalidateQueries({ queryKey: keiroKeys.topology.all() }))
  await waitFor(() => expect(requests.summary).toBe(2))
  expect(requests.show).toBe(1)
  expect(screen.queryByTestId("topology-stale")).not.toBeInTheDocument()

  // The deployment starts changing: nothing definite, so the document stays and is marked.
  serve("incident-command", { summary: { document_sha256: `sha256:${"0".repeat(64)}` } })
  await act(() => view.queryClient.invalidateQueries({ queryKey: keiroKeys.topology.all() }))
  const stale = await screen.findByTestId("topology-stale")
  expect(stale).toHaveTextContent("the document verified earlier and may be out of date")
  expect(screen.getByTestId("topology-service")).toHaveTextContent("hospital-capacity")
  expect(screen.getByTestId("topology-digest")).toHaveTextContent(
    topologyDigest(topologyGolden("hospital-capacity")).slice(0, 15),
  )

  // The new host mounts nothing: a definite answer, so the old document is not shown.
  refuse("summary", 400, "invalid_request", { arguments: ["topology", "summary"] })
  await act(() => view.queryClient.invalidateQueries({ queryKey: keiroKeys.topology.all() }))
  expect(await screen.findByTestId("topology-not-served")).toBeInTheDocument()
  expect(screen.queryByTestId("topology-service")).not.toBeInTheDocument()
})
