import { fixtureText } from "@keiro-ui/testing"
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
  const { store_position: head } = JSON.parse(
    fixtureText("kiroku/subscription-checkpoints.json"),
  ) as { store_position: number }
  expect(headline("store")).toHaveTextContent(String(head))
  await waitFor(() => expect(headline("aggregates")).toHaveTextContent("3"))
  await waitFor(() => expect(headline("timers")).toHaveTextContent("3"))
  expect(screen.getByTestId("card-timers-subtitle")).toHaveTextContent("1 stuck")
  expect(await screen.findByTestId("mutations")).toHaveTextContent("mutations: disabled on server")
  expect(document.body.textContent).not.toMatch(/\blag\b|backlog/i)
  fireEvent.click(screen.getByTestId("card-projections"))
  await waitFor(() => expect(router.state.location.pathname).toBe("/projections"))
})

test("workflow totals are exact, lossless and never read a sample list", async () => {
  const body = JSON.parse(fixtureText("keiro/workflow-counts.json"))
  body.counts.running = "9007199254740993"
  body.counts.completed = 1001
  mock.use(http.get("*/keiro/wf/inspect/counts", () => HttpResponse.json(body)))
  await renderRoute("/")
  await waitFor(() =>
    expect(headline("workflows").textContent?.replace(/\s/g, "")).toBe("9007199254740993"),
  )
  const subtitle = screen.getByTestId("card-workflows-subtitle")
  expect(subtitle).toHaveTextContent("completed 1 001")
  expect(screen.getByTestId("card-workflows")).not.toHaveTextContent(/newest|sample|\+/)
  expect(requests.some((url) => url.pathname.endsWith("/wf/inspect/list"))).toBe(false)
})

test("an unavailable counts route keeps the workflow link", async () => {
  mock.use(
    http.get("*/keiro/wf/inspect/counts", () =>
      HttpResponse.json(
        {
          error: {
            code: "invalid_request",
            message: "unknown command",
            details: { arguments: ["wf", "inspect", "counts"] },
          },
        },
        { status: 400 },
      ),
    ),
  )
  const { router } = await renderRoute("/")
  await waitFor(() =>
    expect(headline("workflows")).toHaveTextContent(
      "Exact workflow counts unavailable on this host",
    ),
  )
  fireEvent.click(screen.getByTestId("card-workflows"))
  await waitFor(() => expect(router.state.location.pathname).toBe("/workflows"))
})

test("a failed refresh retains counts with their original time and a stale error", async () => {
  const { queryClient } = await renderRoute("/")
  await waitFor(() => expect(headline("workflows")).toHaveTextContent("0"))
  const card = screen.getByTestId("card-workflows")
  const observed = card.querySelector("time")?.dateTime
  mock.use(
    http.get("*/keiro/wf/inspect/counts", () =>
      HttpResponse.json(
        { error: { code: "inspection_timeout", message: "budget expired" } },
        { status: 400 },
      ),
    ),
  )
  await queryClient.invalidateQueries({ queryKey: ["keiro", "workflows", "counts"] })
  await waitFor(() =>
    expect(card).toHaveTextContent("Stale counts: inspection_timeout: budget expired"),
  )
  expect(headline("workflows")).toHaveTextContent("0")
  expect(card.querySelector("time")?.dateTime).toBe(observed)
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
