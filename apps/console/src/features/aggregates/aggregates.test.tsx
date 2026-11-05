import { fixtureText } from "@keiro-ui/testing"
import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
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
    "/aggregates/order?target=same-origin",
    "/categories/order?target=same-origin",
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

const { register_aggregate_id: registerId, register_stream: registerStream } = pins("keiro")
const registerPath = `/aggregates/credit-limit/${registerId}`
const snapshotReads = () => requests.filter((u) => u.pathname.endsWith("/snapshot/show"))
const readStored = async () => {
  const card = await screen.findByRole("region", { name: "Stored snapshot" })
  fireEvent.click(within(card).getByRole("button", { name: "Read stored snapshot" }))
  return card
}
/** The recorded bodies with the current balance replaced, byte for byte elsewhere. */
function currentBalance(balance: string) {
  const body = fixtureText("keiro/aggregate-show-credit-limit.json").replace(
    '"balance":25',
    `"balance":${balance}`,
  )
  mock.use(
    http.get(
      "*/keiro/aggregate/show",
      () => new HttpResponse(body, { headers: { "content-type": "application/json" } }),
    ),
  )
}

test("registers show as a table beside the JSON, and nothing stored is read unasked", async () => {
  await renderRoute(registerPath)
  const registers = await screen.findByRole("region", { name: "Registers" })
  expect(registers).toHaveTextContent("Registers reported by this application")
  expect(within(registers).getByTestId("register-balance")).toHaveTextContent("25")
  expect(within(registers).getByTestId("register-active")).toHaveTextContent("false")
  expect(screen.getByRole("region", { name: "Folded state" })).toHaveTextContent("credit_reviewed")
  const card = screen.getByRole("region", { name: "Stored snapshot" })
  expect(card).toHaveTextContent("can include fields this application's display omits")
  expect(snapshotReads()).toEqual([])
})

test("a state with empty registers shows no table", async () => {
  const { aggregate_id } = pins("keiro")
  await renderRoute(`/aggregates/order/${aggregate_id}`)
  await screen.findByRole("region", { name: "Folded state" })
  expect(screen.queryByRole("region", { name: "Registers" })).toBeNull()
})

test("a press reads once, and shows contents and a comparison with nothing marked changed", async () => {
  await renderRoute(registerPath)
  const card = await readStored()
  await within(card).findByTestId("stored-snapshot")
  expect(snapshotReads()).toHaveLength(1)
  expect(snapshotReads()[0]!.searchParams.get("stream")).toBe(registerStream)
  expect(within(card).getByTestId("comparison-versions")).toHaveTextContent(
    "current at state version 1, stored at stream version 1",
  )
  expect(within(card).getByTestId("difference-balance")).toHaveTextContent(/^$/)
  expect(within(card).getByTestId("difference-active")).toHaveTextContent(/^$/)
  expect(card).toHaveTextContent("advisory cache")
  fireEvent.click(within(card).getByRole("button", { name: "Read again" }))
  await waitFor(() => expect(snapshotReads()).toHaveLength(2))
})

test("a difference is marked in words, is not an error, and a name on one side shows a dash", async () => {
  currentBalance('30,"limit":100')
  await renderRoute(registerPath)
  const card = await readStored()
  await within(card).findByTestId("stored-snapshot")
  expect(within(card).getByTestId("difference-balance")).toHaveTextContent("changed")
  expect(within(card).getByTestId("difference-active")).toHaveTextContent(/^$/)
  expect(within(card).getByTestId("difference-limit")).toHaveTextContent("changed")
  const limit = within(card).getByRole("row", { name: /limit/ })
  expect(limit).toHaveTextContent("100")
  expect(limit).toHaveTextContent("—")
  expect(within(card).queryByRole("alert")).toBeNull()
})

test("a register above 2^53 keeps every digit in the table and the comparison", async () => {
  currentBalance("9007199254740993")
  await renderRoute(registerPath)
  const registers = await screen.findByRole("region", { name: "Registers" })
  expect(within(registers).getByTestId("register-balance")).toHaveTextContent("9007199254740993")
  const card = await readStored()
  const row = await within(card).findByRole("row", { name: /balance/ })
  expect(row).toHaveTextContent("9007199254740993")
  expect(within(card).getByTestId("difference-balance")).toHaveTextContent("changed")
})

test("no stored row says so", async () => {
  mock.use(http.get("*/keiro/snapshot/show", () => HttpResponse.json(null)))
  await renderRoute(registerPath)
  const card = await readStored()
  expect(await within(card).findByTestId("stored-snapshot-none")).toHaveTextContent(
    "No stored snapshot for this stream.",
  )
})

test("a stored state with no registers shows its JSON and no comparison", async () => {
  const body = JSON.parse(fixtureText("keiro/snapshot-show-credit-limit.json")) as {
    state: unknown
  }
  body.state = { custom_codec: true }
  mock.use(http.get("*/keiro/snapshot/show", () => HttpResponse.json(body)))
  await renderRoute(registerPath)
  const card = await readStored()
  await within(card).findByTestId("stored-snapshot")
  expect(card).toHaveTextContent("custom_codec")
  expect(within(card).queryByRole("region", { name: "Register comparison" })).toBeNull()
})

test("a failed read shows the server's message and code", async () => {
  mock.use(
    http.get("*/keiro/snapshot/show", () =>
      HttpResponse.json(
        { error: { code: "command_failed", message: "stored row unreadable" } },
        { status: 422 },
      ),
    ),
  )
  await renderRoute(registerPath)
  const card = await readStored()
  const error = await within(card).findByTestId("stored-snapshot-error")
  expect(error).toHaveTextContent("stored row unreadable")
  expect(error).toHaveTextContent("command_failed")
})
