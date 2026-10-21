import { createHttpClient, type HttpClient, type Query } from "@keiro-ui/client-core"
import type { z } from "zod"

import {
  Capabilities,
  CategoryPage,
  CheckpointInventory,
  CombinedHealth,
  DeadLetterPage,
  EventPage,
  type HealthResult,
  KirokuEvent,
  type KirokuNameCursor,
  type KirokuPositionCursor,
  LiveSubscription,
  Liveness,
  MetricsSnapshot,
  Readiness,
  StreamInfo,
  StreamPage,
  SubscriptionMetrics,
} from "./schemas"

/** Browse and dead-letter limits are 1–1000; a screen bug surfaces as a RangeError. */
function checkLimit(limit: number | undefined): number | undefined {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) {
    throw new RangeError(`kiroku limit must be 1–1000, got ${limit}`)
  }
  return limit
}

const seg = encodeURIComponent

export function createKirokuClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const http: HttpClient = createHttpClient({
    surface: "kiroku",
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  })

  const get = async <S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    query?: Query,
    signal?: AbortSignal,
  ): Promise<z.output<S>> => schema.parse(await http.get(path, { query, signal }))

  const health = async <S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    signal?: AbortSignal,
  ): Promise<HealthResult<z.output<S>>> => {
    let status = 200
    const fetchWithStatus: typeof fetch = async (input, init) => {
      const response = await (options.fetch ?? fetch)(input, init)
      status = response.status
      return response
    }
    const probe = createHttpClient({
      surface: "kiroku",
      baseUrl: options.baseUrl,
      fetch: fetchWithStatus,
    })
    const body = await probe.get(path, { okStatuses: [200, 503], signal })
    return { status, body: schema.parse(body) }
  }

  return {
    http,
    capabilities: (signal?: AbortSignal) => get(Capabilities, "/capabilities", undefined, signal),
    metrics: {
      all: (signal?: AbortSignal) => get(MetricsSnapshot, "/metrics", undefined, signal),
      subscription: (name: string, signal?: AbortSignal) =>
        get(SubscriptionMetrics, `/metrics/${seg(name)}`, undefined, signal),
    },
    health: {
      live: (signal?: AbortSignal) => health(Liveness, "/health/live", signal),
      ready: (signal?: AbortSignal) => health(Readiness, "/health/ready", signal),
      combined: (signal?: AbortSignal) => health(CombinedHealth, "/health", signal),
    },
    subscriptions: {
      live: (signal?: AbortSignal) =>
        get(LiveSubscription.array(), "/subscriptions", undefined, signal),
      liveOne: (name: string, signal?: AbortSignal) =>
        get(LiveSubscription.array(), `/subscriptions/${seg(name)}`, undefined, signal),
    },
    checkpoints: {
      inventory: (signal?: AbortSignal) =>
        get(CheckpointInventory, "/subscription-checkpoints", undefined, signal),
    },
    deadLetters: {
      page: (
        subscription: string,
        params: { member?: number; from?: KirokuNameCursor; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        get(
          DeadLetterPage,
          `/subscriptions/${seg(subscription)}/dead-letters`,
          { member: params.member, from: params.from, limit: checkLimit(params.limit) },
          signal,
        ),
    },
    streams: {
      page: (
        params: {
          category?: string
          prefix?: string
          from?: KirokuNameCursor
          limit?: number
        } = {},
        signal?: AbortSignal,
      ) =>
        get(
          StreamPage,
          "/streams",
          {
            category: params.category,
            prefix: params.prefix,
            from: params.from,
            limit: checkLimit(params.limit),
          },
          signal,
        ),
      get: (name: string, signal?: AbortSignal) =>
        get(StreamInfo, `/streams/${seg(name)}`, undefined, signal),
      events: (
        name: string,
        params: {
          from?: KirokuPositionCursor | bigint
          limit?: number
          direction?: "forward" | "backward"
        } = {},
        signal?: AbortSignal,
      ) =>
        get(
          EventPage,
          `/streams/${seg(name)}/events`,
          { from: params.from, limit: checkLimit(params.limit), direction: params.direction },
          signal,
        ),
    },
    categories: {
      page: (params: { from?: KirokuNameCursor; limit?: number } = {}, signal?: AbortSignal) =>
        get(
          CategoryPage,
          "/categories",
          { from: params.from, limit: checkLimit(params.limit) },
          signal,
        ),
      /** Forward only: the server rejects `direction=backward` on category reads. */
      events: (
        name: string,
        params: { from?: KirokuPositionCursor | bigint; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        get(
          EventPage,
          `/categories/${seg(name)}/events`,
          { from: params.from, limit: checkLimit(params.limit) },
          signal,
        ),
    },
    events: {
      all: (
        params: {
          from?: KirokuPositionCursor | bigint
          limit?: number
          direction?: "forward" | "backward"
        } = {},
        signal?: AbortSignal,
      ) =>
        get(
          EventPage,
          "/events",
          { from: params.from, limit: checkLimit(params.limit), direction: params.direction },
          signal,
        ),
      get: (id: string, signal?: AbortSignal) =>
        get(KirokuEvent, `/events/${seg(id)}`, undefined, signal),
    },
  }
}

export type KirokuClient = ReturnType<typeof createKirokuClient>
