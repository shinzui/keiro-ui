import { aggregateDetails, type TopologyNode } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { cn } from "cn"
import { useState } from "react"

import { DiagramBoundary } from "./graph/DiagramBoundary"
import { MachineDiagram, transitionId } from "./graph/MachineDiagram"

/**
 * An aggregate's state machine as the specification declares it: the single place a machine
 * is rendered. The node is the only required prop, so other screens can reuse it as is.
 * States are in declared order; transitions are in the document's order (source state, then
 * edge index). The edge index is local to its source state and changes when transitions are
 * reordered, so it is shown and never used as an identity.
 */
export function AggregateMachineSection({ node }: { node: TopologyNode }) {
  const [selected, setSelected] = useState<string>()
  const details = aggregateDetails(node)
  const machine = details?.machine
  const heading = <h2 className="text-sm font-semibold">State machine</h2>
  if (!machine) {
    return (
      <section aria-label="State machine" className="flex flex-col gap-2">
        {heading}
        <p className="text-sm text-muted-foreground" data-testid="machine-absent">
          {node.details.machine === undefined
            ? "This document carries no state machine for this aggregate. It was produced by a keiro-dsl version that did not export machines; regenerating the committed document adds them."
            : "This aggregate's machine is not in a shape this console understands, so it is not drawn. Its raw value is in Details."}
        </p>
      </section>
    )
  }
  const hasReplayOnly = machine.edges.some((edge) => edge.mode === "ReplayOnly")
  return (
    <section aria-label="State machine" className="flex flex-col gap-3">
      {heading}
      <p className="text-sm">
        Ownership <code className="font-mono text-xs">{machine.ownership}</code>
      </p>
      {machine.ownership === "legacy-hole" && (
        <p
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="machine-legacy-hole"
        >
          These transitions are declared in the specification, but this aggregate's transducer is
          hand-written and is not proven to match them.
        </p>
      )}
      <DiagramBoundary
        key={`${node.name}:${machine.edges.length}`}
        testId="machine-diagram-failed"
        fallback="The diagram could not be drawn. The states and transitions below are complete."
      >
        <MachineDiagram
          machine={machine}
          selected={selected}
          onSelect={(id) => setSelected((current) => (current === id ? undefined : id))}
        />
      </DiagramBoundary>
      <ol aria-label="States" className="flex flex-wrap gap-1.5">
        {machine.states.map((state) => (
          <li key={state.name}>
            <Badge variant="outline">
              {state.name}
              {state.name === machine.initial && (
                <span className="text-muted-foreground"> · initial</span>
              )}
              {state.terminal && <span className="text-muted-foreground"> · terminal</span>}
            </Badge>
          </li>
        ))}
      </ol>
      <Table aria-label="Transitions">
        <TableHeader>
          <TableHead isRowHeader>Source</TableHead>
          <TableHead>Command</TableHead>
          <TableHead>Events</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Edge index</TableHead>
        </TableHeader>
        <TableBody
          renderEmptyState={() => (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No transitions declared.
            </p>
          )}
        >
          {machine.edges.map((edge) => (
            <TableRow
              key={transitionId(edge)}
              id={transitionId(edge)}
              data-transition-row={transitionId(edge)}
              data-transition-selected={selected === transitionId(edge)}
              className={cn("cursor-pointer", selected === transitionId(edge) && "bg-accent")}
              onAction={() =>
                setSelected((current) =>
                  current === transitionId(edge) ? undefined : transitionId(edge),
                )
              }
            >
              <TableCell className="font-medium">{edge.source}</TableCell>
              <TableCell className="font-mono text-xs">{edge.command}</TableCell>
              <TableCell className="font-mono text-xs">
                {edge.events.length === 0 ? (
                  <span className="text-muted-foreground">none</span>
                ) : (
                  edge.events.join(", ")
                )}
              </TableCell>
              <TableCell>{edge.target}</TableCell>
              <TableCell>
                {edge.mode === "ReplayOnly" ? (
                  <Badge variant="secondary">replay only</Badge>
                ) : (
                  <span className="text-muted-foreground">live</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{edge.edgeIndex}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasReplayOnly && (
        <p className="text-xs text-muted-foreground" data-testid="machine-replay-only">
          A replay-only transition serves no new commands. It exists only so events recorded in the
          past still replay.
        </p>
      )}
    </section>
  )
}
