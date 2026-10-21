import { useSurfaceQuery } from "@keiro-ui/client-core"
import { keiroKeys, type TimerCursor, useKeiroClient } from "@keiro-ui/client-keiro"
import { useTimersFeed } from "@keiro-ui/client-keiro/feeds"

import { useLiveness } from "@/shell/liveness"

// Every timer read of the section goes through this file.

export const DEFAULT_LIMIT = 100

/**
 * One pending page per URL cursor. On page one the `timers` feed merges into this same cache
 * entry (it mirrors the first page only); deeper pages poll.
 */
export function useLiveTimers(params: {
  manager?: string
  correlation?: string
  after?: string
  limit?: number
}) {
  const keiro = useKeiroClient()
  const { paused } = useLiveness()
  const limit = params.limit ?? DEFAULT_LIMIT
  const filters = { manager: params.manager, correlation: params.correlation, limit }
  const page = useSurfaceQuery({
    surface: "keiro",
    queryKey:
      params.after === undefined
        ? keiroKeys.timers.pending(filters)
        : keiroKeys.timers.pending({ ...filters, after: params.after }),
    queryFn: ({ signal }) =>
      keiro.timers.pending({ ...filters, after: params.after as TimerCursor | undefined }, signal),
  })
  const feed = useTimersFeed(filters, { enabled: params.after === undefined && !paused })
  return { page, feedStatus: feed.status }
}

export function useStuckTimers(params: { min_age?: string; min_attempts?: number }) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.timers.stuck(params),
    queryFn: ({ signal }) => keiro.timers.stuck(params, signal),
  })
}
