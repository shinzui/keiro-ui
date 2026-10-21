import { describe, expect, test } from "vitest"

import { links } from "@/lib/links"

import { jumpParsers, parseJump } from "./commands"

describe("parseJump", () => {
  test.each([
    ["workflow billing/inv-7", "Open workflow billing / inv-7", links.workflow("billing", "inv-7")],
    [
      "WORKFLOW order-fulfillment/ord-42",
      "Open workflow order-fulfillment / ord-42",
      links.workflow("order-fulfillment", "ord-42"),
    ],
    ["aggregate order/ord-1", "Open aggregate order / ord-1", links.aggregate("order", "ord-1")],
    [
      "pm fulfilment/corr-9",
      "Open process manager fulfilment / corr-9",
      links.processManagerInstance("fulfilment", "corr-9"),
    ],
    ["timer 7f3c", "Open timer 7f3c", links.timer("7f3c")],
    [
      "projection read-models",
      "Open projection group read-models",
      links.projection("read-models"),
    ],
    ["stream order-1", "Open stream order-1", links.stream("order-1")],
    ["category order", "Open category order", links.category("order")],
    [
      "event 0B0C2B8E-0000-4000-8000-000000000000",
      "Open event 0b0c2b8e-0000-4000-8000-000000000000",
      links.event("0b0c2b8e-0000-4000-8000-000000000000"),
    ],
    ["subscription orders", "Open subscription orders", links.subscription("orders")],
    ["queue jobs", "Open queue jobs", links.queue("jobs")],
    [
      "message jobs/9007199254740993",
      "Open message 9007199254740993 in jobs",
      links.queueMessage("jobs", "9007199254740993"),
    ],
    ["processor jobs-worker", "Open processor jobs-worker", links.processor("jobs-worker")],
    ["  stream   with spaces  ", "Open stream with spaces", links.stream("with spaces")],
    ["workflow a/b/c", "Open workflow a / b/c", links.workflow("a", "b/c")],
  ])("%s", (input, label, href) => {
    expect(parseJump(input)).toEqual({ label, href })
  })

  test.each([
    "",
    "workflow",
    "workflow ",
    "workflow billing",
    "workflow /inv-7",
    "workflow billing/",
    "event not-a-uuid",
    "message jobs/abc",
    "unknown thing",
    "subs",
  ])("rejects %j", (input) => {
    expect(parseJump(input)).toBeNull()
  })
})

test("there is exactly one parser per entity kind in the link map", () => {
  expect(jumpParsers.map((p) => p.prefix)).toEqual([
    "workflow",
    "aggregate",
    "pm",
    "timer",
    "projection",
    "stream",
    "category",
    "event",
    "subscription",
    "queue",
    "message",
    "processor",
  ])
})
