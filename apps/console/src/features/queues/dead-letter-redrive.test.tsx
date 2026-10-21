import { type MockServer, pins, startMockServer, useScenario } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

import { JOB_LEVEL_SENTENCE, logicalQueueOf } from "./dead-letter-redrive"

let mock: MockServer
const redrives: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith("/pgmq/dlq/redrive")) redrives.push(url)
  })
})
afterEach(() => {
  mock.reset()
  redrives.length = 0
})
afterAll(() => mock.close())

const { dlq_queue, queue } = pins("pgmq")

test("the logical queue is the dead-letter name without the profile's suffix", () => {
  expect(logicalQueueOf("console_demo_dlq", "_dlq")).toBe("console_demo")
  expect(logicalQueueOf("console_demo", "_dlq")).toBeNull()
  expect(logicalQueueOf("_dlq", "_dlq")).toBeNull()
  expect(logicalQueueOf("orders_dlq_dlq", "_dlq")).toBeNull()
})

test("a dead-letter queue offers keiro's redrive with the logical name and the limit", async () => {
  useScenario({ mutations: { keiro: "enabled" } })
  await renderRoute(`/queues/${dlq_queue}`)
  const card = await screen.findByRole("region", { name: "Dead letters" })
  expect(card).toHaveTextContent(JOB_LEVEL_SENTENCE)
  expect(within(card).getByTestId("logical-queue")).toHaveTextContent(`Original queue: ${queue}`)
  fireEvent.change(within(card).getByRole("textbox", { name: "Redrive limit" }), {
    target: { value: "25" },
  })
  const redrive = within(card).getByRole("button", { name: "Redrive" })
  await waitFor(() => expect(redrive).toBeEnabled())
  fireEvent.click(redrive)
  const flow = await screen.findByTestId("mutation-flow")
  expect(await within(flow).findByTestId("preview-headline")).toHaveTextContent(
    "1 messages available, at most 1 would move",
  )
  expect(redrives[0]?.searchParams.get("queue")).toBe(queue)
  expect(redrives[0]?.searchParams.get("limit")).toBe("25")
  fireEvent.change(within(flow).getByRole("textbox", { name: "Confirmation" }), {
    target: { value: dlq_queue },
  })
  fireEvent.click(screen.getByRole("button", { name: "Execute" }))
  expect(await within(flow).findByTestId("result-headline")).toHaveTextContent(
    `1 messages moved to ${queue}`,
  )
  expect(flow).toHaveTextContent("exit code 0")
})

test("other queues have no redrive card; a disabled gate disables the button", async () => {
  await renderRoute(`/queues/${queue}`)
  await screen.findByRole("grid", { name: "Messages" })
  expect(screen.queryByRole("region", { name: "Dead letters" })).toBeNull()
  mock.reset()
  await renderRoute(`/queues/${dlq_queue}`)
  const card = await screen.findByRole("region", { name: "Dead letters" })
  expect(within(card).getByRole("button", { name: "Redrive" })).toBeDisabled()
  expect(await within(card).findByTestId("gate-reason")).toHaveTextContent("Mutations are disabled")
})
