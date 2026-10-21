import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
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

const queue = (name: string, partitioned = false) => ({
  queue_name: name,
  is_partitioned: partitioned,
  is_unlogged: false,
  created_at: "2026-10-21T00:00:00Z",
})
const metrics = (name: string, oldest: number | null, visible: number, total: number) => ({
  queue_name: name,
  queue_length: total,
  queue_visible_length: visible,
  oldest_msg_age_sec: oldest,
  newest_msg_age_sec: oldest,
  total_messages: total,
  scrape_time: "2026-10-21T00:00:00Z",
  default_partition_length: null,
})

function serveInventory() {
  mock.use(
    http.get("*/pgmq/queues", () =>
      HttpResponse.json([queue("young"), queue("empty"), queue("events", true), queue("old")]),
    ),
    http.get("*/pgmq/metrics", () =>
      HttpResponse.json([
        metrics("young", 120, 5, 6),
        metrics("empty", null, 0, 0),
        metrics("events", 30, 1, 1),
        metrics("old", 900, 2, 9),
      ]),
    ),
  )
}

function rowNames(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("rowheader")[0]?.textContent ?? "")
}

test("queues are ordered by oldest age with empty queues last; counts carry their own labels", async () => {
  serveInventory()
  await renderRoute("/queues")
  const table = await screen.findByRole("grid", { name: "Queues" })
  await within(table).findByText("old")
  expect(rowNames(table)).toEqual(["old", "young", "events", "empty"])
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((h) => h.textContent)
  expect(headers).toEqual(expect.arrayContaining(["Visible", "Total", "Oldest"]))
  expect(within(table).queryByText(/^depth$/i)).toBeNull()
  // A partitioned queue without a planner estimate says "unknown", never zero.
  expect(within(table).getByText(/partition est\. unknown/)).toBeInTheDocument()
})

test("clicking the Visible header sorts by visible descending through the URL", async () => {
  serveInventory()
  const { router } = await renderRoute("/queues")
  const table = await screen.findByRole("grid", { name: "Queues" })
  await within(table).findByText("old")
  fireEvent.click(within(table).getByRole("columnheader", { name: /Visible/ }))
  await waitFor(() => expect(currentSearch(router)).toMatchObject({ sort: "visible", dir: "desc" }))
  await waitFor(() => expect(rowNames(table)).toEqual(["young", "old", "events", "empty"]))
})
