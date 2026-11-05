import { fixtureText } from "@keiro-ui/testing"
import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

let mock: MockServer
const requests: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => requests.push(new URL(request.url)))
})
afterEach(() => {
  mock.reset()
  requests.length = 0
})
afterAll(() => mock.close())

const statusRequests = () => requests.filter((u) => u.pathname.endsWith("/projection/status"))
const cell = (group: string) => screen.getByTestId(`distance-${group}`)

test("the distance column: n/a, caught up, and exact differences", async () => {
  await renderRoute("/projections")
  const table = await screen.findByRole("grid", { name: "Projection groups" })
  await within(table).findByText("jitsurei-order-search")
  expect(cell("$legacy-read-model:jitsurei-area-chapters")).toHaveTextContent("n/a")
  expect(cell("jitsurei-order-search")).toHaveTextContent("caught up")
  expect(cell("jitsurei-order-reporting")).toHaveTextContent("21")
  expect(cell("jitsurei-carrier-quotes")).toHaveTextContent("26")
  expect(
    within(table).getByRole("columnheader", { name: "Global position distance" }),
  ).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\blag\b|backlog/i)
})

test("feed updates change and remove rows without a re-read; an overflow re-reads once", async () => {
  feedScript("keiro", {
    append: 1,
    intervalMs: 30,
    changedFields: { lifecycle_phase: "rebuilding" },
    removeLast: true,
  })
  await renderRoute("/projections")
  const table = await screen.findByRole("grid", { name: "Projection groups" })
  const first = "$legacy-read-model:jitsurei-area-chapters"
  await waitFor(() =>
    expect(
      within(table).getByRole("row", { name: new RegExp(first.replace("$", "\\$")) }),
    ).toHaveTextContent("rebuilding"),
  )
  await waitFor(() => expect(within(table).queryByText("jitsurei-carrier-quotes")).toBeNull())
  expect(statusRequests()).toHaveLength(1)
})

test("a queue_overflow re-reads the first page once", async () => {
  feedScript("keiro", { append: 1, intervalMs: 30, overflowAfter: 1 })
  await renderRoute("/projections")
  await screen.findByRole("grid", { name: "Projection groups" })
  await waitFor(() => expect(statusRequests()).toHaveLength(2), { timeout: 3000 })
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(statusRequests()).toHaveLength(2)
})

/** The recorded status page with one group's field replaced, or removed when `undefined`. */
function statusWith(group: string, feeding: string[] | undefined) {
  const page = JSON.parse(fixtureText("keiro/projection-status.json")) as {
    items: Record<string, unknown>[]
  }
  for (const item of page.items) {
    if (item.group_id !== group) continue
    if (feeding === undefined) delete item.feeding_subscriptions
    else item.feeding_subscriptions = feeding
  }
  mock.use(http.get("*/keiro/projection/status", () => HttpResponse.json(page)))
}
/** Answers every position read; a distance per name proves which subscription was read. */
function positions(distances: Record<string, number>) {
  mock.use(
    http.get("*/keiro/projection/position", ({ request }) => {
      const subscription = new URL(request.url).searchParams.get("subscription")!
      return HttpResponse.json({
        subscription,
        store_position: 30,
        visible_store_head: 30,
        minimum_checkpoint_position: 0,
        maximum_global_position_distance: distances[subscription] ?? 0,
        members: [],
      })
    }),
  )
}
const positionRequests = () => requests.filter((u) => u.pathname.endsWith("/projection/position"))
const checkpointRequests = () =>
  requests.filter((u) => u.pathname.endsWith("/subscription-checkpoints"))

test("the group page reads the reported subscription with no input, and never asks kiroku", async () => {
  await renderRoute("/projections/jitsurei-order-reporting")
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("21")
  const members = screen.getByRole("grid", { name: "Members" })
  expect(within(members).getAllByRole("row")).toHaveLength(3)
  expect(screen.getByTestId("feeding-subscriptions")).toHaveTextContent(
    "Fed by jitsurei-order-reporting",
  )
  expect(screen.queryByRole("textbox", { name: "Feeding subscription name" })).toBeNull()
  expect(screen.queryByTestId("subscription-limitation")).toBeNull()
  expect(new Set(positionRequests().map((u) => u.search))).toEqual(
    new Set(["?subscription=jitsurei-order-reporting"]),
  )
  expect(checkpointRequests()).toEqual([])
})

test("two reported subscriptions offer exactly those two, and selecting one changes the read", async () => {
  positions({ "jitsurei-order-search": 3, "jitsurei-order-search-facets": 7 })
  const { router } = await renderRoute("/projections/jitsurei-order-search")
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("3")
  const choices = screen.getByRole("group", { name: "Feeding subscriptions" })
  expect(within(choices).getAllByRole("button")).toHaveLength(2)
  fireEvent.click(within(choices).getByRole("button", { name: "jitsurei-order-search-facets" }))
  await waitFor(() =>
    expect(currentSearch(router).subscription).toBe("jitsurei-order-search-facets"),
  )
  await waitFor(() => expect(screen.getByTestId("max-distance")).toHaveTextContent("7"))
})

test("an empty list says none is recorded and reads nothing: not the older host's chooser", async () => {
  await renderRoute(
    `/projections/${encodeURIComponent("$legacy-read-model:jitsurei-area-chapters")}`,
  )
  expect(await screen.findByTestId("no-feeding-subscription")).toHaveTextContent(
    "keiro records no feeding subscription for this group",
  )
  expect(screen.queryByTestId("subscription-limitation")).toBeNull()
  expect(screen.queryByRole("textbox", { name: "Feeding subscription name" })).toBeNull()
  expect(positionRequests()).toEqual([])
  expect(checkpointRequests()).toEqual([])
})

test("a host that omits the field keeps the chooser: not the empty list's sentence", async () => {
  const { subscription } = pins("keiro")
  statusWith("jitsurei-order-reporting", undefined)
  await renderRoute("/projections/jitsurei-order-reporting")
  expect(await screen.findByTestId("subscription-limitation")).toHaveTextContent(
    "This keiro host does not report which subscription feeds this group",
  )
  expect(screen.queryByTestId("no-feeding-subscription")).toBeNull()
  expect(positionRequests()).toEqual([])
  // kiroku's durable subscriptions are offered as choices; choosing one shows its checkpoints.
  const choices = await screen.findByRole("group", { name: "Known subscriptions" })
  fireEvent.click(within(choices).getByRole("button", { name: subscription! }))
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("21")
})

test("an old link naming another subscription opens with a note and reads a reported one", async () => {
  await renderRoute("/projections/jitsurei-order-reporting?subscription=somewhere-else")
  expect(await screen.findByTestId("subscription-not-feeding")).toHaveTextContent(
    "somewhere-else does not feed this group.",
  )
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("21")
  expect(positionRequests().some((u) => u.search.includes("somewhere-else"))).toBe(false)
})

test("the table names subscriptions, a dash for none, and not reported when absent", async () => {
  statusWith("jitsurei-carrier-quotes", undefined)
  await renderRoute("/projections")
  await screen.findByRole("grid", { name: "Projection groups" })
  const cellOf = (group: string) => screen.findByTestId(`subscriptions-${group}`)
  expect(await cellOf("jitsurei-order-search")).toHaveTextContent(
    "jitsurei-order-search, jitsurei-order-search-facets",
  )
  expect(await cellOf("$legacy-read-model:jitsurei-area-chapters")).toHaveTextContent(/^—$/)
  expect(await cellOf("jitsurei-carrier-quotes")).toHaveTextContent(/^not reported$/)
  expect(positionRequests()).toEqual([])
})

test("shards list subscriptions and, with one selected, its bucket ownership", async () => {
  const { subscription } = pins("keiro")
  await renderRoute("/shards")
  await screen.findByRole("grid", { name: "Sharded subscriptions" })
  expect(screen.queryByRole("grid", { name: "Ownership" })).toBeNull()
  mock.reset()
  cleanup()
  await renderRoute(`/shards?subscription=${subscription}`)
  const ownership = await screen.findByRole("grid", { name: "Ownership" })
  expect(await within(ownership).findByText("worker-b")).toBeInTheDocument()
  expect(screen.getByTestId("unowned")).toHaveTextContent("1 unowned")
})
