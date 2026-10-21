import { type MockServer, startMockServer, useScenario } from "@keiro-ui/testing/node"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { clearSessionAudit, useSessionAudit } from "@/features/actions/session-audit"
import { renderRoute } from "@/test/render-route"

import { CONTROL_DISABLED, ControlStatusView } from "./control-status"

let mock: MockServer
const posts: string[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    if (request.method === "POST") posts.push(new URL(request.url).pathname)
  })
})
afterEach(() => {
  mock.reset()
  posts.length = 0
  clearSessionAudit()
})
afterAll(() => mock.close())

function AuditCount() {
  return <span data-testid="audit-count">{useSessionAudit().length}</span>
}

test("the status view states the gate and the operations", () => {
  render(<ControlStatusView status={{ enabled: false, operations: ["pause", "resume"] }} />)
  expect(screen.getByText("Control enabled: no")).toBeInTheDocument()
  expect(screen.getByText("Operations: pause, resume")).toBeInTheDocument()
})

test("a disabled gate renders disabled buttons with the server's reason", async () => {
  await renderRoute("/processors/detailed")
  const card = await screen.findByRole("region", { name: "Control" })
  expect(await within(card).findByText("Control enabled: no")).toBeInTheDocument()
  expect(within(card).getByRole("button", { name: "Pause" })).toBeDisabled()
  expect(within(card).getByRole("button", { name: "Resume" })).toBeDisabled()
  expect(within(card).getByTestId("control-reason")).toHaveTextContent(CONTROL_DISABLED)
  const latency = screen.getByRole("region", { name: "Latency" })
  expect(
    within(latency).getByTestId("latency-histogram").querySelectorAll('[data-bar="bucket"]'),
  ).toHaveLength(18)
})

test("an enabled gate pauses after confirmation and records the action", async () => {
  useScenario({ mutations: { shibuyaControl: "enabled" } })
  render(<AuditCount />)
  await renderRoute("/processors/detailed")
  const card = await screen.findByRole("region", { name: "Control" })
  const pause = await within(card).findByRole("button", { name: "Pause" })
  await waitFor(() => expect(pause).toBeEnabled())
  expect(within(card).getByRole("button", { name: "Resume" })).toBeDisabled()
  fireEvent.click(pause)
  const confirm = await screen.findByRole("alertdialog")
  expect(confirm).toHaveTextContent("Intake stops at the adapter source")
  fireEvent.click(within(confirm).getByRole("button", { name: "Pause" }))
  await waitFor(() => expect(posts).toEqual(["/shibuya/control/processors/detailed/pause"]))
  await waitFor(() => expect(screen.getByTestId("audit-count")).toHaveTextContent("1"))
})

test("an origin refusal renders verbatim with the deployment pointer", async () => {
  useScenario({ mutations: { shibuyaControl: "origin_not_allowed" } })
  await renderRoute("/processors/detailed")
  const card = await screen.findByRole("region", { name: "Control" })
  const pause = await within(card).findByRole("button", { name: "Pause" })
  await waitFor(() => expect(pause).toBeEnabled())
  fireEvent.click(pause)
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Pause" }),
  )
  const refusal = await within(card).findByRole("alert")
  expect(refusal).toHaveTextContent("origin_not_allowed")
  expect(refusal).toHaveTextContent("Origin not allowed")
  expect(refusal).toHaveTextContent("corsAllowedOrigins (docs/deployment.md)")
})

test("a host without /control says so", async () => {
  mock.use(
    http.get("*/shibuya/control", () => HttpResponse.json({ error: "Not found" }, { status: 404 })),
  )
  await renderRoute("/processors/detailed")
  const card = await screen.findByRole("region", { name: "Control" })
  expect(await within(card).findByText(/has no control surface/)).toBeInTheDocument()
  expect(within(card).getByRole("button", { name: "Pause" })).toBeDisabled()
})
