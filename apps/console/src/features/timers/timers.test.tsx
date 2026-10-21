import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

import { durationError } from "./search"
import { dueText } from "./TimersTable"

let mock: MockServer
const pendingRequests: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith("/timer/pending/list")) pendingRequests.push(url)
  })
})
afterEach(() => {
  mock.reset()
  pendingRequests.length = 0
})
afterAll(() => mock.close())

const { timer_id, process_manager, correlation_id } = pins("keiro")
const rowOf = (table: HTMLElement, idPrefix: string) =>
  within(table)
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(idPrefix))

test("due text and keiro's duration syntax", () => {
  const now = Date.parse("2026-10-21T12:00:00Z")
  expect(dueText("2026-10-21T12:02:00Z", now)).toBe("due in 2 min 0 s")
  expect(dueText("2026-10-21T11:59:20Z", now)).toBe("overdue by 40 s")
  expect(durationError("5m")).toBeNull()
  expect(durationError("1.5h")).toBeNull()
  expect(durationError("five")).toMatch(/^invalid duration "five": expected a finite/)
})

test("filters reach the URL and the request", async () => {
  const { router } = await renderRoute("/timers")
  await screen.findByRole("grid", { name: "Pending timers" })
  fireEvent.change(screen.getByRole("textbox", { name: "Manager" }), {
    target: { value: process_manager },
  })
  fireEvent.change(screen.getByRole("textbox", { name: "Correlation" }), {
    target: { value: correlation_id },
  })
  fireEvent.submit(screen.getByRole("form", { name: "Timer filters" }))
  await waitFor(() =>
    expect(currentSearch(router)).toMatchObject({
      manager: process_manager,
      correlation: correlation_id,
    }),
  )
  await waitFor(() =>
    expect(pendingRequests.at(-1)?.searchParams.get("correlation")).toBe(correlation_id),
  )
})

test("a feed update changes one row and removes another without a reload", async () => {
  feedScript("keiro", {
    append: 1,
    intervalMs: 30,
    changedFields: { attempts: 9 },
    removeLast: true,
  })
  await renderRoute("/timers")
  const table = await screen.findByRole("grid", { name: "Pending timers" })
  await waitFor(() => expect(rowOf(table, timer_id!.slice(0, 8))).toHaveTextContent("9"))
  // The snapshot's last timer left the first page.
  await waitFor(() => expect(table).not.toHaveTextContent("c4e85f17"))
  expect(screen.getByTestId("timers-caption")).toHaveTextContent(/as of .* · live/)
})

test("a queue_overflow re-reads the first page", async () => {
  feedScript("keiro", { append: 1, intervalMs: 30, overflowAfter: 1 })
  await renderRoute("/timers")
  await screen.findByRole("grid", { name: "Pending timers" })
  await waitFor(() => expect(pendingRequests.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
})

test("the stuck tab validates the minimum age and lists stuck timers without an as-of", async () => {
  await renderRoute("/timers?tab=stuck")
  const table = await screen.findByRole("grid", { name: "Stuck timers" })
  expect(await within(table).findByText(timer_id!.slice(0, 8))).toBeInTheDocument()
  expect(screen.queryByTestId("timers-caption")).toBeNull()
  fireEvent.change(screen.getByRole("textbox", { name: "Minimum age" }), {
    target: { value: "five" },
  })
  fireEvent.submit(screen.getByRole("form", { name: "Stuck filters" }))
  expect(await screen.findByRole("alert")).toHaveTextContent('invalid duration "five"')
})

test("a timer id opens the sheet with its payload and no action button", async () => {
  const { router } = await renderRoute("/timers")
  const table = await screen.findByRole("grid", { name: "Pending timers" })
  fireEvent.click(await within(table).findByRole("button", { name: timer_id!.slice(0, 8) }))
  await waitFor(() => expect(currentSearch(router).sheet).toBe(`timer:${timer_id}`))
  const sheet = await screen.findByRole("dialog")
  expect(await within(sheet).findByText("Payload")).toBeInTheDocument()
  expect(within(sheet).queryByRole("button", { name: /requeue|cancel|dead/i })).toBeNull()
})
