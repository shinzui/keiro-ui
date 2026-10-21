import type { ProcessorMetrics } from "@keiro-ui/client-shibuya"
import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { screen, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

import { oldestInFlightText } from "./processor-table"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("a failed terminal frame moves the processor under Terminal with its error", async () => {
  const { processor } = pins("shibuya")
  feedScript("shibuya", { append: 1, intervalMs: 10, terminal: "failed" })
  renderRoute("/processors")
  const terminal = await screen.findByRole("region", { name: "Terminal" }, { timeout: 3000 })
  expect(within(terminal).getByText(processor!)).toBeInTheDocument()
  expect(within(terminal).getByText("handler raised an exception")).toBeInTheDocument()
  const live = screen.getByRole("grid", { name: "Processors" })
  expect(within(live).queryByText(processor!)).toBeNull()
})

test("the oldest in-flight age is extrapolated from when the metrics arrived", () => {
  const metrics = {
    oldestInFlight: { messageId: "m-7", startedAt: "2026-09-20T00:00:40Z", ageSeconds: 3.5 },
  } as ProcessorMetrics
  const receivedAt = Date.parse("2026-10-21T12:00:00Z")
  const row = { id: "detailed", metrics, receivedAt }
  expect(oldestInFlightText(row, receivedAt)).toBe("3.5 s")
  expect(oldestInFlightText(row, receivedAt + 2000)).toBe("5.5 s")
  expect(oldestInFlightText({ ...row, metrics: {} as ProcessorMetrics }, receivedAt)).toBe("—")
})
