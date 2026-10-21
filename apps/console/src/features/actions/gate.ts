import { useSurfaceHealth } from "@/shell/health"

export const MUTATIONS_DISABLED_REASON =
  "Mutations are disabled on this keiro host (start keiro-ops-http with --enable-mutations)"
export const DRIFT_REASON = "keiro refuses mutations while the live schema drifts from the binary"

/**
 * Whether keiro will accept a mutation, from its `/health` body (the shell's probe, which the
 * status bar already polls): `mutations_enabled`, and refused under schema drift.
 */
export function useKeiroMutationsGate(): { enabled: boolean; reason?: string; drift?: string[] } {
  const probe = useSurfaceHealth("keiro")
  const body = probe.body as
    | { status?: string; schema_drift?: string[]; mutations_enabled?: boolean }
    | undefined
  if (!body || body.mutations_enabled === undefined)
    return { enabled: false, reason: "keiro's mutation gate is not known yet (no health answer)" }
  if (body.status === "schema_drift")
    return { enabled: false, reason: DRIFT_REASON, drift: body.schema_drift ?? [] }
  if (!body.mutations_enabled) return { enabled: false, reason: MUTATIONS_DISABLED_REASON }
  return { enabled: true }
}
