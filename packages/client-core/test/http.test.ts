import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { ApiError } from "../src/errors"
import { createHttpClient, createLimiter, encodeQuery } from "../src/http"

const requests: Request[] = []
const server = setupServer(
  http.get("http://localhost:5173/pgmq/queues/orders/messages", ({ request }) => {
    requests.push(request.clone())
    return new HttpResponse(
      '{"items":[{"msg_id":9007199254740993,"read_ct":0}],"next_cursor":9007199254740993}',
      {
        headers: { "content-type": "application/json" },
      },
    )
  }),
  http.get("http://localhost:5173/pgmq/queues/missing", () =>
    HttpResponse.json(
      { error: { code: "queue_not_found", message: "Queue missing does not exist." } },
      { status: 404 },
    ),
  ),
  http.get("http://localhost:5173/keiro/health", () =>
    HttpResponse.json(
      { status: "schema_drift", schema_drift: ["x"], mutations_enabled: false },
      { status: 503 },
    ),
  ),
  http.post("http://localhost:5173/keiro/timer/requeue/t-1", async ({ request }) => {
    requests.push(request.clone())
    return HttpResponse.json({ outcome: "preview" })
  }),
  http.get("http://localhost:5173/keiro/empty", () => new HttpResponse(null, { status: 204 })),
)

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  requests.length = 0
  server.resetHandlers()
})
afterAll(() => server.close())

const pgmq = createHttpClient({ surface: "pgmq", baseUrl: "/pgmq" })
const keiro = createHttpClient({ surface: "keiro", baseUrl: "/keiro/" })

test("a 200 page resolves with a bigint id", async () => {
  const page = await pgmq.get<{ items: { msg_id: bigint }[]; next_cursor: bigint }>(
    "/queues/orders/messages",
    { query: { limit: 5 } },
  )
  expect(page.items[0]!.msg_id).toBe(9007199254740993n)
  expect(page.next_cursor).toBe(9007199254740993n)
  expect(requests[0]!.headers.get("accept")).toBe("application/json")
  expect(new URL(requests[0]!.url).search).toBe("?limit=5")
})

test("a 404 rejects with the normalized ApiError", async () => {
  const error = await pgmq.get("/queues/missing").catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(404)
  expect((error as ApiError).code).toBe("queue_not_found")
})

test("okStatuses returns a 503 readiness body instead of throwing", async () => {
  const body = await keiro.get<{ status: string }>("/health", { okStatuses: [200, 503] })
  expect(body.status).toBe("schema_drift")
  await expect(keiro.get("/health")).rejects.toMatchObject({ status: 503, code: "http_503" })
})

test("post without a body sends neither a body nor a content type", async () => {
  await keiro.post("/timer/requeue/t-1")
  expect(requests[0]!.headers.get("content-type")).toBeNull()
  expect(await requests[0]!.text()).toBe("")
})

test("post with a body sends that JSON", async () => {
  await keiro.post("/timer/requeue/t-1", { body: { confirm: "execute" } })
  expect(requests[0]!.headers.get("content-type")).toBe("application/json")
  expect(await requests[0]!.text()).toBe('{"confirm":"execute"}')
})

test("a 204 resolves to undefined", async () => {
  expect(await keiro.get("/empty")).toBeUndefined()
})

test("query encoding: caller order, arrays repeat, undefined omitted, bigint exact", () => {
  expect(
    encodeQuery({
      status_class: ["running", "retrying"],
      workflow_name: undefined,
      limit: 50,
      from: 9007199254740993n,
      live: true,
    }),
  ).toBe("?status_class=running&status_class=retrying&limit=50&from=9007199254740993&live=true")
  expect(keiro.url("wf/inspect/list", { after: "a b" })).toBe(
    "http://localhost:5173/keiro/wf/inspect/list?after=a+b",
  )
})

test("a network failure becomes network_error; an abort is rethrown", async () => {
  const failing = createHttpClient({
    surface: "kiroku",
    baseUrl: "http://127.0.0.1:1",
    fetch: () => Promise.reject(new TypeError("fetch failed")),
  })
  await expect(failing.get("/x")).rejects.toMatchObject({ status: 0, code: "network_error" })

  const aborting = createHttpClient({
    surface: "kiroku",
    baseUrl: "http://127.0.0.1:1",
    fetch: () => Promise.reject(new DOMException("aborted", "AbortError")),
  })
  await expect(aborting.get("/x")).rejects.toMatchObject({ name: "AbortError" })
})

describe("maxConcurrent", () => {
  test("keeps at most N requests in flight and serves the rest in order", async () => {
    let inFlight = 0
    let peak = 0
    const order: string[] = []
    const fetch = async (input: RequestInfo | URL) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      order.push(String(input).split("/").at(-1)!)
      return new Response("{}", { status: 200 })
    }
    const http = createHttpClient({
      surface: "keiro",
      baseUrl: "http://x",
      fetch,
      maxConcurrent: 2,
    })
    await Promise.all(["a", "b", "c", "d", "e"].map((p) => http.get(`/${p}`)))
    expect(peak).toBe(2)
    expect(order).toEqual(["a", "b", "c", "d", "e"])
  })

  test("a failing request releases its slot", async () => {
    const limit = createLimiter(1)
    await expect(limit(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom")
    expect(await limit(async () => "next")).toBe("next")
  })
})
