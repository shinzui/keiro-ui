import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

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

test("the group page states the subscription limitation until one is given", async () => {
  const { subscription } = pins("keiro")
  await renderRoute("/projections/jitsurei-order-reporting")
  expect(await screen.findByTestId("subscription-limitation")).toHaveTextContent(
    "keiro does not expose which subscription feeds this group",
  )
  expect(requests.some((u) => u.pathname.endsWith("/projection/position"))).toBe(false)
  // kiroku's durable subscriptions are offered as choices; choosing one shows its checkpoints.
  const choices = await screen.findByRole("group", { name: "Known subscriptions" })
  fireEvent.click(within(choices).getByRole("button", { name: subscription! }))
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("21")
  mock.reset()
  await renderRoute(`/projections/jitsurei-order-reporting?subscription=${subscription}`)
  expect(await screen.findByTestId("max-distance")).toHaveTextContent("21")
  const members = screen.getByRole("grid", { name: "Members" })
  expect(within(members).getAllByRole("row")).toHaveLength(3)
})

test("shards list subscriptions and, with one selected, its bucket ownership", async () => {
  const { subscription } = pins("keiro")
  await renderRoute("/shards")
  await screen.findByRole("grid", { name: "Sharded subscriptions" })
  expect(screen.queryByRole("grid", { name: "Ownership" })).toBeNull()
  mock.reset()
  await renderRoute(`/shards?subscription=${subscription}`)
  const ownership = await screen.findByRole("grid", { name: "Ownership" })
  expect(await within(ownership).findByText("worker-b")).toBeInTheDocument()
  expect(screen.getByTestId("unowned")).toHaveTextContent("1 unowned")
})
