import { type AggregateMachine, indexTopology, parseTopologyDocument } from "@keiro-ui/client-keiro"
import {
  syntheticTopologySummary,
  topologyGolden,
  type TopologyGoldenName,
} from "@keiro-ui/testing"
import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

import * as layoutModule from "./layout"
import { MachineDiagram, machineGraph } from "./MachineDiagram"
import { parseGroups } from "./MapPage"
import { MAP_NODE_THRESHOLD, mapView, relationLines } from "./ServiceMap"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => {
  mock.reset()
  vi.restoreAllMocks()
})
afterAll(() => mock.close())

type Json = Record<string, any>
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)) as Json
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)
const indexOf = (name: TopologyGoldenName) =>
  indexTopology(parseTopologyDocument(decode(topologyGolden(name))))

/** Replaces the recorded document; the summary is synthetic, computed from the bytes. */
function serve(document: TopologyGoldenName | Uint8Array) {
  const bytes = typeof document === "string" ? topologyGolden(document) : document
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

const nodesIn = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-graph-node]")].map((el) => el.getAttribute("data-graph-node"))

// --- the machine diagram ----------------------------------------------------------------

test("an aggregate's page draws one node per state and one label per transition, above the table", async () => {
  await renderRoute("/topology/aggregate/Reservation")
  const diagram = await screen.findByTestId("machine-diagram")
  expect(nodesIn(diagram)).toHaveLength(6)
  expect(diagram.querySelectorAll("[data-transition]")).toHaveLength(6)
  // The initial and terminal states are marked as text and as shape.
  const initial = within(diagram).getByRole("button", {
    name: "State ReservationUnrequested, initial",
  })
  expect(initial.querySelector("[data-initial]")).not.toBeNull()
  expect(initial).toHaveTextContent("initial")
  for (const name of ["ReservationExpired", "ReservationAdmitted", "ReservationReleased"]) {
    const state = within(diagram).getByRole("button", { name: `State ${name}, terminal` })
    expect(state.querySelector("[data-terminal]")).not.toBeNull()
    expect(state).toHaveTextContent("terminal")
  }
  expect(
    within(diagram)
      .getByRole("button", { name: "State ReservationHeld" })
      .querySelector("[data-terminal],[data-initial]"),
  ).toBeNull()
  // It names the table that carries the same information, and sits above it.
  const svg = diagram.querySelector('svg[role="group"]')!
  expect(svg.querySelector("title")).toHaveTextContent("State machine diagram")
  expect(svg.querySelector("desc")).toHaveTextContent("Transitions table below")
  const table = screen.getByRole("grid", { name: "Transitions" })
  expect(diagram.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(table).getAllByRole("row")).toHaveLength(7)
})

test("selecting a transition in the diagram or in the table highlights it in both", async () => {
  await renderRoute("/topology/aggregate/Reservation")
  const diagram = await screen.findByTestId("machine-diagram")
  const table = screen.getByRole("grid", { name: "Transitions" })
  const row = (id: string) => table.querySelector(`[data-transition-row="${id}"]`) as HTMLElement
  const label = (id: string) => diagram.querySelector(`[data-transition="${id}"]`) as HTMLElement

  fireEvent.click(label("ReservationHeld#1"))
  expect(label("ReservationHeld#1")).toHaveAttribute("data-selected", "true")
  expect(row("ReservationHeld#1")).toHaveAttribute("data-transition-selected", "true")
  expect(row("ReservationHeld#0")).toHaveAttribute("data-transition-selected", "false")
  // The transition's edge and its two states are emphasised; the rest is dimmed.
  expect(diagram.querySelector('[data-graph-node="ReservationHeld"]')).not.toHaveClass("opacity-30")
  expect(diagram.querySelector('[data-graph-node="ReservationAdmitted"]')).toHaveClass("opacity-30")

  fireEvent.click(within(row("ReservationConfirmed#0")).getAllByRole("gridcell")[0]!)
  await waitFor(() =>
    expect(label("ReservationConfirmed#0")).toHaveAttribute("data-selected", "true"),
  )
  expect(label("ReservationHeld#1")).toHaveAttribute("data-selected", "false")

  // Keyboard: Enter on a focused transition label toggles it off again.
  fireEvent.keyDown(label("ReservationConfirmed#0"), { key: "Enter" })
  expect(label("ReservationConfirmed#0")).toHaveAttribute("data-selected", "false")
})

// SYNTHETIC: no golden has a replay-only transition, so this machine is made up to cover it,
// together with a self-transition and two transitions sharing a source and a target.
const syntheticMachine: AggregateMachine = {
  ownership: "generated",
  initial: "Open",
  states: [
    { name: "Open", terminal: false },
    { name: "Closed", terminal: true },
  ],
  edges: [
    { source: "Open", edgeIndex: 0, target: "Open", mode: "Live", command: "Touch", events: [] },
    {
      source: "Open",
      edgeIndex: 1,
      target: "Closed",
      mode: "Live",
      command: "Close",
      events: ["Closed"],
    },
    {
      source: "Open",
      edgeIndex: 2,
      target: "Closed",
      mode: "ReplayOnly",
      command: "LegacyClose",
      events: ["ClosedV1", "Archived"],
    },
    {
      source: "Closed",
      edgeIndex: 0,
      target: "Open",
      mode: "ReplayOnly",
      command: "Reopen",
      events: ["Reopened"],
    },
  ],
}

test("the goldens have no replay-only transition, which is why one is synthesised", () => {
  for (const name of [
    "hospital-capacity",
    "incident-command-sourced",
    "projection-catalog",
  ] as const)
    expect(new TextDecoder().decode(topologyGolden(name))).not.toContain("ReplayOnly")
})

test("a synthetic machine: self-transition, parallel transitions and replay-only marking", () => {
  const graph = machineGraph(syntheticMachine)
  // Open→Closed carries two transitions on one drawn edge; each keeps its own lines.
  expect(graph.edges.map((edge) => [edge.source, edge.target, edge.transitions.length])).toEqual([
    ["Open", "Open", 1],
    ["Open", "Closed", 2],
    ["Closed", "Open", 1],
  ])
  const onSelect = vi.fn()
  const { container } = render(<MachineDiagram machine={syntheticMachine} onSelect={onSelect} />)
  expect(nodesIn(container)).toEqual(["Open", "Closed"])
  expect(screen.getByRole("button", { name: "State Open, initial" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "State Closed, terminal" })).toBeInTheDocument()
  const labels = [...container.querySelectorAll("[data-transition]")].map((el) => el.textContent)
  expect(labels).toEqual([
    "Touchno events",
    "CloseClosed",
    "LegacyClose (replay only)ClosedV1, Archived",
    "Reopen (replay only)Reopened",
  ])
  // Dashed only when every transition on the drawn edge is replay-only.
  const dashed = [...container.querySelectorAll("[data-graph-edge]")].map((el) => [
    el.getAttribute("data-graph-edge"),
    el.getAttribute("data-dashed"),
  ])
  expect(dashed).toEqual([
    ["Open#0", "false"],
    ["Open#1|Open#2", "false"],
    ["Closed#0", "true"],
  ])
  expect(container.querySelector("figcaption")).toHaveTextContent("replay-only transition")
  fireEvent.click(container.querySelector('[data-transition="Open#2"]')!)
  expect(onSelect).toHaveBeenCalledWith("Open#2")
  // The self-transition is a drawn loop: it starts and ends on its own state.
  expect(container.querySelector('[data-graph-edge="Open#0"]')!.getAttribute("d")).toMatch(/^M/)
})

test("when the diagram cannot be drawn, the table is shown alone with a note", async () => {
  vi.spyOn(layoutModule, "layoutGraph").mockImplementation(() => {
    throw new Error("layout failed")
  })
  vi.spyOn(console, "error").mockImplementation(() => {})
  await renderRoute("/topology/aggregate/Reservation")
  expect(await screen.findByTestId("machine-diagram-failed")).toHaveTextContent(
    "The diagram could not be drawn",
  )
  expect(screen.queryByTestId("machine-diagram")).not.toBeInTheDocument()
  expect(
    within(screen.getByRole("grid", { name: "Transitions" })).getAllByRole("row"),
  ).toHaveLength(7)
  expect(screen.getByRole("list", { name: "States" })).toBeInTheDocument()
})

test("an aggregate without a machine draws nothing and says why", async () => {
  const document = decode(topologyGolden("hospital-capacity"))
  for (const node of document.nodes) delete node.details.machine
  serve(encode(document))
  await renderRoute("/topology/aggregate/Reservation")
  expect(await screen.findByTestId("machine-absent")).toBeInTheDocument()
  expect(screen.queryByTestId("machine-diagram")).not.toBeInTheDocument()
})

// --- the map's view ---------------------------------------------------------------------

test("the whole hospital service: every declaration and every relation is drawn", () => {
  const view = mapView(indexOf("hospital-capacity"), {})
  expect(view.nodes).toHaveLength(25)
  expect(view.shownEdges).toBe(27)
  expect(view.bundles.reduce((total, bundle) => total + bundle.relations.length, 0)).toBe(27)
  expect(relationLines(["dispatches", "projects", "dispatches"])).toEqual([
    "dispatches ×2",
    "projects",
  ])
})

test("a focus at depth 1 leaves exactly the declarations its Relations tables list", () => {
  const index = indexOf("hospital-capacity")
  const key = "aggregate:Reservation"
  const related = new Set([
    key,
    ...index.outgoing(key).map((edge) => `${edge.to.kind}:${edge.to.name}`),
    ...index.incoming(key).map((edge) => `${edge.from.kind}:${edge.from.name}`),
  ])
  const view = mapView(index, { focus: key, depth: 1 })
  expect(new Set(view.nodes.map((node) => `${node.kind}:${node.name}`))).toEqual(related)
  expect(view.focus).toBe(key)
  // Depth 2 reaches further and still contains depth 1.
  const wider = mapView(index, { focus: key, depth: 2 })
  expect(wider.nodes.length).toBeGreaterThan(view.nodes.length)
  // An unknown focus is ignored, not treated as an empty neighbourhood.
  expect(mapView(index, { focus: "aggregate:Nope" })).toMatchObject({ focus: undefined })
  expect(mapView(index, { focus: "aggregate:Nope" }).nodes).toHaveLength(25)
})

test("kind groups filter declarations; the focused declaration always stays", () => {
  const index = indexOf("hospital-capacity")
  const withoutProjections = mapView(index, {
    groups: ["messaging", "coordination", "state", "queues"],
  })
  expect(withoutProjections.nodes).toHaveLength(16)
  expect(withoutProjections.nodes.some((node) => node.kind === "read-model")).toBe(false)
  expect(withoutProjections.shownEdges).toBeLessThan(27)
  const focused = mapView(index, { groups: ["messaging"], focus: "aggregate:Surge", depth: 1 })
  expect(focused.nodes.map((node) => node.name)).toEqual(["Surge"])
  expect(parseGroups(undefined)).toHaveLength(5)
  expect(parseGroups("state,nonsense,queues")).toEqual(["state", "queues"])
  expect(parseGroups("")).toEqual([])
})

// --- the map route ----------------------------------------------------------------------

test("the map draws the whole recorded service and says so", async () => {
  await renderRoute("/topology/map")
  const map = await screen.findByTestId("service-map")
  expect(nodesIn(map)).toHaveLength(25)
  expect(screen.getByTestId("map-counts")).toHaveTextContent(
    "Drawing 25 of 25 declarations and 27 of 27 relations. This is the whole service.",
  )
  // The kind group is written on each node, not only shown as a tint.
  expect(within(map).getByRole("button", { name: "Aggregate Reservation" })).toHaveTextContent(
    "State · AggregateReservation",
  )
  expect(map.querySelector("desc")).toHaveTextContent("Each declaration's page lists the same")
  expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute(
    "href",
    "/topology/map?target=same-origin",
  )
})

test("groups, focus and depth come from the URL, and hidden counts are stated", async () => {
  const { router } = await renderRoute("/topology/map?groups=messaging,coordination,state,queues")
  const map = await screen.findByTestId("service-map")
  expect(nodesIn(map)).toHaveLength(16)
  expect(screen.getByTestId("map-counts")).toHaveTextContent(
    "Drawing 16 of 25 declarations and 13 of 27 relations. 9 declarations and 14 relations are hidden by the current view, so this is not the whole service.",
  )
  const groups = screen.getByRole("navigation", { name: "Kind groups drawn" })
  const projections = within(groups).getByRole("link", { name: /Show Projections/ })
  expect(projections).toHaveAttribute("data-selected", "false")
  expect(projections).toHaveAttribute("href", "/topology/map?target=same-origin")
  expect(within(groups).getByRole("link", { name: /Hide State/ })).toHaveAttribute(
    "href",
    "/topology/map?groups=messaging%2Ccoordination%2Cqueues&target=same-origin",
  )

  await act(() =>
    router.navigate({ to: "/topology/map", search: { focus: "aggregate:Reservation" } }),
  )
  expect(nodesIn(screen.getByTestId("service-map")).toSorted()).toEqual([
    "aggregate:Reservation",
    "router:TransferNeedRouter",
  ])
  expect(screen.getByTestId("map-focus")).toHaveTextContent("Focused on Aggregate Reservation")
  const depth2 = within(screen.getByTestId("map-focus")).getByRole("link", { name: "2 relations" })
  expect(depth2).toHaveAttribute(
    "href",
    "/topology/map?focus=aggregate%3AReservation&depth=2&target=same-origin",
  )
  await act(() =>
    router.navigate({ to: "/topology/map", search: { focus: "aggregate:Reservation", depth: 2 } }),
  )
  expect(nodesIn(screen.getByTestId("service-map")).length).toBeGreaterThan(2)
  expect(
    within(screen.getByTestId("map-focus")).getByRole("link", { name: "Show the whole service" }),
  ).toHaveAttribute("href", "/topology/map?target=same-origin")
})

test("selecting a declaration highlights its relations and offers its page; Enter focuses the map", async () => {
  const { router } = await renderRoute("/topology/map")
  const map = await screen.findByTestId("service-map")
  const surge = within(map).getByRole("button", { name: "Aggregate Surge" })
  fireEvent.click(surge)
  const panel = screen.getByTestId("map-selection")
  expect(panel).toHaveTextContent("Aggregate Surge")
  expect(within(panel).getByRole("link", { name: "Open declaration" })).toHaveAttribute(
    "href",
    "/topology/aggregate/Surge?target=same-origin",
  )
  expect(surge).toHaveAttribute("aria-pressed", "true")
  expect(within(map).getByRole("button", { name: "Process HospitalSurge" })).not.toHaveClass(
    "opacity-30",
  )
  expect(within(map).getByRole("button", { name: "Aggregate Supply" })).toHaveClass("opacity-30")

  // Arrow keys move focus along relations and through the drawing order.
  const process = within(map).getByRole("button", { name: "Process HospitalSurge" })
  process.focus()
  fireEvent.keyDown(process, { key: "ArrowRight" })
  expect(document.activeElement).toHaveAttribute(
    "data-graph-node",
    expect.stringMatching(/^aggregate:/),
  )
  fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" })
  expect(document.activeElement).toHaveAttribute("data-graph-node")
  fireEvent.keyDown(document.activeElement!, { key: "Home" })
  const first = document.activeElement!
  fireEvent.keyDown(first, { key: "ArrowDown" })
  expect(document.activeElement).not.toBe(first)

  fireEvent.keyDown(surge, { key: "Enter" })
  await waitFor(() => expect(currentSearch(router).focus).toBe("aggregate:Surge"))
  expect(await screen.findByTestId("map-focus")).toHaveTextContent("Focused on Aggregate Surge")
})

test("zoom controls are buttons and change the drawn size", async () => {
  await renderRoute("/topology/map")
  const map = await screen.findByTestId("service-map")
  const svg = map.querySelector('svg[role="group"]')!
  const width = Number(svg.getAttribute("width"))
  expect(screen.getByTestId("graph-scale")).toHaveTextContent("100%")
  fireEvent.click(within(map).getByRole("button", { name: "Zoom in" }))
  expect(screen.getByTestId("graph-scale")).toHaveTextContent("125%")
  expect(Number(svg.getAttribute("width"))).toBeCloseTo(width * 1.25)
  fireEvent.click(within(map).getByRole("button", { name: "Zoom out" }))
  fireEvent.click(within(map).getByRole("button", { name: "Zoom out" }))
  expect(screen.getByTestId("graph-scale")).toHaveTextContent("80%")
  fireEvent.click(within(map).getByRole("button", { name: "100%" }))
  expect(Number(svg.getAttribute("width"))).toBe(width)
})

test("an unknown focus is named and ignored; an empty group selection is not an empty service", async () => {
  const { router } = await renderRoute("/topology/map?focus=aggregate:Nope")
  expect(await screen.findByTestId("map-focus-unknown")).toHaveTextContent("aggregate:Nope")
  expect(nodesIn(screen.getByTestId("service-map"))).toHaveLength(25)
  await act(() => router.navigate({ to: "/topology/map", search: { groups: "" } }))
  expect(await screen.findByTestId("map-empty")).toHaveTextContent("The service has declarations")
})

test("a service above the threshold is not drawn whole: it offers groups and a search", async () => {
  // SYNTHETIC: the hospital document with 90 extra read models, to exceed the threshold.
  const document = decode(topologyGolden("hospital-capacity"))
  for (let i = 0; i < 90; i += 1)
    document.nodes.push({
      kind: "read-model",
      name: `synthetic_${String(i).padStart(2, "0")}`,
      context: "hospital-capacity",
      member: "hospital-capacity.keiro",
      line: 900 + i,
      details: {},
    })
  serve(encode(document))
  const { router } = await renderRoute("/topology/map")
  const notice = await screen.findByTestId("map-too-large")
  expect(notice).toHaveTextContent(`115 declarations, more than the ${MAP_NODE_THRESHOLD}`)
  expect(screen.queryByTestId("service-map")).not.toBeInTheDocument()
  expect(within(notice).getByRole("link", { name: "Only State 5" })).toHaveAttribute(
    "href",
    "/topology/map?groups=state&target=same-origin",
  )
  fireEvent.change(
    within(notice).getByRole("textbox", { name: "Find a declaration to focus on" }),
    {
      target: { value: "surge" },
    },
  )
  const match = within(
    within(notice).getByRole("list", { name: "Matching declarations" }),
  ).getByRole("link", { name: "HospitalSurge" })
  expect(match).toHaveAttribute(
    "href",
    "/topology/map?focus=process%3AHospitalSurge&target=same-origin",
  )
  // A group or a focus small enough is drawn.
  await act(() => router.navigate({ to: "/topology/map", search: { groups: "state" } }))
  expect(nodesIn(await screen.findByTestId("service-map"))).toHaveLength(5)
  await act(() =>
    router.navigate({ to: "/topology/map", search: { focus: "process:HospitalSurge" } }),
  )
  expect(nodesIn(await screen.findByTestId("service-map")).length).toBeLessThan(10)
})

test("a declaration's page shows its neighbourhood with a link into the map", async () => {
  await renderRoute("/topology/process/HospitalSurge")
  const section = await screen.findByRole("region", { name: "Neighbourhood" })
  // Exactly what its Relations tables list: three aggregates, by five relations.
  expect(nodesIn(section).toSorted()).toEqual([
    "aggregate:Capacity",
    "aggregate:Hospital",
    "aggregate:Surge",
    "process:HospitalSurge",
  ])
  expect(within(section).getByTestId("map-counts")).toHaveTextContent("5 of 27 relations")
  expect(section).toHaveTextContent("dispatchesprojects")
  expect(section).toHaveTextContent("dispatchessaga")
  expect(within(section).getByRole("link", { name: "Open in the map" })).toHaveAttribute(
    "href",
    "/topology/map?focus=process%3AHospitalSurge&target=same-origin",
  )
})

test("the map shows the topology's own state when there is no document", async () => {
  mock.use(
    http.get("*/keiro/topology/summary", () =>
      HttpResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "no",
            details: { arguments: ["topology", "summary"] },
          },
        },
        { status: 400 },
      ),
    ),
  )
  await renderRoute("/topology/map")
  expect(await screen.findByTestId("topology-not-served")).toBeInTheDocument()
  expect(screen.queryByTestId("service-map")).not.toBeInTheDocument()
})
