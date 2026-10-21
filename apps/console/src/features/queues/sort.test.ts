import { toInt64 } from "@keiro-ui/client-core"
import type { QueueMetrics } from "@keiro-ui/client-pgmq"
import { expect, test } from "vitest"

import type { QueueRow } from "./queries"
import { filterQueues, sortQueues } from "./sort"

function row(name: string, oldest: number | null, visible = 0n): QueueRow {
  return {
    queue: { queue_name: name, is_partitioned: false, is_unlogged: false, created_at: "" },
    metrics: {
      queue_name: name,
      queue_length: toInt64(visible),
      queue_visible_length: toInt64(visible),
      oldest_msg_age_sec: oldest,
      newest_msg_age_sec: oldest,
      total_messages: toInt64(0n),
      scrape_time: "",
      default_partition_length: null,
    } satisfies QueueMetrics,
  }
}

const names = (rows: QueueRow[]) => rows.map((r) => r.queue.queue_name)

test("oldest descending puts the older queue first and empty queues last", () => {
  const rows = [row("young", 120), row("empty", null), row("old", 900)]
  expect(names(sortQueues(rows, "oldest", "desc"))).toEqual(["old", "young", "empty"])
})

test("empty queues stay last in ascending order too", () => {
  const rows = [row("young", 120), row("empty", null), row("old", 900)]
  expect(names(sortQueues(rows, "oldest", "asc"))).toEqual(["young", "old", "empty"])
})

test("a queue whose metrics have not arrived sorts last", () => {
  const pending: QueueRow = { queue: row("pending", 1).queue }
  expect(names(sortQueues([pending, row("a", 5)], "oldest", "desc"))).toEqual(["a", "pending"])
})

test("counts compare as bigint and ties break by name", () => {
  const rows = [row("b", 1, 7n), row("a", 1, 7n), row("c", 1, 9007199254740994n)]
  expect(names(sortQueues(rows, "visible", "desc"))).toEqual(["c", "a", "b"])
})

test("the filter matches a case-insensitive substring of the name", () => {
  const rows = [row("orders", 1), row("dlq_orders", 1), row("payments", 1)]
  expect(names(filterQueues(rows, " ORDERS "))).toEqual(["orders", "dlq_orders"])
  expect(filterQueues(rows, "")).toHaveLength(3)
})
