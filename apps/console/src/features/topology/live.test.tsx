// Pages are rendered one after another on purpose: each needs the previous one unmounted.
/* oxlint-disable no-await-in-loop */
import { fixtureText, syntheticTopologySummary, topologyGolden } from "@keiro-ui/testing"
import { type MockServer, startMockServer, useScenario } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

type Json = Record<string, any>

/** Every keiro request path the page makes, in order. */
function recordKeiroPaths(): string[] {
  const paths: string[] = []
  mock.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.includes("/keiro/"))
      paths.push(`${request.method} ${url.pathname.replace(/^.*\/keiro/, "")}`)
  })
  return paths
}

const noTopology = () =>
  mock.use(
    http.get("*/keiro/topology/summary", () =>
      HttpResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "no topology",
            details: { arguments: ["topology", "summary"] },
          },
        },
        { status: 400 },
      ),
    ),
  )

const refuse = (path: string, words: string[]) =>
  mock.use(
    http.get(`*/keiro/${path}`, () =>
      HttpResponse.json(
        {
          error: { code: "invalid_request", message: "no hooks", details: { arguments: words } },
        },
        { status: 400 },
      ),
    ),
  )

function serveDocument(change: (document: Json) => void) {
  const document = JSON.parse(new TextDecoder().decode(topologyGolden("hospital-capacity"))) as Json
  change(document)
  const bytes = new TextEncoder().encode(`${JSON.stringify(document)}\n`)
  mock.use(
    http.get("*/keiro/topology/summary", () =>
      HttpResponse.text(syntheticTopologySummary(bytes), {
        headers: { "content-type": "application/json" },
      }),
    ),
    http.get(
      "*/keiro/topology/show",
      () =>
        new HttpResponse(bytes as BodyInit, { headers: { "content-type": "application/json" } }),
    ),
  )
}

const live = () => screen.findByRole("region", { name: "Live" })

// --- document versus host ---------------------------------------------------------------

test("the default stack's host disagrees with its document, and both sides are listed", async () => {
  // Recorded: Jitsurei mounts credit-limit, incident and order; the document is another service's.
  await renderRoute("/topology")
  const notice = await screen.findByTestId("agreement-disagrees")
  expect(notice).toHaveTextContent("Document and host disagree.")
  expect(notice).toHaveTextContent(
    "may be for a different build of this service or for another service",
  )
  expect(notice).toHaveTextContent("nothing has failed")
  const section = screen.getByRole("region", { name: "Document and host" })
  const declared = within(section).getByRole("list", { name: "Declared but not mounted" })
  expect(
    within(declared)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "Capacity category capacity",
    "Hospital category hospital",
    "Reservation category reservation",
    "Supply category supply",
    "Surge category surge",
  ])
  expect(within(declared).getByRole("link", { name: "Reservation" })).toHaveAttribute(
    "href",
    "/topology/aggregate/Reservation?target=same-origin",
  )
  const mounted = within(section).getByRole("list", { name: "Mounted but not declared" })
  expect(
    within(mounted)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["credit-limit", "incident", "order"])
  expect(within(mounted).getByRole("link", { name: "order" })).toHaveAttribute(
    "href",
    "/aggregates/order?target=same-origin",
  )
  expect(within(section).queryByRole("list", { name: "Declared and mounted" })).toBeNull()
  // It is a finding, not an error state: the document is still shown in full.
  expect(screen.getByTestId("topology-shown")).toHaveTextContent("25 declarations")
})

test("SYNTHETIC joined host: the mounted aggregates match the document", async () => {
  useScenario({ joined: true })
  await renderRoute("/topology")
  const notice = await screen.findByTestId("agreement-agrees")
  expect(notice).toHaveTextContent(
    "The mounted aggregates match the document: 5 declared aggregates",
  )
  expect(notice).toHaveTextContent("compares aggregate names only")
  expect(screen.queryByTestId("agreement-disagrees")).not.toBeInTheDocument()
})

test("a partial match lists all three groups", async () => {
  mock.use(
    http.get("*/keiro/aggregate/types", () =>
      HttpResponse.json({
        items: ["surge", "order"].map((name) => ({
          name,
          category: name,
          snapshots_configured: false,
          snapshot_policy: "never",
        })),
      }),
    ),
  )
  await renderRoute("/topology")
  await screen.findByTestId("agreement-disagrees")
  const section = screen.getByRole("region", { name: "Document and host" })
  expect(within(section).getByRole("list", { name: "Declared and mounted" })).toHaveTextContent(
    "Surge as surge",
  )
  expect(
    within(within(section).getByRole("list", { name: "Declared but not mounted" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(4)
  expect(within(section).getByRole("list", { name: "Mounted but not declared" })).toHaveTextContent(
    "order",
  )
})

test("a host without aggregate hooks cannot be compared, which is not agreement or emptiness", async () => {
  refuse("aggregate/types", ["aggregate", "types"])
  await renderRoute("/topology")
  const notice = await screen.findByTestId("agreement-cannot-compare")
  expect(notice).toHaveTextContent("Cannot compare: this host does not mount aggregate inspection")
  expect(notice).toHaveTextContent("/keiro/aggregate/types")
  expect(notice).toHaveTextContent("not a statement that the host runs none")
  expect(screen.queryByTestId("agreement-agrees")).not.toBeInTheDocument()
  expect(screen.queryByTestId("agreement-disagrees")).not.toBeInTheDocument()
})

test("a catalogue failure is not a comparison either", async () => {
  mock.use(
    http.get("*/keiro/aggregate/types", () =>
      HttpResponse.json({ error: { code: "schema_drift", message: "drifted" } }, { status: 409 }),
    ),
  )
  await renderRoute("/topology")
  const notice = await screen.findByTestId("agreement-failed")
  expect(notice).toHaveTextContent("409 schema_drift")
  expect(notice).toHaveTextContent("drifted")
})

test("aggregates without a category are listed apart as not comparable", async () => {
  serveDocument((document) => {
    for (const node of document.nodes) delete node.details.category
  })
  mock.use(http.get("*/keiro/aggregate/types", () => HttpResponse.json({ items: [] })))
  await renderRoute("/topology")
  const section = await screen.findByRole("region", { name: "Document and host" })
  await within(section).findByTestId("agreement-agrees")
  expect(
    within(
      within(section).getByRole("list", {
        name: "Declared without a category, so not comparable",
      }),
    ).getAllByRole("listitem"),
  ).toHaveLength(5)
})

// --- links from declarations ------------------------------------------------------------

test("default stack: an aggregate declaration says no mounted type matches its category", async () => {
  await renderRoute("/topology/aggregate/Reservation")
  const section = await live()
  expect(await within(section).findByTestId("live-no-match")).toHaveTextContent(
    "No mounted aggregate type is named reservation, the value this declaration joins by.",
  )
  expect(within(section).queryByRole("link")).toBeNull()
})

test("SYNTHETIC joined host: aggregate and process declarations link to their live screens", async () => {
  useScenario({ joined: true })
  const view = await renderRoute("/topology/aggregate/Reservation")
  const linked = await within(await live()).findByTestId("live-linked")
  expect(within(linked).getByRole("link", { name: "Instances of reservation" })).toHaveAttribute(
    "href",
    "/aggregates/reservation?target=same-origin",
  )
  expect(linked).toHaveTextContent("Holds when the host mounts the aggregate inspector catalog")
  view.unmount()

  useScenario({ joined: true })
  await renderRoute("/topology/process/HospitalSurge")
  const process = await within(await live()).findByTestId("live-linked")
  expect(
    within(process).getByRole("link", { name: "Instances of hospital-surge" }),
  ).toHaveAttribute("href", "/process-managers/hospital-surge?target=same-origin")
  expect(process).toHaveTextContent("The manager's name is chosen by the host")
})

test("default stack: the process's saga category matches no mounted manager", async () => {
  await renderRoute("/topology/process/HospitalSurge")
  expect(await within(await live()).findByTestId("live-no-match")).toHaveTextContent(
    "No mounted process manager has the category hospitalSurge",
  )
})

test("two managers with the saga category are named and none is chosen", async () => {
  mock.use(
    http.get("*/keiro/pm/types", () =>
      HttpResponse.json({
        items: ["surge-east", "surge-west"].map((name) => ({
          name,
          category: "hospitalSurge",
          snapshots_configured: false,
          snapshot_policy: "never",
          timers_configured: null,
        })),
      }),
    ),
  )
  await renderRoute("/topology/process/HospitalSurge")
  const ambiguous = await within(await live()).findByTestId("live-ambiguous")
  expect(ambiguous).toHaveTextContent("2 mounted process managers share the category hospitalSurge")
  expect(
    within(ambiguous)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["surge-east", "surge-west"])
})

test("a host without hooks cannot link an aggregate or a process, and says what that means", async () => {
  refuse("aggregate/types", ["aggregate", "types"])
  const view = await renderRoute("/topology/aggregate/Surge")
  const aggregate = await within(await live()).findByTestId("live-not-mounted")
  expect(aggregate).toHaveTextContent("does not mount the inspection hooks")
  expect(aggregate).toHaveTextContent("/keiro/aggregate/types")
  expect(aggregate).toHaveTextContent("says nothing about whether the declaration is running")
  view.unmount()

  refuse("pm/types", ["pm", "types"])
  await renderRoute("/topology/process/HospitalSurge")
  expect(await within(await live()).findByTestId("live-not-mounted")).toHaveTextContent(
    "/keiro/pm/types",
  )
})

test("an aggregate from an older document has no join field", async () => {
  serveDocument((document) => {
    for (const node of document.nodes) delete node.details.category
  })
  await renderRoute("/topology/aggregate/Surge")
  expect(await within(await live()).findByTestId("live-no-field")).toHaveTextContent(
    "does not carry details.category",
  )
})

test("a workflow links by its stable name and shows that name's exact totals", async () => {
  await renderRoute("/topology/workflow/HospitalTransferReservation")
  const section = await live()
  const linked = within(section).getByTestId("live-linked")
  expect(
    within(linked).getByRole("link", {
      name: "Workflow instances named hospital-transfer-reservation",
    }),
  ).toHaveAttribute(
    "href",
    "/workflows?workflow_name=hospital-transfer-reservation&target=same-origin",
  )
  expect(linked).toHaveTextContent("no list of workflow names to check it against")
  // The existing totals card, scoped to that exact name.
  expect(
    within(section).getByRole("region", { name: "Workflow status totals" }),
  ).toBeInTheDocument()
})

test("a projection owner links to its subscription; an inline owner says it has none", async () => {
  const view = await renderRoute("/topology/projection-owner/transfer_candidates_writer")
  const linked = await within(await live()).findByTestId("live-linked")
  expect(
    within(linked).getByRole("link", {
      name: "Subscription hospital-capacity-transfer-candidates-router",
    }),
  ).toHaveAttribute(
    "href",
    "/subscriptions/hospital-capacity-transfer-candidates-router?target=same-origin",
  )
  view.unmount()

  serveDocument((document) => {
    const owner = document.nodes.find((node: Json) => node.name === "transfer_candidates_writer")
    owner.details.subscription = null
    owner.details.delivery = "inline"
  })
  await renderRoute("/topology/projection-owner/transfer_candidates_writer")
  expect(await within(await live()).findByTestId("live-inline")).toHaveTextContent(
    "delivered inline",
  )
})

test.each([
  ["workqueue/reservation_work", "every one of them changes the queue"],
  ["intake/incidentInbox", "no field of an intake declaration is that source"],
  ["emit/hospitalIntegrationOutbox", "not enforced by generated code"],
])("%s states why it has no live link", async (path, reason) => {
  await renderRoute(`/topology/${path}`)
  const unjoinable = await within(await live()).findByTestId("live-unjoinable")
  expect(unjoinable).toHaveTextContent("Not linked.")
  expect(unjoinable).toHaveTextContent(reason)
  expect(within(unjoinable).queryByRole("link")).toBeNull()
})

test("a kind with no live counterpart has no Live section and reads no catalogue", async () => {
  const paths = recordKeiroPaths()
  await renderRoute("/topology/read-model/transfer_candidates")
  await screen.findByRole("region", { name: "Relations" })
  expect(screen.queryByRole("region", { name: "Live" })).not.toBeInTheDocument()
  expect(
    paths.some((path) => path.endsWith("/aggregate/types") || path.endsWith("/pm/types")),
  ).toBe(false)
})

// --- declarations on live screens -------------------------------------------------------

test("default stack: live screens show no declaration panel and no error about it", async () => {
  for (const path of [
    "/aggregates/order",
    "/process-managers/jitsurei-fulfillment",
    "/workflows?workflow_name=order-fulfillment",
    "/projections/jitsurei-order-reporting",
  ]) {
    const view = await renderRoute(path)
    await screen.findAllByRole("grid")
    await waitFor(() => expect(screen.getByRole("main")).not.toHaveTextContent("Loading…"))
    expect(screen.queryByTestId("declaration-panel"), path).not.toBeInTheDocument()
    expect(screen.getByRole("main"), path).not.toHaveTextContent(/topology/i)
    view.unmount()
  }
})

test("SYNTHETIC joined host: an aggregate type's page shows its declaration and machine", async () => {
  useScenario({ joined: true })
  await renderRoute("/aggregates/reservation")
  const panel = await screen.findByTestId("declaration-panel")
  expect(panel).toHaveTextContent("Declared in specification")
  expect(panel).toHaveTextContent("Aggregate Reservation")
  expect(panel).toHaveTextContent("hospital-capacity.keiro:334")
  expect(within(panel).getByRole("link", { name: "Reservation" })).toHaveAttribute(
    "href",
    "/topology/aggregate/Reservation?target=same-origin",
  )
  // The machine is beside the instances, collapsed until asked for.
  expect(within(panel).queryByRole("grid", { name: "Transitions" })).not.toBeInTheDocument()
  fireEvent.click(within(panel).getByRole("button", { name: "Show the declared state machine" }))
  const transitions = await within(panel).findByRole("grid", { name: "Transitions" })
  expect(within(transitions).getAllByRole("row")).toHaveLength(7)
  expect(within(panel).getByTestId("machine-diagram")).toBeInTheDocument()
  expect(screen.getByRole("grid", { name: "Aggregate instances" })).toBeInTheDocument()
})

test("SYNTHETIC joined host: a process manager's page shows its process and saga machine", async () => {
  useScenario({ joined: true })
  await renderRoute("/process-managers/hospital-surge")
  const panel = await screen.findByTestId("declaration-panel")
  expect(panel).toHaveTextContent("Process HospitalSurge")
  expect(panel).toHaveTextContent("keeps its progress in the saga aggregate Surge")
  expect(within(panel).getByRole("link", { name: "Surge" })).toHaveAttribute(
    "href",
    "/topology/aggregate/Surge?target=same-origin",
  )
  fireEvent.click(
    within(panel).getByRole("button", { name: "Show the declared state machine of Surge" }),
  )
  expect(
    within(await within(panel).findByRole("grid", { name: "Transitions" })).getAllByRole("row"),
  ).toHaveLength(3)
})

test("a workflow list filtered to a declared name, and its instance page, show the declared steps", async () => {
  const view = await renderRoute("/workflows?workflow_name=hospital-transfer-reservation")
  const panel = await screen.findByTestId("declaration-panel")
  expect(panel).toHaveTextContent("Workflow HospitalTransferReservation")
  expect(
    within(within(panel).getByRole("list", { name: "Declared steps" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "1. step create-transfer-hold",
    "2. await reservation-confirmation",
    "3. step release-or-retain-capacity",
    "4. step summarize-reservation",
  ])
  view.unmount()

  // Unfiltered, or filtered to a name the document does not declare: no panel.
  const all = await renderRoute("/workflows")
  await screen.findByRole("grid", { name: "Workflow instances" })
  expect(screen.queryByTestId("declaration-panel")).not.toBeInTheDocument()
  all.unmount()

  // SYNTHETIC: the recorded instance header, served under the declared workflow name.
  const header = JSON.parse(fixtureText("keiro/workflow-header.json")) as Json
  header.workflow_name = "hospital-transfer-reservation"
  mock.use(http.get("*/keiro/wf/inspect/header/*", () => HttpResponse.json(header)))
  await renderRoute(`/workflows/hospital-transfer-reservation/${header.workflow_id}`)
  expect(await screen.findByTestId("declaration-panel")).toHaveTextContent(
    "Workflow HospitalTransferReservation",
  )
})

test("a projection group shows the owner declared for a subscription the host reports", async () => {
  const status = JSON.parse(fixtureText("keiro/projection-status.json")) as Json
  const group = status.items.find((item: Json) => item.group_id === "jitsurei-order-reporting")
  // SYNTHETIC: the recorded group, reported as fed by a subscription the document declares.
  group.feeding_subscriptions = ["hospital-capacity-transfer-candidates-router"]
  mock.use(http.get("*/keiro/projection/status", () => HttpResponse.json(status)))
  await renderRoute("/projections/jitsurei-order-reporting")
  const panel = await screen.findByTestId("declaration-panel")
  expect(panel).toHaveTextContent("Projection owner transfer_candidates_writer")
  expect(panel).toHaveTextContent(
    "Declared for subscription hospital-capacity-transfer-candidates-router",
  )
})

test("a group whose name equals a declared group is not matched by name", async () => {
  const status = JSON.parse(fixtureText("keiro/projection-status.json")) as Json
  const group = status.items.find((item: Json) => item.group_id === "jitsurei-order-reporting")
  // SYNTHETIC: the host does not report feeding subscriptions; only the group id matches.
  group.group_id = "hospital_routing"
  delete group.feeding_subscriptions
  mock.use(http.get("*/keiro/projection/status", () => HttpResponse.json(status)))
  await renderRoute("/projections/hospital_routing")
  await screen.findByRole("heading", { level: 1 })
  await waitFor(() => expect(screen.getByRole("main")).toHaveTextContent("hospital_routing"))
  expect(screen.queryByTestId("declaration-panel")).not.toBeInTheDocument()
})

test("a host that serves no topology: live screens are unchanged and ask only for the summary", async () => {
  noTopology()
  useScenario({ joined: true })
  const paths = recordKeiroPaths()
  for (const path of [
    "/aggregates/reservation",
    "/process-managers/hospital-surge",
    "/workflows?workflow_name=hospital-transfer-reservation",
  ]) {
    const view = await renderRoute(path)
    await screen.findAllByRole("grid")
    await waitFor(() => expect(screen.getByRole("main")).not.toHaveTextContent("Loading…"))
    expect(screen.queryByTestId("declaration-panel"), path).not.toBeInTheDocument()
    expect(screen.queryByTestId("topology-not-served"), path).not.toBeInTheDocument()
    expect(screen.getByRole("main"), path).not.toHaveTextContent(/topology/i)
    view.unmount()
  }
  const topology = paths.filter((path) => path.includes("/topology/"))
  expect(new Set(topology)).toEqual(new Set(["GET /topology/summary"]))
  // One summary per page, no document, and the process-manager page did not read the catalogue.
  expect(topology).toHaveLength(3)
  expect(paths.some((path) => path.endsWith("/pm/types"))).toBe(false)
  expect(paths.every((path) => path.startsWith("GET "))).toBe(true)
})
