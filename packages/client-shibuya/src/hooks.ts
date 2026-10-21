import {
  type FeedStatus,
  useFeedSubscription,
  useSurfaceQuery,
  webSocketUrlFor,
} from "@keiro-ui/client-core"
import { createContext, createElement, type ReactNode, useContext, useMemo, useState } from "react"

import type { ShibuyaClient } from "./client"
import {
  ShibuyaSnapshotFrame,
  ShibuyaTerminalFrame,
  ShibuyaUpdateFrame,
  shibuyaDialect,
} from "./feeds"
import { shibuyaKeys } from "./query-keys"
import type { ProcessorMap } from "./schemas"

const ShibuyaClientContext = createContext<ShibuyaClient | null>(null)

export function ShibuyaClientProvider(props: { client: ShibuyaClient; children: ReactNode }) {
  return createElement(ShibuyaClientContext.Provider, { value: props.client }, props.children)
}

export function useShibuyaClient(): ShibuyaClient {
  const client = useContext(ShibuyaClientContext)
  if (!client) throw new Error("useShibuyaClient requires <ShibuyaClientProvider>")
  return client
}

const METRICS_MS = 2_000
const STATE_MS = 5_000

export function useShibuyaProcessors() {
  const client = useShibuyaClient()
  return useSurfaceQuery({
    surface: "shibuya",
    queryKey: shibuyaKeys.processors(),
    queryFn: ({ signal }) => client.metrics.all(signal),
    poll: METRICS_MS,
  })
}

export function useShibuyaProcessor(id: string) {
  const client = useShibuyaClient()
  return useSurfaceQuery({
    surface: "shibuya",
    queryKey: shibuyaKeys.processor(id),
    queryFn: ({ signal }) => client.metrics.processor(id, signal),
    poll: METRICS_MS,
  })
}

/** `{status, body}` for 200 and 503 alike. */
export function useShibuyaHealth<K extends "live" | "ready" | "combined" = "ready">(kind?: K) {
  const client = useShibuyaClient()
  const which = (kind ?? "ready") as K
  type Result = Awaited<ReturnType<ShibuyaClient["health"][K]>>
  return useSurfaceQuery<Result>({
    surface: "shibuya",
    queryKey: shibuyaKeys.health(which),
    queryFn: ({ signal }) => client.health[which](signal) as Promise<Result>,
    poll: STATE_MS,
  })
}

export function useShibuyaControlStatus() {
  const client = useShibuyaClient()
  return useSurfaceQuery({
    surface: "shibuya",
    queryKey: shibuyaKeys.control(),
    queryFn: ({ signal }) => client.control.status(signal),
    poll: false,
  })
}

export interface TerminalInfo {
  status: "stopped" | "failed"
  error?: string
  messageId: string | null
}

/**
 * Writes the snapshot into `useShibuyaProcessors()`'s entry, merges each update by processor
 * id, and applies `terminal` frames to that processor's state; `queue_overflow` and reconnects
 * re-read `/metrics`. `receivedAt` lets screens extrapolate in-flight ages between frames.
 */
export function useShibuyaProcessorsFeed(
  options: { enabled?: boolean; processors?: string[] } = {},
): {
  status: FeedStatus
  terminal: Record<string, TerminalInfo>
  receivedAt: Record<string, number>
} {
  const client = useShibuyaClient()
  const [terminal, setTerminal] = useState<Record<string, TerminalInfo>>({})
  const [receivedAt, setReceivedAt] = useState<Record<string, number>>({})
  const processors = options.processors
  const subscriptions = useMemo(() => [processors ? { processors } : undefined], [processors])
  const { status } = useFeedSubscription({
    enabled: options.enabled,
    url: webSocketUrlFor(client.http.baseUrl, "/ws"),
    dialect: shibuyaDialect,
    subscriptions,
    invalidate: shibuyaKeys.processors(),
    applyToCache: (cache, frame, kind) => {
      const now = Date.now()
      const key = shibuyaKeys.processors()
      if (kind === "snapshot") {
        const parsed = ShibuyaSnapshotFrame.safeParse(frame)
        if (!parsed.success) return
        cache.setQueryData(key, parsed.data.metrics)
        setReceivedAt(Object.fromEntries(Object.keys(parsed.data.metrics).map((id) => [id, now])))
      } else if (kind === "delta") {
        const parsed = ShibuyaUpdateFrame.safeParse(frame)
        if (!parsed.success) return
        cache.setQueryData<ProcessorMap>(key, (current) => ({
          ...current,
          [parsed.data.processor]: parsed.data.metrics,
        }))
        setReceivedAt((prev) => ({ ...prev, [parsed.data.processor]: now }))
      } else {
        const parsed = ShibuyaTerminalFrame.safeParse(frame)
        if (!parsed.success) return
        const data = parsed.data
        const info: TerminalInfo =
          data.status === "failed"
            ? { status: "failed", error: data.error, messageId: data.messageId }
            : { status: "stopped", messageId: null }
        setTerminal((prev) => ({ ...prev, [data.processor]: info }))
        cache.setQueryData<ProcessorMap>(key, (current) => {
          const existing = current?.[data.processor]
          if (!current || !existing) return current
          const state =
            data.status === "failed"
              ? {
                  status: "failed" as const,
                  error: data.error,
                  timestamp: new Date(now).toISOString(),
                }
              : { status: "stopped" as const }
          return { ...current, [data.processor]: { ...existing, state } }
        })
      }
    },
  })
  return { status, terminal, receivedAt }
}
