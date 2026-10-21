import { createHttpClient, type HttpClient } from "@keiro-ui/client-core"
import type { z } from "zod"

import {
  CombinedHealth,
  ControlStatus,
  type HealthResult,
  Liveness,
  ProcessorMap,
  ProcessorMetrics,
  ReadinessStatus,
} from "./schemas"

export function createShibuyaClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const http: HttpClient = createHttpClient({
    surface: "shibuya",
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  })

  const get = async <S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    signal?: AbortSignal,
  ): Promise<z.output<S>> => schema.parse(await http.get(path, { signal }))

  const health = async <S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    signal?: AbortSignal,
  ): Promise<HealthResult<z.output<S>>> => {
    let status = 200
    const probe = createHttpClient({
      surface: "shibuya",
      baseUrl: options.baseUrl,
      fetch: async (input, init) => {
        const response = await (options.fetch ?? fetch)(input, init)
        status = response.status
        return response
      },
    })
    return { status, body: schema.parse(await probe.get(path, { okStatuses: [200, 503], signal })) }
  }

  return {
    http,
    metrics: {
      all: (signal?: AbortSignal) => get(ProcessorMap, "/metrics", signal),
      /**
       * One processor. A processor named `prometheus` is shadowed by `/metrics/prometheus`
       * (the text exposition), so read it from `metrics.all()` instead.
       */
      processor: (id: string, signal?: AbortSignal) =>
        get(ProcessorMetrics, `/metrics/${encodeURIComponent(id)}`, signal),
    },
    health: {
      live: (signal?: AbortSignal) => health(Liveness, "/health/live", signal),
      ready: (signal?: AbortSignal) => health(ReadinessStatus, "/health/ready", signal),
      combined: (signal?: AbortSignal) => health(CombinedHealth, "/health", signal),
    },
    control: {
      /** Whether pause/resume are enabled on this host (off by default). Actions arrive with plan 19. */
      status: (signal?: AbortSignal) => get(ControlStatus, "/control", signal),
    },
  }
}

export type ShibuyaClient = ReturnType<typeof createShibuyaClient>
