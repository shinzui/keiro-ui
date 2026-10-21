import type { QueueRow } from "./queries"
import { queueSorts } from "./search"

export type QueueSort = (typeof queueSorts)[number]
export type SortDirection = "asc" | "desc"

export const DEFAULT_SORT: QueueSort = "oldest"

/** The direction a column sorts in when first chosen: names A→Z, everything else largest first. */
export function defaultDirection(sort: QueueSort): SortDirection {
  return sort === "name" ? "asc" : "desc"
}

function key(row: QueueRow, sort: QueueSort): number | bigint | string | null {
  const m = row.metrics
  switch (sort) {
    case "oldest":
      return m?.oldest_msg_age_sec ?? null
    case "newest":
      return m?.newest_msg_age_sec ?? null
    case "visible":
      return m?.queue_visible_length ?? null
    case "total":
      return m?.queue_length ?? null
    case "name":
      return row.queue.queue_name
  }
}

function byName(a: QueueRow, b: QueueRow): number {
  return a.queue.queue_name.localeCompare(b.queue.queue_name)
}

/**
 * Sorts queue rows by one column. Rows without a value (an empty queue's ages, or a queue
 * whose metrics have not arrived) go last in either direction; ties break by name.
 */
export function sortQueues(
  rows: QueueRow[],
  sort: QueueSort,
  direction: SortDirection,
): QueueRow[] {
  const sign = direction === "asc" ? 1 : -1
  return rows.toSorted((a, b) => {
    const ka = key(a, sort)
    const kb = key(b, sort)
    if (ka === null || kb === null) return ka === kb ? byName(a, b) : ka === null ? 1 : -1
    if (ka < kb) return -sign
    if (ka > kb) return sign
    return byName(a, b)
  })
}

/** Case-insensitive substring filter on the queue name. */
export function filterQueues(rows: QueueRow[], q: string | undefined): QueueRow[] {
  const needle = q?.trim().toLowerCase()
  return needle ? rows.filter((row) => row.queue.queue_name.toLowerCase().includes(needle)) : rows
}
