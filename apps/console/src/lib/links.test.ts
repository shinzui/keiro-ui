import { expect, test } from "vitest"

import { router } from "@/router"

import { hrefOf, links } from "./links"

test.each([
  [links.overview(), "/"],
  [links.aggregates(), "/aggregates"],
  [links.aggregateType("order"), "/aggregates/order"],
  [links.aggregate("order", "ord-1"), "/aggregates/order/ord-1"],
  [links.workflows({ status_class: ["running"] }), "/workflows"],
  [links.workflow("billing", "inv-7"), "/workflows/billing/inv-7"],
  [links.processManagers(), "/process-managers"],
  [links.processManager("fulfilment"), "/process-managers/fulfilment"],
  [links.processManagerInstance("fulfilment", "c-1"), "/process-managers/fulfilment/c-1"],
  [links.timers({ manager: "m", correlation: "c", tab: "stuck" }), "/timers"],
  [links.timer("t-1"), "/timers"],
  [links.projections(), "/projections"],
  [links.projection("read-models"), "/projections/read-models"],
  [links.shards({ subscription: "s" }), "/shards"],
  [links.streams({ category: "order" }), "/streams"],
  [links.stream("order-1"), "/streams/order-1"],
  [links.streamEvents("order-1", { from: "41" }), "/streams/order-1"],
  [links.categories(), "/categories"],
  [links.category("order"), "/categories/order"],
  [links.categoryEvents("order", { from: "7" }), "/categories/order"],
  [links.allEvents({ from: "41", direction: "backward" }), "/events"],
  [
    links.event("0b0c2b8e-0000-4000-8000-000000000000"),
    "/events/0b0c2b8e-0000-4000-8000-000000000000",
  ],
  [links.subscriptions(), "/subscriptions"],
  [links.subscription("orders"), "/subscriptions/orders"],
  [links.queues(), "/queues"],
  [links.queue("jobs", { tab: "archive" }), "/queues/jobs"],
  [links.queueMessage("jobs", "9007199254740993"), "/queues/jobs/messages/9007199254740993"],
  [links.archivedMessage("jobs", "42"), "/queues/jobs/archive/42"],
  [links.processors(), "/processors"],
  [links.processor("jobs-worker"), "/processors/jobs-worker"],
  [links.settingsConnections(), "/settings/connections"],
])("%o resolves to %s", (target, pathname) => {
  expect(router.buildLocation(target as never).pathname).toBe(pathname)
})

test("search parameters and odd characters survive hrefOf", () => {
  expect(hrefOf(links.allEvents({ from: "41", direction: "backward" }))).toBe(
    "/events?from=41&direction=backward",
  )
  expect(hrefOf(links.stream("order/42:7"))).toBe("/streams/order%2F42%3A7")
  expect(hrefOf(links.timer("t-1"))).toBe("/timers?sheet=timer%3At-1")
  expect(hrefOf(links.workflows({ status_class: ["running", "failed"] }))).toBe(
    "/workflows?status_class=%5B%22running%22%2C%22failed%22%5D",
  )
})

test("int64 search values parse back as exact decimal strings", () => {
  const location = router.buildLocation({
    href: "/events?from=9007199254740993&direction=forward",
  } as never)
  expect(location.search).toEqual({ from: "9007199254740993", direction: "forward" })
  expect(router.options.parseSearch("?status_class=%5B%22running%22%5D")).toEqual({
    status_class: ["running"],
  })
})
