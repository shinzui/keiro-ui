import { fixtureText } from "@keiro-ui/testing"
import { type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import {
  ApiError,
  CategoryConsumersPage,
  createKeiroClient,
  isInspectionReadUnavailable,
  keiroKeys,
  WorkflowCounts,
} from "../src"
import { baseUrl } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())
const client = createKeiroClient({ baseUrl })

test("recorded counts decode, exact name filters stay distinct, unknown names are not fabricated", async () => {
  const global = await client.workflows.counts()
  expect(Object.values(global.counts).every((n) => typeof n === "bigint")).toBe(true)
  expect(
    (await client.workflows.counts({ workflow_name: pins("keiro").workflow_name })).observed_at,
  ).toBeTypeOf("string")
  expect(
    Object.values(
      (await client.workflows.counts({ workflow_name: "keiro-ui-counts-missing" })).counts,
    ),
  ).toEqual(Array(7).fill(0n))
  await expect(client.workflows.counts({ workflow_name: "arbitrary-name" })).rejects.toMatchObject({
    status: 404,
  })
  expect(keiroKeys.workflows.counts()).not.toEqual(
    keiroKeys.workflows.counts({ workflow_name: "Order" }),
  )
})

test("counts retain every digit, reject negatives and missing statuses, and send only name", async () => {
  const body = JSON.parse(fixtureText("keiro/workflow-counts.json"))
  body.counts.running = "9007199254740993"
  mock.use(
    http.get("*/keiro/wf/inspect/counts", ({ request }) => {
      expect([...new URL(request.url).searchParams]).toEqual([
        ["workflow_name", "Exact Name:Child"],
      ])
      return HttpResponse.json(body)
    }),
  )
  const result = await client.workflows.counts({ workflow_name: "Exact Name:Child" })
  expect(result.counts.running).toBe(9007199254740993n)
  expect(
    WorkflowCounts.safeParse({ ...body, counts: { ...body.counts, failed: -1 } }).success,
  ).toBe(false)
  delete body.counts.failed
  expect(WorkflowCounts.safeParse(body).success).toBe(false)
})

test("recorded declarations and invalid cursor preserve coverage and errors", async () => {
  const order = await client.projections.consumers({ category: "order", limit: 100 })
  expect(order.items[0]?.name).toBe("jitsurei-order-reporting")
  expect(order.items[0]?.bindings.map((b) => b.delivery)).toEqual(
    expect.arrayContaining(["inline", "subscription"]),
  )
  const empty = await client.projections.consumers({ category: "creditLimit" })
  expect(empty.items).toEqual([])
  expect(empty.coverage).toEqual({ projection_catalog: true, durable_subscribers: false })
  await expect(
    client.projections.consumers({ category: "order", after: "garbage" as never }),
  ).rejects.toMatchObject({ status: 400, code: "invalid_cursor" })
})

test("synthetic pages retain all consumer/source kinds, null identities and opaque continuation", async () => {
  const body = JSON.parse(fixtureText("keiro/category-consumers-order.json"))
  body.coverage = { projection_catalog: false, durable_subscribers: true }
  body.items = ["durable_subscriber", "process_manager", "projection_group"].map((kind, i) => ({
    kind,
    name: `consumer-${i}`,
    group_id: null,
    bindings: [
      {
        projection_id: null,
        handler_name: null,
        subscription_id: null,
        subscription_name: null,
        delivery: "subscription",
        source: [
          { kind: "all" },
          { kind: "category", category: "Order" },
          { kind: "namespace", namespace: "Order:Child" },
        ][i],
      },
    ],
  }))
  body.next_cursor = "opaque+/=:cursor"
  mock.use(
    http.get("*/keiro/projection/consumers", ({ request }) => {
      const query = new URL(request.url).searchParams
      expect(query.get("category")).toBe("Order:Child")
      expect(query.get("limit")).toBe("1")
      return HttpResponse.json(
        query.has("after") ? { ...body, items: [], next_cursor: undefined } : body,
      )
    }),
  )
  const first = await client.projections.consumers({ category: "Order:Child", limit: 1 })
  expect(first.nextCursor).toBe(body.next_cursor)
  expect(first.items).toHaveLength(3)
  expect(first.coverage).toEqual(body.coverage)
  expect(
    (
      await client.projections.consumers({
        category: "Order:Child",
        limit: 1,
        after: first.nextCursor,
      })
    ).nextCursor,
  ).toBeUndefined()
  expect(CategoryConsumersPage.safeParse({ ...body, scope: "runtime" }).success).toBe(false)
})

test("category and limit validation happens before sending; signals abort requests", async () => {
  for (const category of ["", " order", "order "])
    expect(() => client.projections.consumers({ category })).toThrow(RangeError)
  for (const limit of [0, 501, 1.5])
    expect(() => client.projections.consumers({ category: "order", limit })).toThrow(RangeError)
  const controller = new AbortController()
  controller.abort()
  await expect(client.workflows.counts({}, controller.signal)).rejects.toBeDefined()
  await expect(
    client.projections.consumers({ category: "order" }, controller.signal),
  ).rejects.toBeDefined()
})

const refusal = (code: string, status = 400, args?: unknown) =>
  new ApiError({
    surface: "keiro",
    status,
    code,
    message: "original",
    raw: {},
    details: { arguments: args },
  })
test("availability recognizes only the requested command and preserves real failures", () => {
  const counts = refusal("invalid_request", 400, [
    "wf",
    "inspect",
    "counts",
    "--workflow-name",
    "x",
  ])
  const consumers = refusal("invalid_request", 400, [
    "projection",
    "consumers",
    "--category",
    "order",
  ])
  expect(isInspectionReadUnavailable(counts, "workflow-counts")).toBe(true)
  expect(isInspectionReadUnavailable(consumers, "category-consumers")).toBe(true)
  expect(isInspectionReadUnavailable(counts, "category-consumers")).toBe(false)
  expect(isInspectionReadUnavailable(refusal("unsupported_command"), "category-consumers")).toBe(
    true,
  )
  for (const error of [
    refusal("invalid_request"),
    refusal("invalid_request", 400, ["wf", "inspect", "list"]),
    refusal("unsupported_command"),
    refusal("schema_drift", 503),
    refusal("inspection_busy", 503),
    refusal("inspection_timeout", 504),
    refusal("command_failed", 500),
    refusal("inspection_result_too_large", 413),
    refusal("http_502", 502),
  ]) {
    expect(isInspectionReadUnavailable(error, "workflow-counts")).toBe(false)
  }
  expect(counts.message).toBe("original")
})
