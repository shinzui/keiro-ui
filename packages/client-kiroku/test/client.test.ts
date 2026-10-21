import { ApiError } from "@keiro-ui/client-core"
import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { createKirokuClient } from "../src"
import { baseUrl } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const kiroku = createKirokuClient({ baseUrl })
const pin = pins("kiroku")

describe("reads", () => {
  test("capabilities and health", async () => {
    expect((await kiroku.capabilities()).package).toBe("kiroku-metrics")
    expect(await kiroku.health.live()).toEqual({ status: 200, body: { alive: true } })
    const ready = await kiroku.health.ready()
    expect(ready.body.ready).toBe(true)
    const combined = await kiroku.health.combined()
    expect(typeof combined.body.metrics.store.global_position).toBe("bigint")
  })

  test("metrics, live subscriptions, and checkpoints keep int64 fields as bigint", async () => {
    const metrics = await kiroku.metrics.all()
    expect(typeof metrics.store.global_position).toBe("bigint")
    const subscription = metrics.subscriptions[pin.subscription!]!
    expect(typeof subscription.lag).toBe("bigint")
    expect(typeof (await kiroku.metrics.subscription(pin.subscription!)).last_known_position).toBe(
      "bigint",
    )
    const live = await kiroku.subscriptions.live()
    expect(live.some((row) => row.subscription === pin.subscription)).toBe(true)
    const inventory = await kiroku.checkpoints.inventory()
    expect(typeof inventory.store_position).toBe("bigint")
    expect(typeof inventory.checkpoints[0]!.checkpoint_position).toBe("bigint")
  })

  test("streams page with a name cursor, then the last page", async () => {
    const first = await kiroku.streams.page({ limit: 10 })
    expect(first.items).toHaveLength(10)
    expect(typeof first.nextCursor).toBe("string")
    const second = await kiroku.streams.page({ limit: 10, from: first.nextCursor })
    expect(second.items.length).toBeGreaterThan(0)
    expect(second.nextCursor).toBeUndefined()
    const byCategory = await kiroku.streams.page({ category: pin.category, limit: 100 })
    expect(byCategory.items.every((s) => s.category === pin.category)).toBe(true)
    const stream = await kiroku.streams.get(pin.stream!)
    expect(typeof stream.version).toBe("bigint")
    expect(stream.truncate_before).toBe(0n)
  })

  test("event pages carry bigint position cursors", async () => {
    const first = await kiroku.events.all({ from: 0n, limit: 10 })
    expect(typeof first.items[0]!.globalPosition).toBe("bigint")
    expect(first.nextCursor).toBe(10n)
    const second = await kiroku.events.all({ from: first.nextCursor, limit: 10 })
    expect(second.items[0]!.globalPosition).toBe(11n)
    const backward = await kiroku.events.all({ from: 0n, limit: 10, direction: "backward" })
    expect(backward.items[0]!.globalPosition > backward.items[1]!.globalPosition).toBe(true)
    const streamEvents = await kiroku.streams.events(pin.stream!, { from: 0n, limit: 100 })
    expect(streamEvents.nextCursor).toBeUndefined()
    const categoryEvents = await kiroku.categories.events(pin.category!, { from: 0n, limit: 100 })
    expect(categoryEvents.items.length).toBeGreaterThan(0)
    const event = await kiroku.events.get(pin.event_with_causation!)
    expect(event.causationId).toBe(pin.event_cause)
  })

  test("categories and dead letters", async () => {
    const categories = await kiroku.categories.page({ limit: 100 })
    expect(categories.items.map((c) => c.name)).toContain(pin.category)
    const dead = await kiroku.deadLetters.page(pin.subscription!, { limit: 10 })
    expect(dead.items).toHaveLength(10)
    expect(typeof dead.items[0]!.global_position).toBe("bigint")
    const rest = await kiroku.deadLetters.page(pin.subscription!, {
      limit: 10,
      from: dead.nextCursor,
    })
    expect(rest.nextCursor).toBeUndefined()
  })

  test("limits outside 1–1000 throw before any request", () => {
    expect(() => kiroku.events.all({ limit: 0 })).toThrow(RangeError)
    expect(() => kiroku.streams.page({ limit: 1001 })).toThrow(RangeError)
  })
})

describe("errors", () => {
  test("a 400 keeps the nested envelope's code", async () => {
    const error = await kiroku.http
      .get("/events", { query: { limit: "abc" } })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe("invalid_query_parameter")
  })

  test("/metrics/<unknown> uses the legacy string envelope", async () => {
    const error = await kiroku.metrics.subscription("does-not-exist").catch((e: unknown) => e)
    expect((error as ApiError).code).toBe("legacy_error")
    expect((error as ApiError).details).toEqual({ subscription: "does-not-exist" })
  })

  test("a 405 is method_not_allowed", async () => {
    mock.use(
      http.get("*/kiroku/capabilities", () =>
        HttpResponse.json(
          { error: { code: "method_not_allowed", message: "Method not allowed." } },
          { status: 405, headers: { allow: "GET, HEAD" } },
        ),
      ),
    )
    const error = (await kiroku.capabilities().catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe("method_not_allowed")
    expect(error.headers.get("allow")).toBe("GET, HEAD")
  })

  test("an unknown stream is 404", async () => {
    await expect(kiroku.streams.get("no-such-stream")).rejects.toMatchObject({ status: 404 })
  })
})
