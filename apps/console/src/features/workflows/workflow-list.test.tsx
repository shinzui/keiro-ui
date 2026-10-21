import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

let mock: MockServer
const listRequests: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith("/wf/inspect/list")) listRequests.push(url)
  })
})
afterEach(() => {
  mock.reset()
  listRequests.length = 0
})
afterAll(() => mock.close())

const rowFor = (table: HTMLElement, id: string) =>
  within(table)
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(id))

test("the feed reconciles page one: a changed badge, a removed row, and a re-read on overflow", async () => {
  const { workflow_id } = pins("keiro")
  const childId = `${workflow_id}-ship`
  feedScript("keiro", {
    append: 2,
    intervalMs: 30,
    changedFields: { status: "failed", status_class: "failed" },
    removeLast: true,
    overflowAfter: 2,
  })
  await renderRoute("/workflows")
  const table = await screen.findByRole("grid", { name: "Workflow instances" })
  // update #1 marks the child failed and removes the parent from page one.
  await waitFor(() =>
    expect(rowFor(table, childId)?.querySelector("[data-status-class]")?.textContent).toBe(
      "failed",
    ),
  )
  expect(await screen.findByText(/Moved off this page: order-fulfillment\//)).toBeInTheDocument()
  // update #2 is followed by queue_overflow: the list is re-read from the poll path (the
  // first request is the initial read; the poll interval is far longer than this test).
  await waitFor(() => expect(listRequests.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
})

test("filters come from the URL, reach the request, and a change drops the cursor", async () => {
  const { router } = await renderRoute(
    "/workflows?status_class=retrying&status_class=failed&workflow_name=order-fulfillment&created_since=2026-10-21T00:00:00Z&after=abc",
  )
  await screen.findByRole("grid", { name: "Workflow instances" })
  await waitFor(() => expect(listRequests.length).toBeGreaterThan(0))
  const sent = listRequests[0]!.searchParams
  expect(sent.getAll("status_class")).toEqual(["retrying", "failed"])
  expect(sent.get("workflow_name")).toBe("order-fulfillment")
  expect(sent.get("created_since")).toBe("2026-10-21T00:00:00Z")
  expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("order-fulfillment")
  expect(screen.getByRole("textbox", { name: "Created since" })).toHaveValue("2026-10-21T00:00:00Z")
  const retrying = screen.getByRole("button", { name: "retrying" })
  expect(retrying).toHaveAttribute("aria-pressed", "true")

  fireEvent.click(screen.getByRole("button", { name: "running" }))
  await waitFor(() =>
    expect(currentSearch(router).status_class).toEqual(["running", "retrying", "failed"]),
  )
  expect(currentSearch(router).after).toBeUndefined()
})

test("Next requests the server's cursor as `after`; Previous returns to page one", async () => {
  const { router } = await renderRoute("/workflows")
  const table = await screen.findByRole("grid", { name: "Workflow instances" })
  await within(table).findByText(pins("keiro").workflow_id!)
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await waitFor(() => expect(currentSearch(router).after).toEqual(expect.any(String)))
  await within(table).findByText(`${pins("keiro").workflow_id}-ship`)
  fireEvent.click(screen.getByRole("button", { name: "Previous" }))
  await waitFor(() => expect(currentSearch(router).after).toBeUndefined())
})
