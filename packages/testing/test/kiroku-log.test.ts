import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { type MockServer, kirokuLog, pins, startMockServer } from "../src/node"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

interface Event {
  eventId: string
  globalPosition: number
  original_stream_name: string
}

test("an append raises the head and the event is returned by the poll routes", async () => {
  const before = kirokuLog.head()
  expect(before).toBeGreaterThan(0n)
  const category = pins("kiroku").category!
  const text = kirokuLog.append({ category })
  expect(kirokuLog.head()).toBe(before + 1n)
  const appended = JSON.parse(text) as Event

  const all = (await (
    await fetch(`http://localhost/kiroku/events?from=${before}&limit=100`)
  ).json()) as { items: Event[] }
  expect(all.items.map((e) => e.eventId)).toEqual([appended.eventId])

  const byCategory = (await (
    await fetch(`http://localhost/kiroku/categories/${category}/events?from=${before}&limit=100`)
  ).json()) as { items: Event[] }
  expect(byCategory.items.map((e) => e.eventId)).toEqual([appended.eventId])

  const single = (await (
    await fetch(`http://localhost/kiroku/events/${appended.eventId}`)
  ).json()) as Event
  expect(single.globalPosition).toBe(Number(before + 1n))

  const checkpoints = (await (
    await fetch("http://localhost/kiroku/subscription-checkpoints")
  ).json()) as { store_position: number }
  expect(checkpoints.store_position).toBe(Number(before + 1n))
})

test("reset restores the recorded bytes", async () => {
  kirokuLog.append()
  mock.reset()
  expect(kirokuLog.grown()).toBe(false)
  const { fixtureText } = await import("../src/fixtures")
  const body = await (await fetch("http://localhost/kiroku/events?from=0&limit=10")).text()
  expect(body).toBe(fixtureText("kiroku/events-forward.json"))
})
