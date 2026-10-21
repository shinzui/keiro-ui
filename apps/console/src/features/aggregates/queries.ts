import { useSurfaceQuery } from "@keiro-ui/client-core"
import {
  type AggregateListCursor,
  isRouteUnavailable,
  keiroKeys,
  useKeiroClient,
} from "@keiro-ui/client-keiro"
import { kirokuKeys, useKirokuClient } from "@keiro-ui/client-kiroku"

// Every aggregate read of the section goes through this file. The `aggregate` command word is
// hook-gated: an unmounted host refuses it with the client's `RouteUnavailable`.

export const DEFAULT_LIMIT = 50

export function useAggregateTypes() {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.aggregates.types(),
    queryFn: ({ signal }) => keiro.aggregates.types(signal),
    poll: false,
  })
}

/**
 * Whether this host mounts aggregate inspection: the types read answers, or refuses with
 * `RouteUnavailable`. Shared with the Overview card.
 */
export function useAggregatesMounted(): { mounted: boolean | undefined } {
  const types = useAggregateTypes()
  if (types.isSuccess) return { mounted: true }
  if (types.isError && isRouteUnavailable(types.error)) return { mounted: false }
  return { mounted: undefined }
}

export function useAggregatePage(type: string, params: { after?: string; limit?: number }) {
  const keiro = useKeiroClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.aggregates.list(type, { limit, after: params.after }),
    queryFn: ({ signal }) =>
      keiro.aggregates.list(
        { name: type, limit, after: params.after as AggregateListCursor | undefined },
        signal,
      ),
  })
}

export function useAggregate(type: string, id: string) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.aggregates.show(type, id),
    queryFn: ({ signal }) => keiro.aggregates.show({ name: type, id }, signal),
  })
}

export function useAggregateSnapshot(type: string, id: string) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.aggregates.snapshot(type, id),
    queryFn: ({ signal }) => keiro.aggregates.snapshot({ name: type, id }, signal),
  })
}

/**
 * The aggregate's stream from kiroku, one page per cursor; disabled until the aggregate view
 * names the stream (the show query gates this one).
 */
export function useStreamEvents(
  streamName: string | undefined,
  params: { from?: bigint; direction: "forward" | "backward"; limit?: number },
) {
  const kiroku = useKirokuClient()
  const limit = params.limit ?? 100
  const from = params.from ?? 0n
  return useSurfaceQuery({
    surface: "kiroku",
    queryKey: kirokuKeys.streamEvents(streamName ?? "", {
      direction: params.direction,
      limit,
      from: from.toString(),
    }),
    enabled: streamName !== undefined,
    queryFn: ({ signal }) =>
      kiroku.streams.events(streamName!, { from, direction: params.direction, limit }, signal),
  })
}
