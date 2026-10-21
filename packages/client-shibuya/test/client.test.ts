import { ApiError } from "@keiro-ui/client-core"
import { type MockServer, pins, startMockServer, useScenario } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { createShibuyaClient, extrapolateAge } from "../src"
import { baseUrl } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const shibuya = createShibuyaClient({ baseUrl })

test("the detailed map decodes every state, and the union narrows on status", async () => {
  const map = await shibuya.metrics.all()
  expect(Object.keys(map)).toEqual(
    expect.arrayContaining([
      "idle",
      "processing",
      "paused",
      "failed",
      "stopped",
      "detailed",
      "progressing",
    ]),
  )
  const failed = map.failed!.state
  if (failed.status !== "failed") throw new Error("expected failed")
  expect(failed.error).toBe("boom")
  const detailed = map.detailed!
  expect(detailed.latency?.buckets.length).toBeGreaterThan(0)
  expect(detailed.oldestInFlight?.messageId).toBe("m-7")
  expect(typeof detailed.stats.received).toBe("bigint")
  expect(map.progressing!.progress?.latest).toEqual({ kind: "integer", value: "4210" })
})

test("a basic record has the three optionals absent", async () => {
  useScenario({ recorded: { shibuya: ["metrics"] } })
  const map = await shibuya.metrics.all()
  for (const record of Object.values(map)) {
    expect(record.latency).toBeUndefined()
    expect(record.oldestInFlight).toBeUndefined()
    expect(record.progress).toBeUndefined()
  }
})

test("one processor, health, and control status", async () => {
  expect(
    (await shibuya.metrics.processor(pins("shibuya").processor!)).oldestInFlight?.ageSeconds,
  ).toBe(12.5)
  expect((await shibuya.health.live()).body.alive).toBe(true)
  expect((await shibuya.health.ready()).body.processors.total).toBeGreaterThan(0)
  expect((await shibuya.health.combined()).body.status.ready).toBe(true)
  expect(await shibuya.control.status()).toEqual({
    enabled: false,
    operations: ["pause", "resume"],
  })
})

test("the flat error envelope normalizes", async () => {
  const error = (await shibuya.http
    .post("/control/processors/notifications/pause")
    .catch((e: unknown) => e)) as ApiError
  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(403)
  expect(error.code).toBe("control_disabled")
  expect(error.message).toBe("Control operations are disabled")
})

test("extrapolateAge adds the time since the frame arrived", () => {
  const age = extrapolateAge(
    { messageId: "m", startedAt: "", ageSeconds: 12.5 },
    new Date(1_000),
    new Date(4_000),
  )
  expect(age).toBe(15.5)
})
