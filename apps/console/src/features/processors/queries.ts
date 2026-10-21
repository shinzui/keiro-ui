import { queryKeys, useSurfaceQuery } from "@keiro-ui/client-core"
import {
  type ProcessorMap,
  type ProcessorMetrics,
  type TerminalInfo,
  useShibuyaClient,
  useShibuyaControlStatus,
  useShibuyaHealth,
  useShibuyaProcessors,
  useShibuyaProcessorsFeed,
} from "@keiro-ui/client-shibuya"
import { useMemo, useState } from "react"

// Every shibuya call of the Processors screens goes through this file.

export interface ProcessorRow {
  id: string
  metrics: ProcessorMetrics
  /** Set once a `terminal` frame said the processor left the registry. */
  terminal?: TerminalInfo
  /** When the metrics were received (feed frame or poll), for age extrapolation. */
  receivedAt: number
}

/**
 * Every processor: the `/metrics` poll (2 s) with the feed writing into the same entry.
 * A processor that went terminal keeps its last-known metrics so it can be listed in the
 * Terminal group after the poll stops returning it.
 */
export function useProcessors() {
  const processors = useShibuyaProcessors()
  const feed = useShibuyaProcessorsFeed()
  // Last-known metrics per processor, merged whenever a new map arrives (adjusted during render).
  const [seen, setSeen] = useState<{ from?: ProcessorMap; all: Record<string, ProcessorMetrics> }>({
    all: {},
  })
  if (processors.data && processors.data !== seen.from) {
    setSeen({ from: processors.data, all: { ...seen.all, ...processors.data } })
  }
  const lastSeen = seen.all
  const rows = useMemo<ProcessorRow[]>(() => {
    const polledAt = processors.dataUpdatedAt
    const map = processors.data ?? {}
    const ids = new Set([...Object.keys(map), ...Object.keys(feed.terminal)])
    return [...ids].toSorted().flatMap((id) => {
      const metrics = map[id] ?? lastSeen[id]
      if (!metrics) return []
      return [
        {
          id,
          metrics,
          terminal: feed.terminal[id],
          receivedAt: Math.max(feed.receivedAt[id] ?? 0, polledAt),
        },
      ]
    })
  }, [processors.data, processors.dataUpdatedAt, feed.terminal, feed.receivedAt, lastSeen])
  return { rows, feedStatus: feed.status, isPending: processors.isPending, error: processors.error }
}

/**
 * The processor's 404, read only when the map does not list it: `GET /metrics/<id>` answers
 * with shibuya's flat `processor_not_found` error.
 */
export function useMissingProcessor(id: string, missing: boolean) {
  const shibuya = useShibuyaClient()
  return useSurfaceQuery({
    surface: "shibuya",
    queryKey: queryKeys.shibuya("processor-probe", id),
    queryFn: ({ signal }) => shibuya.metrics.processor(id, signal),
    enabled: missing,
    poll: false,
  })
}

export const useReadiness = () => useShibuyaHealth("ready")
export const useControlStatus = useShibuyaControlStatus
