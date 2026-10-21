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

const BIG_ID = "9007199254740994"

test("a message id above 2^53 renders exactly and opens the sheet with that id", async () => {
  const { queue } = pins("pgmq")
  const { router } = await renderRoute(`/queues/${queue}?from=2`)
  const table = await screen.findByRole("grid", { name: "Messages" })
  const cell = await within(table).findByText(BIG_ID)
  fireEvent.click(cell)
  await waitFor(() => expect(currentSearch(router).sheet).toBe(`queue-message:${queue}/${BIG_ID}`))
  const dialog = await screen.findByRole("dialog")
  expect(await within(dialog).findByTestId("message-id")).toHaveTextContent(BIG_ID)
})

test("Next page writes the page's next_cursor to `from` as a decimal string", async () => {
  const { queue } = pins("pgmq")
  const { router } = await renderRoute(`/queues/${queue}`)
  const table = await screen.findByRole("grid", { name: "Messages" })
  await within(table).findByText("1")
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await waitFor(() => expect(currentSearch(router).from).toBe("2"))
  expect(await within(table).findByText(BIG_ID)).toBeInTheDocument()
})

test("the archive tab is selected by the URL and lists archived rows", async () => {
  const { queue, archived_msg_id } = pins("pgmq")
  await renderRoute(`/queues/${queue}?tab=archive`)
  const table = await screen.findByRole("grid", { name: "Archived messages" })
  expect(await within(table).findByText(archived_msg_id!)).toBeInTheDocument()
})
