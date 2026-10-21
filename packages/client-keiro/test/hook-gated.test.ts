import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { createKeiroClient, isRouteUnavailable, RouteUnavailable } from "../src"
import { baseUrl, recordingFetch } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const keiro = createKeiroClient({ baseUrl })
const pin = pins("keiro")

test("aggregates validate against the derived fixtures, with query-flag routes", async () => {
  const types = await keiro.aggregates.types()
  expect(types.items.map((t) => t.name)).toContain(pin.aggregate_type)
  const list = await keiro.aggregates.list({ name: pin.aggregate_type! })
  expect(list.items.some((a) => a.aggregate_id === pin.aggregate_id)).toBe(true)
  const detail = await keiro.aggregates.show({ name: pin.aggregate_type!, id: pin.aggregate_id! })
  expect(detail.hydration?.source).toBe("full_replay")
  expect(typeof detail.stream_version).toBe("bigint")
  expect(
    (await keiro.aggregates.snapshot({ name: pin.aggregate_type!, id: pin.aggregate_id! })).status,
  ).toBe("absent")
  await expect(
    keiro.aggregates.show({ name: pin.aggregate_type!, id: "missing" }),
  ).rejects.toMatchObject({ status: 422 })
})

test("process managers, and null for an unknown correlation", async () => {
  const list = await keiro.processManagers.list({ name: pin.process_manager! })
  expect(list.items[0]!.correlation_id).toBe(pin.correlation_id)
  const detail = await keiro.processManagers.show({
    name: pin.process_manager!,
    correlation: pin.correlation_id!,
  })
  expect(detail?.journal_stream_name).toBeTypeOf("string")
  expect(detail?.pending_timers.items).toEqual([])
  expect(
    await keiro.processManagers.show({ name: pin.process_manager!, correlation: "missing" }),
  ).toBeNull()
})

test("a host without hooks answers 400 invalid_request, surfaced as RouteUnavailable", async () => {
  const body =
    '{"error":{"code":"invalid_request","details":{"arguments":["aggregate","types"]},"message":"Invalid argument `aggregate\'\\n\\nUsage: keiro-ops COMMAND"}}'
  const client = createKeiroClient({
    baseUrl: "http://keiro.test/keiro",
    fetch: recordingFetch(400, body).fetch,
  })
  const error = await client.aggregates.types().catch((e: unknown) => e)
  expect(error).toBeInstanceOf(RouteUnavailable)
  expect(isRouteUnavailable(error)).toBe(true)
  // The same 400 on a non-gated route stays an ordinary ApiError.
  const other = await client.timers.stuck().catch((e: unknown) => e)
  expect(isRouteUnavailable(other)).toBe(false)
})
