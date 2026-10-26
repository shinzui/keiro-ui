import {
  type QueryClient,
  type QueryKey,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query"
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useSurfaceAvailable } from "./availability"
import { ApiError } from "./errors"
import { type Dialect, type FeedStatus, type Frame, openFeed } from "./feed"
import { surfaces, type Surface } from "./surface"

// ADR-3: every live view polls; pushes only shorten latency. Paused means polling stops and
// the screen is explicitly stale.

export interface LivenessController {
  paused: boolean
  pausedSince: Date | null
  pause(): void
  /** Also refreshes every surface immediately. */
  resume(): void
  /** Invalidates every surface's query-key prefix (["kiroku"], ["pgmq"], ...). */
  refreshAll(): Promise<void>
}

const LivenessContext = createContext<LivenessController | null>(null)

export function LivenessProvider(props: { children: ReactNode; initialPaused?: boolean }) {
  const queryClient = useQueryClient()
  const [pausedSince, setPausedSince] = useState<Date | null>(() =>
    props.initialPaused ? new Date() : null,
  )
  const refreshAll = useCallback(async () => {
    await Promise.all(
      surfaces.map((surface) => queryClient.invalidateQueries({ queryKey: [surface] })),
    )
  }, [queryClient])
  const value = useMemo<LivenessController>(
    () => ({
      paused: pausedSince !== null,
      pausedSince,
      pause: () => setPausedSince((since) => since ?? new Date()),
      resume: () => {
        setPausedSince(null)
        void refreshAll()
      },
      refreshAll,
    }),
    [pausedSince, refreshAll],
  )
  return createElement(LivenessContext.Provider, { value }, props.children)
}

export function useLiveness(): LivenessController {
  const value = useContext(LivenessContext)
  if (!value) throw new Error("useLiveness requires <LivenessProvider>")
  return value
}

/** Default polling intervals per surface, in milliseconds. */
export const surfacePollDefaults: Record<Surface, number> = {
  kiroku: 5000,
  pgmq: 5000,
  shibuya: 2000,
  keiro: 5000,
}

/**
 * Restate's clamp: the base interval while the last fetch took at most 1 s, otherwise
 * clamp(10 s, 10 × last fetch, 60 s).
 */
export function adaptiveInterval(baseMs: number, lastFetchMs: number): number {
  if (lastFetchMs <= 1000) return baseMs
  return Math.min(60_000, Math.max(10_000, 10 * lastFetchMs))
}

/** Shared by useSurfaceQuery and useCursorPages: duration measurement and the interval. */
export function usePollInterval(surface: Surface, poll: number | false | undefined) {
  const { paused } = useLiveness()
  const lastDuration = useRef(0)
  const base = poll === undefined ? surfacePollDefaults[surface] : poll
  const measure = useCallback(async <T>(run: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await run()
    } finally {
      lastDuration.current = performance.now() - started
    }
  }, [])
  const refetchInterval: false | (() => number) =
    paused || base === false ? false : () => adaptiveInterval(base, lastDuration.current)
  return { paused, measure, refetchInterval, lastDuration }
}

/**
 * Retries at most twice, and only what may succeed next time: a network failure (status 0) or
 * a 5xx, directly or as the `cause` of a client's typed error. A 4xx is a definite answer
 * and a response that fails its schema fails again, so neither is retried.
 */
export function surfaceRetry(failureCount: number, error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if (e instanceof ApiError) return (e.status === 0 || e.status >= 500) && failureCount < 2
  }
  return false
}

/**
 * A polling query with the console's liveness rules: the surface's default interval (or
 * `poll`), stretched by `adaptiveInterval` after a slow fetch, stopped while paused, and
 * refetched once immediately on resume.
 */
export function useSurfaceQuery<TData, TError = ApiError>(
  options: UseQueryOptions<TData, TError> & { surface: Surface; poll?: number | false },
): UseQueryResult<TData, TError> {
  const { surface, poll, queryFn, ...rest } = options
  const available = useSurfaceAvailable(surface)
  const { paused, measure, refetchInterval } = usePollInterval(surface, poll)
  const result = useQuery<TData, TError>({
    retry: surfaceRetry,
    ...rest,
    enabled: available ? rest.enabled : false,
    queryFn:
      typeof queryFn === "function"
        ? (context) =>
            measure(async () => (queryFn as (c: typeof context) => TData | Promise<TData>)(context))
        : queryFn,
    refetchInterval,
    refetchIntervalInBackground: false,
  })
  const wasPaused = useRef(paused)
  const { refetch } = result
  useEffect(() => {
    // Resume refetches immediately; cancelRefetch false joins the fetch resume() already
    // started through refreshAll, so the query fetches exactly once.
    if (wasPaused.current && !paused) void refetch({ cancelRefetch: false })
    wasPaused.current = paused
  }, [paused, refetch])
  return result
}

/**
 * Layers a feed onto the query cache (ADR-3: push is a hint, poll is truth). Open while
 * `enabled` and not paused; closed when paused, disabled, or unmounted. Frames go to
 * `applyToCache`; an overflow, resync frame, or reconnect invalidates `invalidate` so the
 * owning queries re-read.
 */
export function useFeedSubscription<SubscribeArgs = void>(options: {
  enabled?: boolean
  url: string
  dialect: Dialect<SubscribeArgs>
  subscriptions?: SubscribeArgs[]
  applyToCache(queryClient: QueryClient, frame: Frame, kind: "snapshot" | "delta" | "extra"): void
  invalidate: readonly unknown[]
  /** Called after the invalidation, with the overflow/resync frame or `reconnected`. */
  onResync?(reason: { code: string; frame?: Frame }): void
  /** Coded error frames that are not overflow (feed-level errors). */
  onError?(frame: Frame): void
  WebSocket?: typeof WebSocket
}): { status: FeedStatus } {
  const queryClient = useQueryClient()
  const { paused } = useLiveness()
  const [status, setStatus] = useState<FeedStatus>("connecting")
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  const available = useSurfaceAvailable(options.invalidate[0] as Surface)
  const active = available && options.enabled !== false && !paused
  const subscriptionsKey = JSON.stringify(options.subscriptions ?? [], (_k, v: unknown) =>
    typeof v === "bigint" ? v.toString() : v,
  )
  const invalidateKey = JSON.stringify(options.invalidate)

  // Reopen only when the connection's identity changes: the URL, the dialect, or the
  // subscriptions/invalidation key by value (callers pass fresh arrays every render).
  useEffect(() => {
    if (!active) return
    let disposed = false
    const apply = (kind: "snapshot" | "delta" | "extra") => (frame: Frame) =>
      !disposed && latest.current.applyToCache(queryClient, frame, kind)
    const handle = openFeed<SubscribeArgs>({
      url: options.url,
      dialect: options.dialect,
      subscriptions: latest.current.subscriptions,
      WebSocket: latest.current.WebSocket,
      onSnapshot: apply("snapshot"),
      onDelta: apply("delta"),
      onExtra: apply("extra"),
      onResync: (reason) => {
        if (disposed) return
        void queryClient.invalidateQueries({ queryKey: [...latest.current.invalidate] })
        latest.current.onResync?.(reason)
      },
      onError: (frame) => {
        if (!disposed) latest.current.onError?.(frame)
      },
      onStatus: (next) => {
        if (!disposed) setStatus(next)
      },
    })
    return () => {
      disposed = true
      handle.close()
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- keyed by value on purpose
  }, [active, options.url, options.dialect, subscriptionsKey, invalidateKey, queryClient])

  return { status: active ? status : "closed" }
}

export type { QueryClient, QueryKey }
