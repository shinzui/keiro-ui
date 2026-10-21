import { describe, expect, test } from "vitest"

import { entityKindSection, sectionForPathname } from "./navigation"
import type { EntityKind } from "./recent"

describe("sectionForPathname", () => {
  test.each([
    ["/", "overview"],
    ["/aggregates", "aggregates"],
    ["/aggregates/order", "aggregates"],
    ["/aggregates/order/ord-1", "aggregates"],
    ["/workflows", "workflows"],
    ["/workflows/billing/inv-7", "workflows"],
    ["/process-managers", "process-managers"],
    ["/process-managers/f/c", "process-managers"],
    ["/timers", "process-managers"],
    ["/projections", "projections"],
    ["/projections/g", "projections"],
    ["/shards", "projections"],
    ["/streams", "streams"],
    ["/streams/order-1", "streams"],
    ["/categories", "streams"],
    ["/categories/order", "streams"],
    ["/events", "streams"],
    ["/events/0b0c2b8e-0000-4000-8000-000000000000", "streams"],
    ["/subscriptions", "streams"],
    ["/subscriptions/orders", "streams"],
    ["/queues", "queues"],
    ["/queues/jobs", "queues"],
    ["/queues/jobs/messages/42", "queues"],
    ["/queues/jobs/archive/42", "queues"],
    ["/processors", "queues"],
    ["/processors/w", "queues"],
    ["/settings/connections", "settings"],
  ])("%s → %s", (pathname, section) => {
    expect(sectionForPathname(pathname).id).toBe(section)
  })

  test("a prefix must end at a segment boundary", () => {
    expect(sectionForPathname("/streamsx").id).toBe("overview")
  })
})

test("entityKindSection covers every kind", () => {
  const expected: Record<EntityKind, string> = {
    workflow: "workflows",
    aggregate: "aggregates",
    "process-manager": "process-managers",
    timer: "process-managers",
    projection: "projections",
    stream: "streams",
    category: "streams",
    event: "streams",
    subscription: "streams",
    queue: "queues",
    "queue-message": "queues",
    processor: "queues",
  }
  for (const [kind, section] of Object.entries(expected)) {
    expect(entityKindSection(kind as EntityKind)).toBe(section)
  }
})
