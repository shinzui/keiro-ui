import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { type MockServer, feedScript, kirokuLog, pins, startMockServer } from "../src/node"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

type Frame = Record<string, unknown> & { type: string }

/** Opens a socket and collects frames; `until` resolves once `count` frames arrived. */
function connect(url: string) {
  const socket = new WebSocket(url)
  const frames: Frame[] = []
  const raw: string[] = []
  const waiters: { count: number; resolve: () => void }[] = []
  socket.addEventListener("message", (event) => {
    raw.push(String(event.data))
    frames.push(JSON.parse(String(event.data)) as Frame)
    for (const w of waiters.filter((waiter) => frames.length >= waiter.count)) {
      waiters.splice(waiters.indexOf(w), 1)
      w.resolve()
    }
  })
  const opened = new Promise<void>((resolve) => socket.addEventListener("open", () => resolve()))
  return {
    socket,
    frames,
    raw,
    opened,
    send: (frame: object | string) =>
      socket.send(typeof frame === "string" ? frame : JSON.stringify(frame)),
    until: (count: number) =>
      frames.length >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.push({ count, resolve })),
  }
}

describe("kiroku /ws/events", () => {
  test("a subscribe without from_position replays nothing and starts at the head", async () => {
    feedScript("kiroku", { append: 2, intervalMs: 5 })
    const head = kirokuLog.head()
    const c = connect("ws://localhost/kiroku/ws/events")
    await c.opened
    c.send({ type: "subscribe_events" })
    await c.until(3)
    expect(c.frames[0]).toEqual({ type: "event_stream_started", from_position: Number(head) })
    expect(c.frames.slice(1).map((f) => f.type)).toEqual(["event", "event"])
    const pushed = c.frames
      .slice(1)
      .map((f) => (f.event as { globalPosition: number }).globalPosition)
    expect(pushed).toEqual([Number(head) + 1, Number(head) + 2])

    // Every pushed event is also returned by the poll route (ADR-3).
    const poll = (await (
      await fetch(`http://localhost/kiroku/events?from=${head}&limit=100`)
    ).json()) as { items: { globalPosition: number }[] }
    expect(poll.items.map((e) => e.globalPosition)).toEqual(pushed)
    c.socket.close()
  })

  test("from_position replays only later events, filtered by category", async () => {
    feedScript("kiroku", { append: 0, intervalMs: 5 })
    const category = pins("kiroku").category!
    const c = connect("ws://localhost/kiroku/ws/events")
    await c.opened
    c.send({ type: "subscribe_events", from_position: 0, category })
    await c.until(2)
    await new Promise((r) => setTimeout(r, 30))
    const events = c.frames.slice(1).map((f) => f.event as { original_stream_name: string })
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.original_stream_name.startsWith(`${category}-`))).toBe(true)
    c.socket.close()
  })

  test("an overflow drops events that a re-read from the last seen position recovers", async () => {
    feedScript("kiroku", { append: 3, overflowAfter: 1, dropped: 2, intervalMs: 5 })
    const c = connect("ws://localhost/kiroku/ws/events")
    await c.opened
    c.send({ type: "subscribe_events" })
    await c.until(5) // started, event, error, event, event
    const lastSeen = (c.frames[1]!.event as { globalPosition: number }).globalPosition
    expect(c.frames[2]).toMatchObject({ type: "error", code: "event_stream_overflowed" })
    const reread = (await (
      await fetch(`http://localhost/kiroku/events?from=${lastSeen}&limit=100`)
    ).json()) as { items: { globalPosition: number }[] }
    const survivors = c.frames
      .slice(3)
      .map((f) => (f.event as { globalPosition: number }).globalPosition)
    expect(reread.items.map((e) => e.globalPosition)).toEqual([
      lastSeen + 1,
      lastSeen + 2,
      ...survivors,
    ])
    c.socket.close()
  })

  test("ping answers pong", async () => {
    const c = connect("ws://localhost/kiroku/ws/events")
    await c.opened
    c.send({ type: "ping" })
    await c.until(1)
    expect(c.frames[0]).toEqual({ type: "pong" })
    c.socket.close()
  })
})

test("kiroku /ws/metrics sends a snapshot on connect and again after intervalMs", async () => {
  feedScript("kiroku", { intervalMs: 20 })
  const c = connect("ws://localhost/kiroku/ws/metrics")
  await c.until(2)
  expect(c.frames.map((f) => f.type)).toEqual(["snapshot", "snapshot"])
  c.send({ type: "unsubscribe_metrics" })
  c.socket.close()
})

test("pgmq /ws: snapshot, updates, and an overflow error with queue null", async () => {
  feedScript("pgmq", { append: 2, overflowAfter: 2, intervalMs: 5 })
  const c = connect("ws://localhost/pgmq/ws")
  await c.opened
  c.send({ type: "subscribe", queue: pins("pgmq").queue })
  await c.until(4)
  expect(c.frames.map((f) => f.type)).toEqual(["snapshot", "update", "update", "error"])
  expect(c.frames[0]).toMatchObject({ queue: "console_demo", push: true })
  expect(c.frames[3]).toMatchObject({ code: "overflow", queue: null })
  c.socket.close()
})

test("shibuya /ws: snapshot, updates, a replacement snapshot after queue_overflow, terminal", async () => {
  feedScript("shibuya", { append: 2, overflowAfter: 1, intervalMs: 5, terminal: "failed" })
  const c = connect("ws://localhost/shibuya/ws")
  await c.until(6)
  expect(c.frames.map((f) => f.type)).toEqual([
    "snapshot",
    "update",
    "error",
    "snapshot",
    "update",
    "terminal",
  ])
  expect(c.frames[5]).toMatchObject({ status: "failed", messageId: null })
  c.socket.close()
})

test.each(["workflows", "timers", "projection_groups"])("keiro /ws %s feed", async (feed) => {
  feedScript("keiro", { append: 1, overflowAfter: 1, intervalMs: 5 })
  const c = connect("ws://localhost/keiro/ws")
  await c.opened
  c.send({ type: "subscribe", feed })
  await c.until(3)
  expect(c.frames.map((f) => f.type)).toEqual(["snapshot", "update", "error"])
  expect(c.frames[0]).toMatchObject({ feed, sequence: 0, trigger: "subscribe" })
  expect(c.frames[1]).toMatchObject({ feed, sequence: 1, removed: [] })
  expect(c.frames[2]).toMatchObject({ code: "queue_overflow", feed })
  c.socket.close()
})
