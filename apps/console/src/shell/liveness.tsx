// The liveness contract is owned by @keiro-ui/client-core (its useSurfaceQuery applies the
// pause itself); the shell re-exports it so consumers keep importing from "@/shell/liveness".
// See docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md.
export { type LivenessController, LivenessProvider, useLiveness } from "@keiro-ui/client-core"

/** `false` while paused, `defaultMs` otherwise; for queries that do not use useSurfaceQuery. */
export function refetchIntervalFor(paused: boolean, defaultMs: number): number | false {
  return paused ? false : defaultMs
}
