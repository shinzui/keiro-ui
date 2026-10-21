import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const { process_manager, correlation_id } = pins("keiro")
const instancePath = `/process-managers/${process_manager}/${correlation_id}`

function withReaction(reaction: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  mock.use(
    http.get("*/keiro/pm/show", () =>
      HttpResponse.json({
        name: process_manager,
        correlation_id,
        journal_stream_name: `fulfillment-${correlation_id}`,
        observed_head_version: 2,
        stream_version: 2,
        state_version: 2,
        state_label: "Waiting",
        state: { state: "Waiting" },
        hydration: { source: "full_replay", reason: "no_state_codec" },
        last_reaction: {
          event_id: "6e8e9bb5-3c00-5f95-8b6c-a7f9dfbcbe92",
          event_type: "FulfillmentObserved",
          global_position: 21,
          stream_version: 2,
          recorded_at: "2026-10-21T20:23:20.726567Z",
          ...reaction,
        },
        pending_timers: { items: [], observed_at: "2026-10-21T20:26:23.918352Z" },
        waiting_for: [],
        observed_at: "2026-10-21T20:26:23.918352Z",
        ...extra,
      }),
    ),
  )
}

test("the instance renders state, waiting-for, last reaction, and the journal link", async () => {
  await renderRoute(instancePath)
  const waiting = await screen.findByRole("region", { name: "Waiting for" })
  expect(waiting).toHaveTextContent("ObserveFulfillmentEvent → FulfillmentIdle")
  const reaction = screen.getByRole("region", { name: "Last reaction" })
  expect(within(reaction).getByText("unavailable")).toBeInTheDocument()
  expect(reaction).toHaveTextContent("predates provenance recording")
  // keiro's reaction reports position 0 for a stream-read event: shown as not reported.
  expect(reaction).toHaveTextContent("not reported")
  expect(screen.getByRole("link", { name: `fulfillment-${correlation_id}` })).toHaveAttribute(
    "href",
    `/streams/fulfillment-${correlation_id}`,
  )
})

test("an unknown correlation renders the no-instance state", async () => {
  await renderRoute(`/process-managers/${process_manager}/missing`)
  expect(
    await screen.findByText(`No instance of ${process_manager} with correlation missing`),
  ).toBeInTheDocument()
})

test("available provenance lists dispatched commands and links its timers", async () => {
  withReaction({
    provenance_status: "available",
    provenance: {
      family: "fulfillment",
      truncated: false,
      source_event_id: "01a16021-f586-765a-a938-f5c753d2af5a",
      source_global_position: 1,
      source_stream_id: 2,
      source_stream_name: `order-${correlation_id}`,
      dispatched_commands: [
        {
          emit_index: 0,
          target_stream_name: `shipment-${correlation_id}`,
          event_id: "0b5f1a2c-0000-4000-8000-000000000001",
          witness: "event_present",
        },
      ],
      timer_ids: ["7b2f6a0e-5c1d-4e8a-9f3b-2d6c8a1e4f03"],
    },
  })
  await renderRoute(instancePath)
  const reaction = await screen.findByRole("region", { name: "Last reaction" })
  expect(await within(reaction).findByText("event_present")).toBeInTheDocument()
  const timer = within(reaction).getByRole("link", { name: "7b2f6a0e" })
  const href = new URL(timer.getAttribute("href")!, "http://x")
  expect(href.pathname).toBe("/timers")
  expect(href.searchParams.get("manager")).toBe(process_manager)
  expect(href.searchParams.get("correlation")).toBe(correlation_id)
  expect(href.searchParams.get("sheet")).toBe("timer:7b2f6a0e-5c1d-4e8a-9f3b-2d6c8a1e4f03")
  expect(screen.getByRole("region", { name: "Waiting for" })).toHaveTextContent(
    "not waiting on any input",
  )
})

test("truncated provenance says so", async () => {
  withReaction({
    provenance_status: "truncated",
    provenance: { family: "fulfillment", truncated: true, dispatched_commands: [], timer_ids: [] },
  })
  await renderRoute(instancePath)
  expect(await screen.findByText("provenance bounded; some entries omitted")).toBeInTheDocument()
})

test("the index never calls keiro and opens a typed name", async () => {
  const { router } = await renderRoute("/process-managers")
  const input = await screen.findByRole("textbox", { name: "Process manager name" })
  fireEvent.change(input, { target: { value: "shipping" } })
  fireEvent.submit(screen.getByRole("form", { name: "Open a process manager" }))
  await waitFor(() => expect(router.state.location.pathname).toBe("/process-managers/shipping"))
  expect(currentSearch(router)).toEqual({})
})
