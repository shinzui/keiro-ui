import { useSurfaceQuery } from "@keiro-ui/client-core"
import { kirokuKeys, type KirokuNameCursor, useKirokuClient } from "@keiro-ui/client-kiroku"

import { DEFAULT_LIMIT } from "./search"

// One page per query, keyed by the URL's cursor: every list in this section keeps its cursor
// in the URL (the client core's useCursorPages is the "load more" adapter, not used here).

const BROWSE_MS = 10_000

export function useStreamsPage(params: {
  category?: string
  prefix?: string
  from?: string
  limit?: number
}) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.streams({
      category: params.category,
      prefix: params.prefix,
      limit,
      from: params.from,
    }),
    queryFn: ({ signal }) =>
      kiroku.streams.page(
        {
          category: params.category,
          prefix: params.prefix,
          from: params.from as KirokuNameCursor | undefined,
          limit,
        },
        signal,
      ),
    poll: BROWSE_MS,
  })
}

export function useStreamEventsPage(
  name: string,
  params: { from?: bigint; direction?: "forward" | "backward"; limit?: number },
) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  const from = params.from ?? 0n
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.streamEvents(name, {
      direction: params.direction,
      limit,
      from: from.toString(),
    }),
    queryFn: ({ signal }) =>
      kiroku.streams.events(name, { from, direction: params.direction, limit }, signal),
    poll: BROWSE_MS,
  })
}

export function useCategoriesPage(params: { from?: string; limit?: number }) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.categories({ limit, from: params.from }),
    queryFn: ({ signal }) =>
      kiroku.categories.page({ from: params.from as KirokuNameCursor | undefined, limit }, signal),
    poll: BROWSE_MS,
  })
}

export function useCategoryEventsPage(name: string, params: { from?: bigint; limit?: number }) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  const from = params.from ?? 0n
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.categoryEvents(name, { limit, from: from.toString() }),
    queryFn: ({ signal }) => kiroku.categories.events(name, { from, limit }, signal),
    poll: BROWSE_MS,
  })
}

/** The newest page of the `$all` log (`from=0`, backward). */
export function useNewestEvents(limit: number) {
  const kiroku = useKirokuClient()
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.allEvents({ direction: "backward", limit, from: "0" }),
    queryFn: ({ signal }) => kiroku.events.all({ from: 0n, direction: "backward", limit }, signal),
  })
}

export function useDeadLettersPage(
  subscription: string,
  params: { member?: number; from?: string; limit?: number },
) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.deadLetters(subscription, {
      member: params.member,
      limit,
      from: params.from,
    }),
    queryFn: ({ signal }) =>
      kiroku.deadLetters.page(
        subscription,
        { member: params.member, from: params.from as KirokuNameCursor | undefined, limit },
        signal,
      ),
    poll: BROWSE_MS,
  })
}
