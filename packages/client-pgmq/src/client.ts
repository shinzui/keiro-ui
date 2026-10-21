import { createHttpClient, type HttpClient, type Query } from "@keiro-ui/client-core"
import type { z } from "zod"

import type { paths } from "./generated/schema"
import {
  ArchivedMessage,
  ArchivedMessagePage,
  type HealthResult,
  Liveness,
  Message,
  MessagePage,
  NotifyInsertThrottle,
  type PgmqMessageCursor,
  Queue,
  QueueMetrics,
  Readiness,
  RoutingMatch,
  ServiceDescriptor,
  TopicBinding,
} from "./schemas"

/** Every route of the served document; the generated types keep this list honest. */
export type PgmqPath = keyof paths

/** The server silently caps at 500; asking for more is a screen bug. */
function checkLimit(limit: number | undefined): number | undefined {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
    throw new RangeError(`pgmq limit must be 1–500, got ${limit}`)
  }
  return limit
}

const seg = encodeURIComponent

export function createPgmqClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const http: HttpClient = createHttpClient({
    surface: "pgmq",
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
    path: PgmqPath,
    signal?: AbortSignal,
  ): Promise<HealthResult<z.output<S>>> => {
    let status = 200
    const probe = createHttpClient({
      surface: "pgmq",
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
    service: (signal?: AbortSignal) => get(ServiceDescriptor, "/", undefined, signal),
    /** The raw OpenAPI document the server serves. */
    openapi: (signal?: AbortSignal) => http.get<unknown>("/openapi.json", { signal }),
    queues: {
      list: (signal?: AbortSignal) => get(Queue.array(), "/queues", undefined, signal),
      get: (name: string, signal?: AbortSignal) =>
        get(Queue, `/queues/${seg(name)}`, undefined, signal),
      metrics: (name: string, signal?: AbortSignal) =>
        get(QueueMetrics, `/queues/${seg(name)}/metrics`, undefined, signal),
    },
    metrics: {
      all: (signal?: AbortSignal) => get(QueueMetrics.array(), "/metrics", undefined, signal),
    },
    messages: {
      page: (
        queue: string,
        params: { from?: PgmqMessageCursor | bigint; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        get(
          MessagePage,
          `/queues/${seg(queue)}/messages`,
          { from: params.from, limit: checkLimit(params.limit) },
          signal,
        ),
      /** `msgId` is serialized as its exact decimal digits. */
      get: (queue: string, msgId: bigint, signal?: AbortSignal) =>
        get(Message, `/queues/${seg(queue)}/messages/${msgId}`, undefined, signal),
    },
    archive: {
      page: (
        queue: string,
        params: { from?: PgmqMessageCursor | bigint; limit?: number } = {},
        signal?: AbortSignal,
      ) =>
        get(
          ArchivedMessagePage,
          `/queues/${seg(queue)}/archive`,
          { from: params.from, limit: checkLimit(params.limit) },
          signal,
        ),
      get: (queue: string, msgId: bigint, signal?: AbortSignal) =>
        get(ArchivedMessage, `/queues/${seg(queue)}/archive/${msgId}`, undefined, signal),
    },
    bindings: {
      forQueue: (queue: string, signal?: AbortSignal) =>
        get(TopicBinding.array(), `/queues/${seg(queue)}/bindings`, undefined, signal),
      all: (signal?: AbortSignal) => get(TopicBinding.array(), "/bindings", undefined, signal),
    },
    routing: {
      test: (routingKey: string, signal?: AbortSignal) =>
        get(RoutingMatch.array(), "/routing/test", { routing_key: routingKey }, signal),
    },
    notify: {
      throttles: (signal?: AbortSignal) =>
        get(NotifyInsertThrottle.array(), "/notify/throttles", undefined, signal),
    },
    health: {
      live: (signal?: AbortSignal) => health(Liveness, "/health/live", signal),
      ready: (signal?: AbortSignal) => health(Readiness, "/health/ready", signal),
    },
  }
}

export type PgmqClient = ReturnType<typeof createPgmqClient>
