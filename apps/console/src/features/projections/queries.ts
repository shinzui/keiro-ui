import { useSurfaceQuery } from "@keiro-ui/client-core"
import { keiroKeys, type ProjectionStatusCursor, useKeiroClient } from "@keiro-ui/client-keiro"
import { useProjectionGroupsFeed } from "@keiro-ui/client-keiro/feeds"

import { useLiveness } from "@/shell/liveness"

// Every keiro projection and shard read of the section goes through this file.

/**
 * One status page per URL cursor. Page one shares its cache entry with the
 * `projection_groups` feed, which mirrors the first page only; later pages poll.
 */
export function useProjectionStatus(after?: string) {
  const keiro = useKeiroClient()
  const { paused } = useLiveness()
  const page = useSurfaceQuery({
    surface: "keiro",
    queryKey:
      after === undefined
        ? keiroKeys.projections.status()
        : keiroKeys.projections.status({ after }),
    queryFn: ({ signal }) =>
      keiro.projections.status({ after: after as ProjectionStatusCursor | undefined }, signal),
  })
  const feed = useProjectionGroupsFeed({ enabled: after === undefined && !paused })
  return { page, feedStatus: feed.status }
}

export function useProjectionPosition(subscription: string | undefined) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.projections.position(subscription ?? ""),
    queryFn: ({ signal }) => keiro.projections.position({ subscription: subscription! }, signal),
    enabled: subscription !== undefined,
  })
}

export function useShards() {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.shards.list(),
    queryFn: ({ signal }) => keiro.shards.list(signal),
  })
}

export function useShardStatus(subscription: string | undefined) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.shards.status(subscription ?? ""),
    queryFn: ({ signal }) => keiro.shards.status({ subscription: subscription! }, signal),
    enabled: subscription !== undefined,
  })
}

/**
 * One group's status row: the status pages are read in order until the group appears (keiro
 * has no single-group read). Polls like the list.
 */
export function useProjectionGroup(groupId: string) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.projections.status({ group: groupId }),
    queryFn: ({ signal }) => {
      // Each page's cursor is the next request's `after`, so the reads chain (at most 50 pages).
      const search = async (after: ProjectionStatusCursor | undefined, pages: number) => {
        const result = await keiro.projections.status({ after }, signal)
        const group = result.items.find((item) => item.group_id === groupId)
        if (group)
          return {
            group,
            visible_store_head: result.visible_store_head,
            observed_at: result.observed_at,
          }
        if (result.nextCursor === undefined || pages >= 50) return null
        return search(result.nextCursor, pages + 1)
      }
      return search(undefined, 1)
    },
  })
}
