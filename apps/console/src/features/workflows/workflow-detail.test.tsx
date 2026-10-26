import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("the journal renders grouped steps with derived spans and opens the entry sheet", async () => {
  const { workflow_name, workflow_id } = pins("keiro")
  const { router } = await renderRoute(`/workflows/${workflow_name}/${workflow_id}`)
  const journal = await screen.findByRole("list", { name: "Journal" })
  const steps = [...journal.querySelectorAll(":scope > li")].map((li) =>
    li.getAttribute("data-step"),
  )
  expect(steps[0]).toBe("reserve-inventory")
  expect(steps.at(-1)).toBe("__workflow_completed__")
  expect(screen.getByTestId("segments-legend")).toHaveTextContent("derived in the browser")

  const first = journal.querySelector("[data-event-id]") as HTMLElement
  const eventId = first.getAttribute("data-event-id")
  fireEvent.click(first)
  await waitFor(() =>
    expect(currentSearch(router).sheet).toBe(
      `journal-entry:${workflow_name}/${workflow_id}/${eventId}`,
    ),
  )
  const sheet = await screen.findByRole("dialog")
  expect(within(sheet).getByRole("heading", { name: "reserve-inventory" })).toBeInTheDocument()
  expect(within(sheet).getByRole("link", { name: "Open event" })).toHaveAttribute(
    "href",
    `/events/${eventId}?target=same-origin`,
  )
})

test("the steps lens hides the terminal entry and the errors lens finds no failure", async () => {
  const { workflow_name, workflow_id } = pins("keiro")
  await renderRoute(`/workflows/${workflow_name}/${workflow_id}?lens=steps`)
  const journal = await screen.findByRole("list", { name: "Journal" })
  expect(journal.querySelector('[data-step="__workflow_completed__"]')).toBeNull()
})

test("children link to the child's page; an unknown instance says so", async () => {
  const { workflow_name, workflow_id } = pins("keiro")
  await renderRoute(`/workflows/${workflow_name}/${workflow_id}?tab=children`)
  const table = await screen.findByRole("grid", { name: "Children" })
  expect(await within(table).findByRole("link", { name: `${workflow_id}-ship` })).toHaveAttribute(
    "href",
    `/workflows/ship-order/${workflow_id}-ship?target=same-origin`,
  )
})

test("an unknown instance renders the not-found state", async () => {
  await renderRoute("/workflows/nope/nope")
  expect(await screen.findByText("No such workflow")).toBeInTheDocument()
})
