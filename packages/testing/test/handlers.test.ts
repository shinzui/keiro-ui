import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { fixtureMeta } from "../src/fixtures"
import { type MockServer, pins, startMockServer, useScenario } from "../src/node"

const root = join(import.meta.dirname, "../fixtures")
const prefixes = { kiroku: "/kiroku", pgmq: "/pgmq", shibuya: "/shibuya", keiro: "/keiro" }

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

function fixture(relative: string): string {
  return readFileSync(join(root, relative), "utf8")
}

describe("every recorded request is answered with its recorded bytes", () => {
  const entries = Object.entries(fixtureMeta.files).filter(([, m]) => m.variant !== "recorded")
  test.each(entries)("%s", async (relative, meta) => {
    const url = `http://localhost${prefixes[meta.surface]}${meta.request}`
    const response = await fetch(url, { method: meta.method })
    expect(response.status).toBe(meta.status)
    expect(await response.text()).toBe(fixture(relative))
  })
})

test("the smoke routes of the plan's acceptance", async () => {
  const streams = await fetch("http://localhost/kiroku/streams?limit=10")
  expect(await streams.text()).toBe(fixture("kiroku/streams.json"))
  const queues = await fetch("http://localhost/pgmq/queues")
  expect(await queues.text()).toBe(fixture("pgmq/queues.json"))
  const backward = await fetch("http://localhost/kiroku/events?from=0&limit=10&direction=backward")
  expect(await backward.text()).toBe(fixture("kiroku/events-backward.json"))
})

test("kiroku from=0 serves the first page; the recorded next_cursor serves page 2; others are empty", async () => {
  const first = await fetch("http://localhost/kiroku/events?from=0&limit=10")
  expect(await first.text()).toBe(fixture("kiroku/events-forward.json"))
  const absent = await fetch("http://localhost/kiroku/events?limit=10")
  expect(await absent.text()).toBe(fixture("kiroku/events-forward.json"))
  const second = await fetch("http://localhost/kiroku/events?from=10&limit=10")
  expect(await second.text()).toBe(fixture("kiroku/events-forward.page2.json"))
  const beyond = await fetch("http://localhost/kiroku/events?from=999&limit=10")
  expect(await beyond.json()).toEqual({ items: [] })
})

test("keiro cursors are echoed back untouched and the empty page keeps observed_at", async () => {
  const first = await fetch("http://localhost/keiro/wf/inspect/list?limit=1")
  const body = await first.text()
  const cursor = /"next_cursor":"([^"]+)"/.exec(body)![1]!
  const second = await fetch(`http://localhost/keiro/wf/inspect/list?limit=1&after=${cursor}`)
  expect(await second.text()).toBe(fixture("keiro/workflows.page2.json"))
  const other = await fetch("http://localhost/keiro/wf/inspect/list?limit=1&after=eyJ4IjoxfQ")
  const empty = (await other.json()) as { items: unknown[]; observed_at?: string }
  expect(empty.items).toEqual([])
  expect(empty.observed_at).toBeTypeOf("string")
})

test("an unknown entity answers with the route's recorded error", async () => {
  const response = await fetch("http://localhost/kiroku/streams/some-other-stream")
  expect(response.status).toBe(404)
  expect(await response.text()).toBe(fixture("kiroku/stream.error.json"))
})

test("useScenario({ fail }) swaps a route for its error fixture until reset", async () => {
  const path = `http://localhost/kiroku/streams/${encodeURIComponent(pins("kiroku").stream!)}`
  useScenario({ fail: { kiroku: ["stream"] } })
  expect((await fetch(path)).status).toBe(404)
  mock.reset()
  expect((await fetch(path)).status).toBe(200)
})

test("pins name the recorded entities", () => {
  expect(pins("kiroku").stream).toMatch(/^order-/)
  expect(pins("pgmq").queue).toBe("console_demo")
  expect(pins("keiro").workflow_name).toBeTruthy()
})
