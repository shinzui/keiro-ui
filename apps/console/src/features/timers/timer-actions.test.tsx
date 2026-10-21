import { type MockServer, pins, startMockServer, useScenario } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { MUTATIONS_DISABLED_REASON } from "@/features/actions/gate"
import { clearSessionAudit } from "@/features/actions/session-audit"
import { renderRoute } from "@/test/render-route"

let mock: MockServer
const requests: { method: string; path: string; body: string }[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", async ({ request }) => {
    const url = new URL(request.url)
    requests.push({
      method: request.method,
      path: url.pathname,
      body: await request.clone().text(),
    })
  })
})
afterEach(() => {
  mock.reset()
  requests.length = 0
  clearSessionAudit()
})
afterAll(() => mock.close())

const { timer_id } = pins("keiro")
const timerPosts = () =>
  requests.filter((r) => r.method === "POST" && r.path.includes("/keiro/timer/"))
const pendingReads = () => requests.filter((r) => r.path.endsWith("/timer/pending/list")).length

async function openRequeue() {
  const sheet = await screen.findByRole("dialog")
  const requeue = within(sheet).getByRole("button", { name: "Requeue" })
  await waitFor(() => expect(requeue).toBeEnabled())
  fireEvent.click(requeue)
  return screen.findByTestId("mutation-flow")
}

test("with mutations disabled every timer action is disabled with keiro's reason", async () => {
  await renderRoute(`/timers?sheet=timer:${timer_id}`)
  const sheet = await screen.findByRole("dialog")
  await waitFor(() =>
    expect(within(sheet).getByTestId("gate-reason")).toHaveTextContent(MUTATIONS_DISABLED_REASON),
  )
  expect(within(sheet).getByRole("button", { name: "Requeue" })).toBeDisabled()
  expect(within(sheet).getByRole("button", { name: "Cancel timer" })).toBeDisabled()
  expect(screen.getAllByTestId("gate-reason")).toHaveLength(2)
  // The sheet hides the page behind it from assistive technology; the rows are still rendered.
  const rowMenus = await screen.findAllByRole("button", {
    name: /Actions for timer .* \(Mutations are disabled/,
    hidden: true,
  })
  expect(rowMenus).toHaveLength(3)
  for (const menu of rowMenus) expect(menu).toBeDisabled()
})

test("preview, typed confirmation, and execution, then a re-read and an audit entry", async () => {
  useScenario({ mutations: { keiro: "enabled" } })
  await renderRoute(`/timers?sheet=timer:${timer_id}`)
  const flow = await openRequeue()
  expect(await within(flow).findByTestId("preview-headline")).toHaveTextContent("would requeue")
  expect(flow).toHaveTextContent("equivalent CLI command")
  expect(timerPosts()[0]).toMatchObject({ path: `/keiro/timer/requeue/${timer_id}`, body: "" })
  const execute = screen.getByRole("button", { name: "Execute" })
  expect(execute).toBeDisabled()
  const input = within(flow).getByRole("textbox", { name: "Confirmation" })
  fireEvent.change(input, { target: { value: timer_id!.slice(0, 8) } })
  expect(execute).toBeDisabled()
  fireEvent.change(input, { target: { value: timer_id } })
  expect(execute).toBeEnabled()
  const before = pendingReads()
  fireEvent.click(execute)
  expect(await within(flow).findByTestId("result-headline")).toHaveTextContent("transitioned")
  expect(timerPosts()[1]).toMatchObject({ body: '{"confirm":"execute"}' })
  await waitFor(() => expect(pendingReads()).toBeGreaterThan(before))
  // The dialogs hide the bottom bar from assistive technology; it still shows the count.
  expect(
    await screen.findByRole("button", { name: "1 action this session", hidden: true }),
  ).toBeInTheDocument()
})

test("a no-change preview never offers Execute", async () => {
  useScenario({ mutations: { keiro: "enabled", timerDisposition: "not_firing" } })
  await renderRoute(`/timers?sheet=timer:${timer_id}`)
  const flow = await openRequeue()
  expect(await within(flow).findByTestId("preview-headline")).toHaveTextContent("not firing")
  expect(within(flow).getByTestId("no-change")).toHaveTextContent("nothing would change")
  expect(screen.queryByRole("button", { name: "Execute" })).toBeNull()
  expect(within(flow).queryByRole("textbox", { name: "Confirmation" })).toBeNull()
})

test("an unknown outcome re-reads and locks Execute until the dialog reopens", async () => {
  useScenario({ mutations: { keiro: "enabled", executeRefusal: "mutation_outcome_unknown" } })
  await renderRoute(`/timers?sheet=timer:${timer_id}`)
  const flow = await openRequeue()
  await within(flow).findByTestId("preview-headline")
  fireEvent.change(within(flow).getByRole("textbox", { name: "Confirmation" }), {
    target: { value: timer_id },
  })
  const before = pendingReads()
  fireEvent.click(screen.getByRole("button", { name: "Execute" }))
  const refusal = await within(flow).findByRole("alert")
  expect(refusal).toHaveTextContent("mutation_outcome_unknown")
  expect(refusal).toHaveTextContent("The outcome is unknown")
  expect(screen.getByRole("button", { name: "Execute" })).toBeDisabled()
  await waitFor(() => expect(pendingReads()).toBeGreaterThan(before))
})

test("a busy preview offers a retry", async () => {
  useScenario({ mutations: { keiro: "enabled", previewRefusal: "inspection_busy" } })
  await renderRoute(`/timers?sheet=timer:${timer_id}`)
  const flow = await openRequeue()
  expect(await within(flow).findByRole("alert")).toHaveTextContent("inspection_busy")
  useScenario({ mutations: { previewRefusal: undefined } })
  fireEvent.click(within(flow).getByRole("button", { name: "Retry preview" }))
  expect(await within(flow).findByTestId("preview-headline")).toHaveTextContent("would requeue")
})
