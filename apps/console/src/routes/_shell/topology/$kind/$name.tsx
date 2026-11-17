import { topologyNodeKey } from "@keiro-ui/client-keiro"
import { createFileRoute, Link } from "@tanstack/react-router"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { AggregateMachineSection } from "@/features/topology/AggregateMachineSection"
import { kindLabel } from "@/features/topology/labels"
import { NodeDetails } from "@/features/topology/NodeDetails"
import { NodeRelations } from "@/features/topology/NodeRelations"
import { useServiceTopology } from "@/features/topology/queries"
import { ReadModelsFed } from "@/features/topology/ReadModelsFed"
import { StaleNotice, TopologyStateView } from "@/features/topology/TopologyStates"
import { links } from "@/lib/links"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/topology/$kind/$name")({
  validateSearch: shellSearchSchema,
  component: TopologyNodePage,
})

const backLink = (
  <Link {...links.topology()} className="underline-offset-2 hover:underline">
    Service topology
  </Link>
)

function TopologyNodePage() {
  const { kind, name } = Route.useParams()
  const topology = useServiceTopology()
  if (topology.status !== "ready") {
    return (
      <>
        <PageHeader title={name} description={backLink} />
        <TopologyStateView state={topology} refetch={topology.refetch} />
      </>
    )
  }
  const { index, document } = topology.topology
  const node = index.node(topologyNodeKey(kind, name))
  if (!node) {
    return (
      <>
        <PageHeader title={name} description={backLink} />
        <div data-testid="topology-no-such-node">
          <EmptyState
            title="No such declaration in the mounted document"
            description={
              <>
                The document for service {document.service} declares no {kindLabel(kind)} named{" "}
                <code className="font-mono text-xs">{name}</code>. It may have been renamed or
                removed in the specification the host mounted.
              </>
            }
            action={
              <Link {...links.topology()} className="text-sm underline-offset-2 hover:underline">
                All declarations
              </Link>
            }
          />
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-normal text-muted-foreground">{kindLabel(node.kind)}</span>{" "}
            {node.name}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            {backLink}
            <span>· service {document.service}</span>
            <span>· context {node.context}</span>
            <span>
              · declared at{" "}
              <code className="font-mono text-xs" data-testid="topology-location">
                {node.member}:{node.line}
              </code>
            </span>
          </span>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        {topology.stale && <StaleNotice error={topology.staleError} refetch={topology.refetch} />}
        <NodeDetails node={node} />
        {node.kind === "aggregate" && <AggregateMachineSection node={node} />}
        <NodeRelations index={index} kind={node.kind} name={node.name} />
        {node.kind === "aggregate" && <ReadModelsFed index={index} node={node} />}
      </div>
    </>
  )
}
