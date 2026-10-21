import {
  type FeedStatus,
  type Frame,
  useFeedSubscription,
  webSocketUrlFor,
} from "@keiro-ui/client-core"
import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useRef, useState } from "react"
import { z } from "zod"

import type { WorkflowListFilters } from "../client"
import { useKeiroClient } from "../provider"
import { keiroKeys } from "../query-keys"
import { ProjectionGroupStatus, TimerItem, WorkflowInstance } from "../schemas"
import { type KeiroFeedName, type KeiroFeedSubscription, keiroFeedDialect } from "./dialect"
import {
  groupKey,
  groupOrder,
  mergeFeedFrame,
  timerKey,
  timerOrder,
  workflowKey,
  workflowOrder,
} from "./merge"

export type KeiroFeedStatus = "live" | "reconnecting" | "read_failed" | "off"

export interface KeiroFeedOptions {
  enabled?: boolean
  onResync?: () => void
}

function feedStatus(status: FeedStatus, enabled: boolean, readFailed: boolean): KeiroFeedStatus {
  if (!enabled || status === "closed") return "off"
  if (status !== "open") return "reconnecting"
  return readFailed ? "read_failed" : "live"
}

/**
 * The shared mechanics: frames are validated, merged with `mergeFeedFrame` onto the first
 * page's cache entry (`queryKey`), and a sequence gap, `queue_overflow`, or reconnect
 * re-reads that entry from the poll path. `read_failed` errors are a status, not an exception.
 */
function useKeiroFeed<T>(params: {
  feed: KeiroFeedName
  filters: Record<string, unknown>
  queryKey: readonly unknown[]
  item: z.ZodType<T>
  keyOf: (item: T) => string
  compare: (a: T, b: T) => number
  enabled: boolean
  onResync?: () => void
  /** Extra page-level fields taken from frames (projection groups: visible_store_head). */
  pageFields?: (frame: Frame) => Record<string, unknown>
}): { status: KeiroFeedStatus } {
  const client = useKeiroClient()
  const queryClient = useQueryClient()
  const sequence = useRef<number | undefined>(undefined)
  const [readFailed, setReadFailed] = useState(false)
  const { feed, filters, queryKey, item, keyOf, compare, onResync, pageFields } = params
  const subscriptions = useMemo<KeiroFeedSubscription[]>(
    () => [{ feed, ...filters }],
    [feed, filters],
  )
  const items = useMemo(() => z.array(item), [item])

  const resync = () => {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] })
    onResync?.()
  }

  const { status } = useFeedSubscription({
    enabled: params.enabled,
    url: webSocketUrlFor(client.http.baseUrl, "/ws"),
    dialect: keiroFeedDialect,
    subscriptions,
    invalidate: queryKey,
    onResync: () => onResync?.(),
    onError: (frame) => {
      if (frame.code === "read_failed") setReadFailed(true)
    },
    applyToCache: (cache, frame, kind) => {
      if (kind === "extra" || frame.feed !== feed) return
      setReadFailed(false)
      const parsed = items.safeParse(kind === "snapshot" ? frame.items : frame.changed)
      if (!parsed.success) return
      const validated =
        kind === "snapshot" ? { ...frame, items: parsed.data } : { ...frame, changed: parsed.data }
      const page = cache.getQueryData<{ items: T[] } & Record<string, unknown>>(queryKey)
      const merged = mergeFeedFrame<T>(
        { items: page?.items ?? [], sequence: sequence.current },
        validated,
        keyOf,
        compare,
      )
      sequence.current = merged.sequence
      cache.setQueryData(queryKey, { ...page, ...pageFields?.(frame), items: merged.items })
      if (kind === "delta" && merged.resync) resync()
    },
  })
  return { status: feedStatus(status, params.enabled, readFailed) }
}

/**
 * The `workflows` feed accepts only `status_class`, `workflow_name`, and `limit`; a list with a
 * time window or a non-default ordering is poll-only, so the feed stays off for it.
 */
export function useWorkflowsFeed(
  filters: WorkflowListFilters = {},
  options: KeiroFeedOptions = {},
) {
  const { status_class, workflow_name, limit, after, ...rest } = filters
  const pollOnly = after !== undefined || Object.values(rest).some((value) => value !== undefined)
  const feedFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({ status_class, workflow_name, limit }).filter(([, v]) => v !== undefined),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
    [JSON.stringify(status_class), workflow_name, limit],
  )
  return useKeiroFeed({
    feed: "workflows",
    filters: feedFilters,
    queryKey: keiroKeys.workflows.list(filters as Record<string, unknown>),
    item: WorkflowInstance,
    keyOf: workflowKey,
    compare: workflowOrder,
    enabled: options.enabled !== false && !pollOnly,
    onResync: options.onResync,
  })
}

export function useTimersFeed(
  filters: { manager?: string; correlation?: string; limit?: number } = {},
  options: KeiroFeedOptions = {},
) {
  const { manager, correlation, limit } = filters
  const feedFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({ manager, correlation, limit }).filter(([, v]) => v !== undefined),
      ),
    [manager, correlation, limit],
  )
  return useKeiroFeed({
    feed: "timers",
    filters: feedFilters,
    queryKey: keiroKeys.timers.pending(filters),
    item: TimerItem,
    keyOf: timerKey,
    compare: timerOrder,
    enabled: options.enabled !== false,
    onResync: options.onResync,
  })
}

const noFilters = {}

/** Also stores the frame's `visible_store_head` on the projection status page. */
export function useProjectionGroupsFeed(options: KeiroFeedOptions = {}) {
  return useKeiroFeed({
    feed: "projection_groups",
    filters: noFilters,
    queryKey: keiroKeys.projections.status(),
    item: ProjectionGroupStatus,
    keyOf: groupKey,
    compare: groupOrder,
    enabled: options.enabled !== false,
    onResync: options.onResync,
    pageFields: (frame) =>
      frame.visible_store_head === undefined
        ? {}
        : { visible_store_head: frame.visible_store_head },
  })
}
