import { useQuery } from "@tanstack/react-query"

import { type Surface, useSurfaceBaseUrl } from "@/settings/connection-profiles"

export type HealthStatus = "up" | "degraded" | "down" | "unknown"

export interface HealthProbe {
  surface: Surface
  status: HealthStatus
  httpStatus?: number
  latencyMs?: number
  checkedAt: string
  url?: string
  body?: unknown
}

/** keiro-ops-http has no /health/live; its /health answers 503 under schema drift. */
export const healthProbePaths: Record<Surface, string> = {
  kiroku: "/health/live",
  shibuya: "/health/live",
  pgmq: "/health/live",
  keiro: "/health",
}

const PROBE_TIMEOUT_MS = 5000

export function healthProbeUrl(surface: Surface, baseUrl: string): string {
  return `${baseUrl}${healthProbePaths[surface]}`
}

/**
 * One fetch with a 5 s timeout: 200 is `up`; a keiro 503 whose body says
 * `"status":"schema_drift"` is `degraded`; any other response is `down` with its status; a
 * network failure is `down` without one. The JSON body is kept (keiro's
 * `mutations_enabled`, `schema_drift`).
 */
export async function probeHealth(
  surface: Surface,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<HealthProbe> {
  const url = healthProbeUrl(surface, baseUrl)
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  const started = performance.now()
  try {
    const response = await fetch(url, { signal: combined, headers: { accept: "application/json" } })
    const latencyMs = Math.round(performance.now() - started)
    const text = await response.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    const checkedAt = new Date().toISOString()
    const base = { surface, httpStatus: response.status, latencyMs, checkedAt, url, body }
    if (response.status === 200) return { ...base, status: "up" }
    // keiro answers 503 for schema drift and when its inspection slots are all in use; both
    // mean the server is up but not fully serving, so neither is "down".
    const keiroBody =
      surface === "keiro" && response.status === 503 && typeof body === "object" && body !== null
        ? (body as { status?: unknown; error?: { code?: unknown } })
        : undefined
    const degraded =
      keiroBody !== undefined &&
      (keiroBody.status === "schema_drift" || keiroBody.error?.code === "inspection_busy")
    return { ...base, status: degraded ? "degraded" : "down" }
  } catch {
    return { surface, status: "down", checkedAt: new Date().toISOString(), url }
  }
}

/** Polls every 30 s, also while live updates are paused (the probe describes connectivity). */
export function useSurfaceHealth(surface: Surface): HealthProbe {
  const baseUrl = useSurfaceBaseUrl(surface)
  const query = useQuery({
    enabled: !!baseUrl,
    queryKey: ["shell", "health", surface, baseUrl],
    queryFn: ({ signal }) => probeHealth(surface, baseUrl, signal),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  return (
    query.data ?? {
      surface,
      status: "unknown",
      checkedAt: new Date(0).toISOString(),
      url: baseUrl ? healthProbeUrl(surface, baseUrl) : undefined,
    }
  )
}
