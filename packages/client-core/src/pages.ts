import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query"
import { useMemo } from "react"
import { z } from "zod"

import type { ApiError } from "./errors"
import { usePollInterval } from "./live"
import type { Surface } from "./surface"

/** One page of a cursor read. The wire field is `next_cursor`; absent means the last page. */
export interface Page<T, C = string> {
  items: T[]
  nextCursor?: C
}

/**
 * Reads `{items, next_cursor?}` plus any page-level fields declared in `extra` (keiro's
 * `observed_at`, `generation`, `visible_store_head`). The cursor is echoed back untouched;
 * it is never derived from the items.
 */
export function pageSchema<
  I extends z.ZodTypeAny,
  C extends z.ZodTypeAny,
  E extends z.ZodRawShape = {},
>(
  item: I,
  cursor: C,
  extra?: z.ZodObject<E>,
): z.ZodType<Page<z.output<I>, z.output<C>> & z.output<z.ZodObject<E>>, unknown> {
  const base = z.object({ items: z.array(item), next_cursor: cursor.nullish() })
  const shape = extra ? base.extend(extra.shape) : base
  return shape.transform((value) => {
    const {
      items,
      next_cursor: nextCursor,
      ...rest
    } = value as { items: unknown[]; next_cursor?: unknown } & Record<string, unknown>
    return nextCursor === undefined || nextCursor === null
      ? { ...rest, items }
      : { ...rest, items, nextCursor }
  }) as unknown as z.ZodType<Page<z.output<I>, z.output<C>> & z.output<z.ZodObject<E>>, unknown>
}

/**
 * "Load more" over a cursor read. The caller's `fetchPage` is the only place that knows
 * whether the parameter is called `from` or `after`. Polling follows `useSurfaceQuery`'s
 * rules; a poll re-reads the loaded pages in order (TanStack Query's infinite refetch).
 */
export function useCursorPages<T, C>(options: {
  surface: Surface
  queryKey: readonly unknown[]
  fetchPage(cursor: C | undefined, signal: AbortSignal): Promise<Page<T, C>>
  enabled?: boolean
  poll?: number | false
}): UseInfiniteQueryResult<InfiniteData<Page<T, C>>, ApiError> & { items: T[]; hasMore: boolean } {
  const { measure, refetchInterval } = usePollInterval(options.surface, options.poll)
  const result = useInfiniteQuery<
    Page<T, C>,
    ApiError,
    InfiniteData<Page<T, C>>,
    readonly unknown[],
    C | undefined
  >({
    queryKey: options.queryKey,
    enabled: options.enabled,
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
    queryFn: ({ pageParam, signal }) =>
      measure(() => options.fetchPage(pageParam as C | undefined, signal)),
    refetchInterval,
    refetchIntervalInBackground: false,
  })
  const items = useMemo(() => result.data?.pages.flatMap((page) => page.items) ?? [], [result.data])
  return Object.assign(result, { items, hasMore: result.hasNextPage })
}
