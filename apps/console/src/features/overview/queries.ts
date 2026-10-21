import { useSurfaceQuery } from "@keiro-ui/client-core"
import { keiroKeys, useKeiroClient } from "@keiro-ui/client-keiro"
import { useKirokuCheckpoints, useKirokuMetrics } from "@keiro-ui/client-kiroku"
import { pgmqKeys, usePgmqClient } from "@keiro-ui/client-pgmq"
import { useShibuyaHealth } from "@keiro-ui/client-shibuya"

// One owner call per card (ADR-5): the Overview composes in the browser, nothing aggregates.

/** `/pgmq/metrics` counts every queue's rows, so the Overview polls it no faster than 15 s. */
export function useQueuesCard() {
  const pgmq = usePgmqClient()
  return useSurfaceQuery({
    surface: "pgmq",
    queryKey: pgmqKeys.allMetrics(),
    queryFn: ({ signal }) => pgmq.metrics.all(signal),
    poll: 15_000,
  })
}

export const WORKFLOW_SAMPLE = 500

/** The newest 500 instances; counts carry "+" when a further page exists. */
export function useWorkflowsCard() {
  const keiro = useKeiroClient()
  const filters = { ordering: "created_desc", limit: WORKFLOW_SAMPLE }
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.workflows.list(filters),
    queryFn: ({ signal }) => keiro.workflows.list(filters, signal),
  })
}

/** The projections list's first page (the same cache entry the feed and list use). */
export function useProjectionsCard() {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.projections.status(),
    queryFn: ({ signal }) => keiro.projections.status({}, signal),
  })
}

export const useProcessorsCard = () => useShibuyaHealth("ready")
export { useKirokuCheckpoints as useStoreCard, useKirokuMetrics as useStoreMetrics }

export const TIMER_SAMPLE = 100

export function useTimersCard() {
  const keiro = useKeiroClient()
  const filters = { limit: TIMER_SAMPLE }
  const pending = useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.timers.pending(filters),
    queryFn: ({ signal }) => keiro.timers.pending(filters, signal),
  })
  const stuck = useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.timers.stuck({}),
    queryFn: ({ signal }) => keiro.timers.stuck({}, signal),
  })
  return { pending, stuck }
}
