import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { createKeiroClient } from "../src"
import { baseUrl } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const keiro = createKeiroClient({ baseUrl })
const pin = pins("keiro")

test("timers: pending page and the bare stuck array", async () => {
  const pending = await keiro.timers.pending({ limit: 100 })
  expect(pending.observed_at).toBeTypeOf("string")
  expect(pending.items[0]?.due_in_seconds).toBeTypeOf("number")
  // Stuck rows carry no last_error or due_in_seconds key.
  const stuck = await keiro.timers.stuck()
  expect(stuck[0]?.timer_id).toBe(pin.timer_id)
  expect(stuck[0]).not.toHaveProperty("last_error")
})

test("projections keep keiro's position vocabulary as bigint", async () => {
  const status = await keiro.projections.status({ limit: 100 })
  expect(status.items.length).toBeGreaterThan(0)
  expect(status.items[0]!.lifecycle_phase).toBe("live")
  const position = await keiro.projections.position({ subscription: pin.subscription! })
  expect(typeof position.store_position).toBe("bigint")
  expect(typeof position.visible_store_head).toBe("bigint")
  expect(position.maximum_global_position_distance).toBe(21n)
  expect(position.members[0]!.global_position_distance).toBe(2n)
})

test("shards, streams, outbox, inbox", async () => {
  expect((await keiro.shards.list()).items[0]!.buckets_total).toBe(4)
  expect((await keiro.shards.status({ subscription: pin.subscription! })).subscription).toBe(
    pin.subscription,
  )
  const show = await keiro.streams.show(pin.stream!, { from: 0, limit: 100 })
  expect(typeof show.events[0]!.stream_version).toBe("bigint")
  const subs = await keiro.streams.subscriptions()
  expect(typeof subs.store_position).toBe("bigint")
  expect((await keiro.outbox.backlog()).metric).toBe("outbox_backlog")
  expect((await keiro.inbox.backlog()).metric).toBe("inbox_backlog")
})
