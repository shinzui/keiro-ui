import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("a message archived since it was listed falls back to the archive route", async () => {
  const { queue, archived_msg_id } = pins("pgmq")
  mock.use(
    http.get(`*/pgmq/queues/${queue}/messages/${archived_msg_id}`, () =>
      HttpResponse.json(
        { error: { code: "message_not_found", message: "message not found" } },
        { status: 404 },
      ),
    ),
  )
  await renderRoute(`/queues/${queue}?sheet=queue-message:${queue}/${archived_msg_id}`)
  const dialog = await screen.findByRole("dialog")
  expect(await within(dialog).findByText("archive")).toBeInTheDocument()
  expect(within(dialog).getByTestId("message-id")).toHaveTextContent(archived_msg_id!)
  expect(within(dialog).getByRole("link", { name: "Open full page" })).toHaveAttribute(
    "href",
    `/queues/${queue}/archive/${archived_msg_id}`,
  )
})

test("a dead-letter message opens with the Dead letter panel", async () => {
  const { dlq_queue, dlq_msg_id } = pins("pgmq")
  await renderRoute(`/queues/${dlq_queue}?sheet=queue-message:${dlq_queue}/${dlq_msg_id}`)
  const dialog = await screen.findByRole("dialog")
  const panel = await within(dialog).findByRole("region", { name: "Dead letter" })
  expect(panel).toHaveTextContent("poison_message")
})
