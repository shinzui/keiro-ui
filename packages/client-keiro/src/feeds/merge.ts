import type { Frame } from "@keiro-ui/client-core"

export interface FeedState<T> {
  items: T[]
  sequence?: number
}

/**
 * Applies one feed frame: a `snapshot` replaces the items; an `update` upserts each `changed`
 * item by key and deletes each `removed` key, then re-sorts with `compare` (the read's own
 * ordering) so the merged page equals a fresh list read. `resync` is true when the update's
 * `sequence` is not the previous one plus one: frames were missed and the owner must re-read.
 */
export function mergeFeedFrame<T>(
  current: FeedState<T> | undefined,
  frame: Frame,
  keyOf: (item: T) => string,
  compare?: (a: T, b: T) => number,
): { items: T[]; sequence: number; resync: boolean } {
  const sequence = typeof frame.sequence === "number" ? frame.sequence : Number(frame.sequence ?? 0)
  if (frame.type === "snapshot") {
    return { items: [...((frame.items as T[] | undefined) ?? [])], sequence, resync: false }
  }
  const items = [...(current?.items ?? [])]
  const index = new Map(items.map((item, i) => [keyOf(item), i]))
  for (const changed of (frame.changed as T[] | undefined) ?? []) {
    const at = index.get(keyOf(changed))
    if (at === undefined) {
      index.set(keyOf(changed), items.length)
      items.push(changed)
    } else {
      items[at] = changed
    }
  }
  const removed = new Set(
    ((frame.removed as Record<string, unknown>[] | undefined) ?? []).map((key) => keyOf(key as T)),
  )
  const filtered = items.filter((item) => !removed.has(keyOf(item)))
  const kept = compare ? filtered.toSorted(compare) : filtered
  const previous = current?.sequence
  return { items: kept, sequence, resync: previous === undefined || sequence !== previous + 1 }
}

export const workflowKey = (item: { workflow_name?: unknown; workflow_id?: unknown }) =>
  `${String(item.workflow_name)}/${String(item.workflow_id)}`
export const timerKey = (item: { timer_id?: unknown }) => String(item.timer_id)
export const groupKey = (item: { group_id?: unknown }) => String(item.group_id)

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** `/wf/inspect/list`'s default order: workflow name, then id. */
export const workflowOrder = (
  a: { workflow_name?: unknown; workflow_id?: unknown },
  b: { workflow_name?: unknown; workflow_id?: unknown },
) =>
  byText(String(a.workflow_name), String(b.workflow_name)) ||
  byText(String(a.workflow_id), String(b.workflow_id))
/** Pending timers: due first, then id. */
export const timerOrder = (
  a: { fire_at?: unknown; timer_id?: unknown },
  b: { fire_at?: unknown; timer_id?: unknown },
) => byText(String(a.fire_at), String(b.fire_at)) || byText(String(a.timer_id), String(b.timer_id))
export const groupOrder = (a: { group_id?: unknown }, b: { group_id?: unknown }) =>
  byText(String(a.group_id), String(b.group_id))
