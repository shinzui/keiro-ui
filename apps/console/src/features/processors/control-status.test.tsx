import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { render, screen, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

import { ControlStatusView } from "./control-status"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("disabled control renders as text with no button", () => {
  render(<ControlStatusView status={{ enabled: false, operations: ["pause", "resume"] }} />)
  expect(screen.getByText("Control enabled: no")).toBeInTheDocument()
  expect(screen.getByText("Operations: pause, resume")).toBeInTheDocument()
  expect(screen.queryByRole("button")).toBeNull()
})

test("the processor page's Control card reflects /control", async () => {
  renderRoute("/processors/detailed")
  const card = await screen.findByRole("region", { name: "Control" })
  expect(await within(card).findByText("Control enabled: no")).toBeInTheDocument()
  expect(within(card).queryByRole("button")).toBeNull()
  const latency = screen.getByRole("region", { name: "Latency" })
  expect(
    within(latency).getByTestId("latency-histogram").querySelectorAll('[data-bar="bucket"]'),
  ).toHaveLength(18)
  expect(within(latency).getByText("p50")).toBeInTheDocument()
})
