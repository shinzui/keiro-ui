import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { probeHealth } from "./health"

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const keiro = (status: number, body: Record<string, unknown>) =>
  server.use(
    http.get("http://keiro.test/health", () => HttpResponse.json(body as never, { status })),
  )

test("keiro: ok is up; drift and busy are degraded; unavailable is down", async () => {
  keiro(200, { status: "ok", schema_drift: [], mutations_enabled: false })
  expect((await probeHealth("keiro", "http://keiro.test")).status).toBe("up")
  keiro(503, { status: "schema_drift", schema_drift: ["keiro_workflows"] })
  expect((await probeHealth("keiro", "http://keiro.test")).status).toBe("degraded")
  keiro(503, { error: { code: "inspection_busy", message: "all inspection slots are in use" } })
  expect((await probeHealth("keiro", "http://keiro.test")).status).toBe("degraded")
  keiro(503, { status: "unavailable", message: "database unreachable" })
  const down = await probeHealth("keiro", "http://keiro.test")
  expect(down).toMatchObject({ status: "down", httpStatus: 503 })
})

test("a network failure is down without a status", async () => {
  server.use(http.get("http://pgmq.test/health/live", () => HttpResponse.error()))
  const probe = await probeHealth("pgmq", "http://pgmq.test")
  expect(probe.status).toBe("down")
  expect(probe.httpStatus).toBeUndefined()
})
