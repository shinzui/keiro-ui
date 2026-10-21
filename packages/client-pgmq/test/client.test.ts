import { ApiError } from "@keiro-ui/client-core"
import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { createPgmqClient } from "../src"
import { baseUrl } from "./support"

let mock: MockServer
const requested: string[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    requested.push(new URL(request.url).pathname)
  })
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const pgmq = createPgmqClient({ baseUrl })
const queue = pins("pgmq").queue!

test("service, queues, and metrics decode", async () => {
  expect((await pgmq.service()).service).toBe("pgmq-inspect")
  expect((await pgmq.queues.list()).map((q) => q.queue_name)).toContain(queue)
  expect((await pgmq.queues.get(queue)).queue_name).toBe(queue)
  const metrics = await pgmq.queues.metrics(queue)
  expect(metrics.total_messages).toBe(9007199254740994n)
  expect(typeof metrics.queue_length).toBe("bigint")
  expect((await pgmq.metrics.all()).length).toBeGreaterThan(0)
})

test("a message id above 2^53 decodes exactly and is requested with exact digits", async () => {
  const message = await pgmq.messages.get(queue, 9007199254740994n)
  expect(message.msg_id).toBe(9007199254740994n)
  expect(requested).toContain(`/pgmq/queues/${queue}/messages/9007199254740994`)
})

test("message and archive pages carry bigint cursors", async () => {
  const first = await pgmq.messages.page(queue, { limit: 2 })
  expect(first.items).toHaveLength(2)
  expect(typeof first.nextCursor).toBe("bigint")
  const second = await pgmq.messages.page(queue, { limit: 2, from: first.nextCursor })
  expect(second.items.length).toBeGreaterThan(0)
  const archive = await pgmq.archive.page(queue, { limit: 50 })
  expect(archive.nextCursor).toBeUndefined()
  const archived = await pgmq.archive.get(queue, archive.items[0]!.msg_id)
  expect(archived.archived_at).toBeTypeOf("string")
})

test("bindings, routing, throttles, and health", async () => {
  expect((await pgmq.bindings.forQueue(queue))[0]!.pattern).toBe("console.*")
  expect((await pgmq.bindings.all()).length).toBeGreaterThan(0)
  expect((await pgmq.routing.test("console.demo"))[0]!.queue_name).toBe(queue)
  expect((await pgmq.notify.throttles())[0]!.throttle_interval_ms).toBe(250)
  expect((await pgmq.health.live()).body.alive).toBe(true)
  expect((await pgmq.health.ready()).body.ready).toBe(true)
})

test("errors keep the nested envelope", async () => {
  const missing = (await pgmq.queues.get("nope").catch((e: unknown) => e)) as ApiError
  expect(missing).toBeInstanceOf(ApiError)
  expect(missing.code).toBe("queue_not_found")
  const badLimit = (await pgmq.http
    .get(`/queues/${queue}/messages`, { query: { limit: 0 } })
    .catch((e: unknown) => e)) as ApiError
  expect(badLimit.code).toBe("invalid_limit")
})

test("limits outside 1–500 throw before any request", () => {
  expect(() => pgmq.messages.page(queue, { limit: 501 })).toThrow(RangeError)
})
