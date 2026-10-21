import { ApiError } from "@keiro-ui/client-core"
import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import {
  createKeiroClient,
  CursorMismatch,
  isCursorMismatch,
  isInspectionBusy,
  isSchemaDrift,
  isTooLarge,
} from "../src"
import { baseUrl, recordingFetch } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

const keiro = createKeiroClient({ baseUrl })
const pin = pins("keiro")

describe("request lines follow the command tree", () => {
  test("list repeats status_class and keeps snake_case flags", async () => {
    const recorder = recordingFetch()
    const client = createKeiroClient({ baseUrl: "http://keiro.test/keiro", fetch: recorder.fetch })
    await client.workflows.list({ status_class: ["running", "retrying"], limit: 50 })
    await client.workflows.journal("order fulfillment", "id/1")
    expect(recorder.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      "GET /keiro/wf/inspect/list?status_class=running&status_class=retrying&limit=50",
      "GET /keiro/wf/inspect/journal/order%20fulfillment/id%2F1",
    ])
  })

  test("reserved flags and limits outside 1–500 are refused before sending", async () => {
    expect(() => keiro.workflows.list({ limit: 501 })).toThrow(RangeError)
    await expect(keiro.timers.stuck({ json: "true" } as never)).rejects.toThrow(/reserved/)
  })
})

describe("fixtures validate", () => {
  test("health", async () => {
    expect(await keiro.health.get()).toMatchObject({ status: "ok", mutations_enabled: false })
  })

  test("list pages with a branded cursor, then the last page", async () => {
    const first = await keiro.workflows.list({ limit: 1 })
    expect(first.items).toHaveLength(1)
    expect(typeof first.nextCursor).toBe("string")
    expect(first.observed_at).toBeTypeOf("string")
    const second = await keiro.workflows.list({ limit: 1, after: first.nextCursor })
    expect(second.nextCursor).toBeUndefined()
    expect(
      (await keiro.workflows.list({ status_class: ["running"], limit: 100 })).items,
    ).toBeDefined()
  })

  test("header, journal, steps, children, awakeables", async () => {
    const [name, id] = [pin.workflow_name!, pin.workflow_id!]
    expect((await keiro.workflows.header(name, id)).workflow_id).toBe(id)
    const journal = await keiro.workflows.journal(name, id)
    expect(journal.generation).toBe(0)
    expect(typeof journal.items[0]!.global_position).toBe("bigint")
    expect((await keiro.workflows.steps(name, id)).items.length).toBeGreaterThan(0)
    expect((await keiro.workflows.children(name, id)).items[0]!.child_name).toBe("ship-order")
    expect((await keiro.workflows.awakeables(name, id)).items[0]!.status).toBe("completed")
  })

  test("an unknown workflow is 422 command_failed", async () => {
    await expect(keiro.workflows.header("nope", "nope")).rejects.toMatchObject({
      status: 422,
      code: "command_failed",
    })
  })
})

test("a journal global_position above 2^53 stays exact", async () => {
  const body =
    '{"generation":3,"items":[{"event_id":"e","event_type":"StepRecorded","global_position":9007199254740993,"payload":null,"recorded_at":"2026-10-21T00:00:00Z","step_name":"s","stream_version":1}]}'
  const client = createKeiroClient({
    baseUrl: "http://keiro.test/keiro",
    fetch: recordingFetch(200, body).fetch,
  })
  const page = await client.workflows.journal("w", "1")
  expect(page.items[0]!.global_position).toBe(9007199254740993n)
})

test("409 cursor_generation_mismatch becomes CursorMismatch", async () => {
  const body =
    '{"error":{"code":"cursor_generation_mismatch","message":"cursor belongs to another generation"}}'
  const client = createKeiroClient({
    baseUrl: "http://keiro.test/keiro",
    fetch: recordingFetch(409, body).fetch,
  })
  const error = await client.workflows
    .steps("w", "1", { after: "eyJ" as never })
    .catch((e: unknown) => e)
  expect(error).toBeInstanceOf(CursorMismatch)
  expect(isCursorMismatch(error)).toBe(true)
})

const make = (status: number, code: string) =>
  new ApiError({ surface: "keiro", status, code, message: code, raw: null })

test("typed code helpers", () => {
  expect(isSchemaDrift(make(409, "schema_drift"))).toBe(true)
  expect(isInspectionBusy(make(503, "inspection_busy"))).toBe(true)
  expect(isTooLarge(make(413, "inspection_result_too_large"))).toBe(true)
  expect(isTooLarge(make(413, "something_else"))).toBe(false)
})
