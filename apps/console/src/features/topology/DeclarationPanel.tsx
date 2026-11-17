import { type TopologyIndex, type TopologyNode, workflowDetails } from "@keiro-ui/client-keiro"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@keiro-ui/ui/components/collapsible"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { useProcessManagerTypes } from "@/features/process-managers/queries"
import { links } from "@/lib/links"

import { AggregateMachineSection } from "./AggregateMachineSection"
import {
  declarationForAggregateType,
  declarationForProcessCategory,
  declarationForSubscription,
  declarationForWorkflow,
  sagaAggregateOf,
} from "./joins"
import { kindLabel } from "./labels"
import { useServiceTopology } from "./queries"

/**
 * The declaration a live screen corresponds to: its kind and name, where the specification
 * declares it, and a link to its topology page. `children` adds what the declaration says
 * about the thing on screen (a machine, the declared steps).
 */
export function DeclarationPanel({ node, children }: { node: TopologyNode; children?: ReactNode }) {
  return (
    <section
      aria-label="Declared in specification"
      className="flex flex-col gap-2 rounded-md border p-3"
      data-testid="declaration-panel"
    >
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Declared in specification</span>
        <span>
          <span className="text-muted-foreground">{kindLabel(node.kind)}</span>{" "}
          <Link
            {...links.topologyNode(node.kind, node.name)}
            className="font-medium underline-offset-2 hover:underline"
          >
            {node.name}
          </Link>
        </span>
        <code className="font-mono text-xs text-muted-foreground">
          {node.member}:{node.line}
        </code>
      </p>
      {children}
    </section>
  )
}

function Machine({ node, title }: { node: TopologyNode; title: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-xs underline-offset-2 hover:underline">
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-3">
          <AggregateMachineSection node={node} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Runs `find` against the mounted document. A live screen is silent about the topology unless
 * a document is loaded and one declaration joins: most hosts mount none, and the Service
 * Topology section is where that is explained.
 */
function useDeclaration(find: (index: TopologyIndex) => TopologyNode | undefined) {
  const topology = useServiceTopology()
  if (topology.status !== "ready") return undefined
  const { index } = topology.topology
  const node = find(index)
  return node ? { node, index } : undefined
}

/** On a live aggregate type's page: its declaration, with its machine beside the instances. */
export function AggregateTypeDeclaration({ type }: { type: string }) {
  const found = useDeclaration((index) => declarationForAggregateType(index, type))
  if (!found) return null
  return (
    <DeclarationPanel node={found.node}>
      <Machine node={found.node} title="Show the declared state machine" />
    </DeclarationPanel>
  )
}

/**
 * On a process manager's page: the process declared with this manager's category, and the
 * machine of the saga aggregate it keeps its progress in. The manager's category comes from
 * the host's catalogue, which is read only when a mounted document declares a process: a
 * page without a topology asks the host nothing more than it did before.
 */
export function ProcessManagerDeclaration({ name }: { name: string }) {
  const topology = useServiceTopology()
  if (topology.status !== "ready") return null
  const { index } = topology.topology
  if (index.byKind("process").length === 0) return null
  return <DeclaredProcess name={name} index={index} />
}

function DeclaredProcess({ name, index }: { name: string; index: TopologyIndex }) {
  const types = useProcessManagerTypes()
  const category = types.data?.items.find((item) => item.name === name)?.category
  const node = category === undefined ? undefined : declarationForProcessCategory(index, category)
  if (!node) return null
  const saga = sagaAggregateOf(index, node)
  return (
    <DeclarationPanel node={node}>
      {saga && (
        <>
          <p className="text-xs text-muted-foreground">
            It keeps its progress in the saga aggregate{" "}
            <Link
              {...links.topologyNode(saga.kind, saga.name)}
              className="font-medium underline-offset-2 hover:underline"
            >
              {saga.name}
            </Link>
            .
          </p>
          <Machine node={saga} title={`Show the declared state machine of ${saga.name}`} />
        </>
      )}
    </DeclarationPanel>
  )
}

/** On a workflow's screens: its declaration and the steps the specification lists, in order. */
export function WorkflowDeclaration({ workflowName }: { workflowName: string | undefined }) {
  const found = useDeclaration((index) =>
    workflowName === undefined ? undefined : declarationForWorkflow(index, workflowName),
  )
  if (!found) return null
  const steps = workflowDetails(found.node)?.steps ?? []
  return (
    <DeclarationPanel node={found.node}>
      {steps.length > 0 && (
        <ol aria-label="Declared steps" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {steps.map((step, i) => (
            // Declared order is a step's identity; labels may repeat.
            // oxlint-disable-next-line react/no-array-index-key
            <li key={i}>
              <span className="text-muted-foreground">
                {i + 1}. {step.form}
              </span>
              {step.label !== undefined && <span className="font-mono"> {step.label}</span>}
            </li>
          ))}
        </ol>
      )}
    </DeclarationPanel>
  )
}

/**
 * On a projection group's page: the projection owner declared for each subscription the host
 * reports as feeding the group. Group names are not matched; keiro does not guarantee them.
 */
export function SubscriptionDeclarations({ subscriptions }: { subscriptions: readonly string[] }) {
  const topology = useServiceTopology()
  if (topology.status !== "ready") return null
  const { index } = topology.topology
  const owners = subscriptions.flatMap((subscription) => {
    const node = declarationForSubscription(index, subscription)
    return node ? [{ subscription, node }] : []
  })
  if (owners.length === 0) return null
  return (
    <>
      {owners.map(({ subscription, node }) => (
        <DeclarationPanel key={subscription} node={node}>
          <p className="text-xs text-muted-foreground">
            Declared for subscription <code className="font-mono">{subscription}</code>.
          </p>
        </DeclarationPanel>
      ))}
    </>
  )
}
