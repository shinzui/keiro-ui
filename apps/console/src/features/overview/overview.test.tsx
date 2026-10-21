import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { renderRoute } from "@/test/render-route"

let mock: MockServer
const requests: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => requests.push(new URL(request.url)))
})
afterEach(() => {
  mock.reset()
  requests.length = 0
})
afterAll(() => mock.close())

const headline = (card: string) => screen.getByTestId(`card-${card}-headline`)

test("every card shows its fixture headline and links to its section", async () => {
  const { router } = await renderRoute("/")
  await waitFor(() => expect(headline("projections")).toHaveTextContent("26"))
  expect(headline("queues")).not.toHaveTextContent("…")
  expect(headline("processors")).toHaveTextContent("running")
  expect(headline("store")).toHaveTextContent("30")
  await waitFor(() => expect(headline("aggregates")).toHaveTextContent("2"))
  await waitFor(() => expect(headline("timers")).toHaveTextContent("3"))
  expect(screen.getByTestId("card-timers-subtitle")).toHaveTextContent("1 stuck")
  expect(await screen.findByTestId("mutations")).toHaveTextContent("mutations: disabled on server")
  expect(document.body.textContent).not.toMatch(/\blag\b|backlog/i)
  fireEvent.click(screen.getByTestId("card-projections"))
  await waitFor(() => expect(router.state.location.pathname).toBe("/projections"))
})

test("workflow counts are marked as a sample when more instances exist", async () => {
  mock.use(
    http.get("*/keiro/wf/inspect/list", () =>
      HttpResponse.json({
        items: [
          {
            workflow_name: "w",
            workflow_id: "1",
            status: "running",
            status_class: "running",
            attempts: 0,
            generation: 0,
            created_at: "2026-10-21T00:00:00Z",
            updated_at: "2026-10-21T00:00:00Z",
            completed_at: null,
            next_attempt_at: null,
            wake_after: null,
            lease_expires_at: null,
            leased_by: null,
            last_error: null,
          },
        ],
        next_cursor: "more",
        observed_at: "2026-10-21T00:00:00Z",
      }),
    ),
  )
  await renderRoute("/")
  await waitFor(() => expect(headline("workflows")).toHaveTextContent("1+"))
  expect(screen.getByTestId("card-workflows-subtitle")).toHaveTextContent(/^newest 500 instances: /)
})

test("a host without the hooks makes the aggregates card say so", async () => {
  mock.use(
    http.get("*/keiro/aggregate/types", () =>
      HttpResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "x",
            details: { arguments: ["aggregate", "types"] },
          },
        },
        { status: 400 },
      ),
    ),
  )
  await renderRoute("/")
  await waitFor(() => expect(headline("aggregates")).toHaveTextContent("not mounted on this host"))
})
