import { isApiError } from "@keiro-ui/client-core"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, beforeAll, expect, test } from "vitest"

import { createShibuyaClient } from "../src"

const sent: { url: string; body: string; contentType: string | null }[] = []
let state: "running" | "paused" = "running"
const server = setupServer(
  http.post(
    "http://shibuya.test/shibuya/control/processors/:id/:op",
    async ({ request, params }) => {
      sent.push({
        url: new URL(request.url).pathname,
        body: await request.text(),
        contentType: request.headers.get("content-type"),
      })
      if (params.id === "gone")
        return HttpResponse.json(
          { error: "Processor has terminated", code: "processor_terminal", processor: "gone" },
          { status: 409 },
        )
      if (params.id === "locked")
        return HttpResponse.json(
          { error: "Control operations are disabled", code: "control_disabled" },
          { status: 403 },
        )
      state = params.op === "pause" ? "paused" : "running"
      return HttpResponse.json(
        state === "paused"
          ? { processor: params.id, state, pausedAt: "2026-10-21T12:00:00Z" }
          : { processor: params.id, state },
      )
    },
  ),
)
beforeAll(() => server.listen())
afterAll(() => server.close())

const client = createShibuyaClient({ baseUrl: "http://shibuya.test/shibuya" })

test("pause and resume post with no body and parse the intake state", async () => {
  expect(await client.control.pause("orders")).toEqual({
    processor: "orders",
    state: "paused",
    pausedAt: "2026-10-21T12:00:00Z",
  })
  expect(await client.control.resume("orders")).toEqual({ processor: "orders", state: "running" })
  expect(sent.map((s) => s.url)).toEqual([
    "/shibuya/control/processors/orders/pause",
    "/shibuya/control/processors/orders/resume",
  ])
  expect(sent.every((s) => s.body === "" && s.contentType === null)).toBe(true)
})

test("refusals keep shibuya's flat code and context", async () => {
  const terminal = await client.control.pause("gone").catch((e: unknown) => e)
  expect(isApiError(terminal, "processor_terminal") && terminal.status).toBe(409)
  expect(isApiError(terminal) && terminal.details).toMatchObject({ processor: "gone" })
  const disabled = await client.control.resume("locked").catch((e: unknown) => e)
  expect(isApiError(disabled, "control_disabled")).toBe(true)
})
