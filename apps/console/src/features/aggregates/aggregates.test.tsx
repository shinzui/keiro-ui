import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
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

const notMounted = (word: string, rest: string) =>
  HttpResponse.json(
    {
      error: {
        code: "invalid_request",
        message: `Invalid argument \`${word}'`,
        details: { arguments: [word, rest] },
      },
    },
    { status: 400 },
  )

test("kinds link to their instances and categories", async () => {
  await renderRoute("/aggregates")
  const table = await screen.findByRole("grid", { name: "Aggregate kinds" })
  const links = await within(table).findAllByRole("link", { name: "order" })
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/aggregates/order",
    "/categories/order",
  ])
})

test("a host without the hooks shows the not-mounted state, without retrying", async () => {
  mock.use(http.get("*/keiro/aggregate/types", () => notMounted("aggregate", "types")))
  await renderRoute("/aggregates")
  const state = await screen.findByTestId("not-mounted")
  expect(state).toHaveTextContent("Aggregate inspection is not mounted on this keiro host")
  expect(state).toHaveTextContent("/keiro/aggregate/types")
  expect(requests.filter((u) => u.pathname.endsWith("/aggregate/types"))).toHaveLength(1)
})

test("skipped streams are explained", async () => {
  const { aggregate_type } = pins("keiro")
  mock.use(
    http.get("*/keiro/aggregate/list", () =>
      HttpResponse.json({ name: "order", category: "order", items: [], skipped: 3 }),
    ),
  )
  await renderRoute(`/aggregates/${aggregate_type}`)
  expect(await screen.findByTestId("skipped")).toHaveTextContent(
    "3 streams in category order skipped: not instances of order",
  )
})

test("the browser reads the stream only after the aggregate names it", async () => {
  const { aggregate_type, aggregate_id } = pins("keiro")
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  mock.use(
    http.get("*/keiro/aggregate/show", async () => {
      await gate
      return undefined
    }),
  )
  await renderRoute(`/aggregates/${aggregate_type}/${aggregate_id}`)
  await waitFor(() =>
    expect(requests.some((u) => u.pathname.endsWith("/aggregate/show"))).toBe(true),
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(requests.some((u) => u.pathname.includes("/kiroku/streams/"))).toBe(false)
  release()
  const events = await screen.findByRole("grid", { name: "Aggregate events" })
  expect(await within(events).findByText("OrderPlaced")).toBeInTheDocument()
  expect(screen.getByText("full replay: snapshot_missed")).toBeInTheDocument()
})

test("a snapshot hydration and an incompatible stored snapshot", async () => {
  const { aggregate_type, aggregate_id } = pins("keiro")
  mock.use(
    http.get("*/keiro/aggregate/show", () =>
      HttpResponse.json({
        name: "order",
        category: "order",
        aggregate_id,
        stream_name: `order-${aggregate_id}`,
        stream_version: 3,
        state_version: 3,
        created_at: "2026-10-21T20:23:20.710548Z",
        deleted_at: null,
        truncate_before: 0,
        hydration: { source: "snapshot", snapshot_version: 2 },
        state_label: "packed",
        state: { state: "packed" },
        history: { owner: "kiroku", stream_name: `order-${aggregate_id}`, head_version: 3 },
        snapshot: {
          status: "present",
          observed_at: "2026-10-21T20:26:23.902417Z",
          configured: { policy: "every:2" },
          stored: {
            stream_version: 2,
            compatibility: "incompatible",
            events_since: 1,
            mismatched: ["state_shape_hash", "state_codec_version"],
          },
        },
      }),
    ),
  )
  await renderRoute(`/aggregates/${aggregate_type}/${aggregate_id}`)
  expect(await screen.findByText("snapshot @ v2")).toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent("state_shape_hash, state_codec_version")
})
