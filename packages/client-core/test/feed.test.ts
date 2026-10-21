import { afterEach, expect, test, vi } from "vitest"

import { type FeedHandle, type FeedStatus, type Frame, openFeed } from "../src/feed"
import { testDialect } from "./dialect"
import { scriptedServer } from "./scripted-server"

const cleanups: (() => unknown)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup()
})

function recorder() {
  const calls: [string, unknown][] = []
  const push = (name: string) => (value: unknown) => calls.push([name, value])
  return {
    calls,
    callbacks: {
      onSnapshot: push("snapshot"),
      onDelta: push("delta"),
      onExtra: push("extra"),
      onError: push("error"),
      onResync: push("resync"),
    },
  }
}

const until = (predicate: () => boolean) =>
  vi.waitFor(() => expect(predicate()).toBe(true), { timeout: 2000, interval: 5 })

test("snapshot then two deltas arrive in order with int64 values intact", async () => {
  const server = await scriptedServer((socket) => {
    socket.on("message", () => {
      socket.send(
        '{"type":"snapshot","queue":"orders","metrics":{"total_messages":9007199254740993},"push":true}',
      )
      socket.send(
        '{"type":"update","queue":"orders","metrics":{"total_messages":9007199254740994},"source":"poll"}',
      )
      socket.send(
        '{"type":"update","queue":"orders","metrics":{"total_messages":9007199254740995},"source":"notify"}',
      )
    })
  })
  cleanups.push(server.close)
  const { calls, callbacks } = recorder()
  const feed = openFeed({
    url: server.url,
    dialect: testDialect,
    subscriptions: [{ queue: "orders" }],
    ...callbacks,
  })
  cleanups.push(() => feed.close())
  await until(() => calls.length === 3)
  expect(server.received).toEqual(['{"type":"subscribe","queue":"orders"}'])
  expect(calls.map(([name]) => name)).toEqual(["snapshot", "delta", "delta"])
  expect(((calls[2]![1] as Frame).metrics as { total_messages: bigint }).total_messages).toBe(
    9007199254740995n,
  )
})

test("an overflow error resyncs; any other error goes to onError", async () => {
  const server = await scriptedServer((socket) => {
    socket.send('{"type":"error","code":"overflow","message":"dropped","queue":null}')
    socket.send('{"type":"error","code":"queue_not_found","message":"no","queue":"x"}')
  })
  cleanups.push(server.close)
  const { calls, callbacks } = recorder()
  const feed = openFeed({ url: server.url, dialect: testDialect, ...callbacks })
  cleanups.push(() => feed.close())
  await until(() => calls.length === 2)
  expect(calls[0]![0]).toBe("resync")
  expect((calls[0]![1] as { code: string }).code).toBe("overflow")
  expect(calls[1]![0]).toBe("error")
})

test("goodbye then close: reconnects, re-sends subscriptions, and resyncs", async () => {
  const server = await scriptedServer((socket, _received, index) => {
    if (index === 0) {
      socket.on("message", () => {
        socket.send('{"type":"goodbye"}')
        socket.close()
      })
    }
  })
  cleanups.push(server.close)
  const statuses: [FeedStatus, boolean | undefined][] = []
  const { calls, callbacks } = recorder()
  const feed: FeedHandle<{ queue: string }> = openFeed({
    url: server.url,
    dialect: testDialect,
    subscriptions: [{ queue: "orders" }],
    backoff: { initialMs: 20 },
    onStatus: (status, detail) => statuses.push([status, detail?.serverGoodbye]),
    ...callbacks,
  })
  cleanups.push(() => feed.close())
  await until(() => calls.some(([name]) => name === "resync"))
  expect(statuses).toContainEqual(["reconnecting", true])
  expect(server.connections()).toBe(2)
  expect(server.received).toEqual([
    '{"type":"subscribe","queue":"orders"}',
    '{"type":"subscribe","queue":"orders"}',
  ])
  expect(calls).toContainEqual(["resync", { code: "reconnected" }])
  expect(feed.status).toBe("open")
})

test("unknown frames, non-objects, and pong are ignored", async () => {
  const server = await scriptedServer((socket) => {
    socket.send('{"type":"brand_new_frame","x":1}')
    socket.send("not json")
    socket.send("[1,2]")
    socket.send('{"type":"pong"}')
    socket.send('{"type":"terminal","processor":"p","status":"stopped"}')
  })
  cleanups.push(server.close)
  const { calls, callbacks } = recorder()
  const feed = openFeed({ url: server.url, dialect: testDialect, ...callbacks })
  cleanups.push(() => feed.close())
  await until(() => calls.length === 1)
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(calls.map(([name]) => name)).toEqual(["extra"])
})

test("close() stops reconnecting", async () => {
  const server = await scriptedServer(() => {})
  cleanups.push(server.close)
  const statuses: FeedStatus[] = []
  const feed = openFeed({
    url: server.url,
    dialect: testDialect,
    onStatus: (s) => statuses.push(s),
    ...recorder().callbacks,
  })
  await until(() => feed.status === "open")
  feed.close()
  await until(() => feed.status === "closed")
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(server.connections()).toBe(1)
  expect(statuses.at(-1)).toBe("closed")
})
