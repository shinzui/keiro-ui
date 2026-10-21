import { useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"

/**
 * The liveness contract (ADR-3's user-visible half): paused means polling stops and the
 * screen is explicitly stale. docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md
 * ships the same shape from @keiro-ui/client-core; this module then becomes a re-export and
 * consumers keep importing from "@/shell/liveness".
 */
export interface LivenessController {
  paused: boolean
  pausedSince: Date | null
  pause(): void
  /** Also refreshes everything immediately. */
  resume(): void
  /** Invalidates every surface's query-key prefix (["kiroku"], ["pgmq"], ...). */
  refreshAll(): Promise<void>
}

const SURFACE_KEY_PREFIXES = [["kiroku"], ["shibuya"], ["pgmq"], ["keiro"]] as const

const LivenessContext = createContext<LivenessController | null>(null)

export function LivenessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [pausedSince, setPausedSince] = useState<Date | null>(null)

  const refreshAll = useCallback(async () => {
    await Promise.all(
      SURFACE_KEY_PREFIXES.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
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

  return <LivenessContext.Provider value={value}>{children}</LivenessContext.Provider>
}

export function useLiveness(): LivenessController {
  const value = useContext(LivenessContext)
  if (!value) throw new Error("useLiveness requires <LivenessProvider>")
  return value
}

/** `false` while paused, `defaultMs` otherwise; for TanStack Query's `refetchInterval`. */
export function refetchIntervalFor(paused: boolean, defaultMs: number): number | false {
  return paused ? false : defaultMs
}
