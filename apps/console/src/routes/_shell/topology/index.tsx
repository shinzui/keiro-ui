import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { Agreement } from "@/features/topology/Agreement"
import { Inventory } from "@/features/topology/Inventory"
import { useServiceTopology } from "@/features/topology/queries"
import { topologySearch } from "@/features/topology/search"
import { TopologyHeader } from "@/features/topology/TopologyHeader"
import { StaleNotice, TopologyStateView } from "@/features/topology/TopologyStates"

export const Route = createFileRoute("/_shell/topology/")({
  validateSearch: topologySearch,
  component: TopologyPage,
})

function TopologyPage() {
  const { q, kind } = Route.useSearch()
  const topology = useServiceTopology()
  return (
    <>
      <PageHeader
        title="Service topology"
        description="What the service's specification declares and how its declarations relate, as mounted by this keiro host."
      />
      {topology.status === "ready" ? (
        <div className="flex flex-col gap-6 p-6">
          {topology.stale && <StaleNotice error={topology.staleError} refetch={topology.refetch} />}
          <TopologyHeader topology={topology.topology} />
          <Agreement index={topology.topology.index} />
          <Inventory index={topology.topology.index} q={q} kind={kind} />
        </div>
      ) : (
        <TopologyStateView state={topology} refetch={topology.refetch} />
      )}
    </>
  )
}
