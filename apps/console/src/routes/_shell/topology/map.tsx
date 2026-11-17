import { createFileRoute, Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { MapPage } from "@/features/topology/graph/MapPage"
import { useServiceTopology } from "@/features/topology/queries"
import { topologyMapSearch } from "@/features/topology/search"
import { StaleNotice, TopologyStateView } from "@/features/topology/TopologyStates"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/topology/map")({
  validateSearch: topologyMapSearch,
  component: TopologyMapPage,
})

function TopologyMapPage() {
  const { groups, focus, depth } = Route.useSearch()
  const topology = useServiceTopology()
  return (
    <>
      <PageHeader
        title="Service map"
        description={
          <>
            The declarations of the mounted specification, drawn along their relations. The{" "}
            <Link {...links.topology()} className="underline-offset-2 hover:underline">
              declarations list
            </Link>{" "}
            and each declaration's page carry the same information as text.
          </>
        }
      />
      {topology.status === "ready" ? (
        <div className="flex flex-col gap-4 p-6">
          {topology.stale && <StaleNotice error={topology.staleError} refetch={topology.refetch} />}
          <p className="text-sm text-muted-foreground">
            Service{" "}
            <span className="font-medium text-foreground" data-testid="topology-service">
              {topology.topology.document.service}
            </span>
            . This describes the committed specification the host mounted, not the running binary.
          </p>
          <MapPage
            index={topology.topology.index}
            groups={groups}
            focus={focus}
            depth={depth === 2 ? 2 : depth === 1 ? 1 : undefined}
          />
        </div>
      ) : (
        <TopologyStateView state={topology} refetch={topology.refetch} />
      )}
    </>
  )
}
