import type { AggregateMachine, AggregateMachineEdge } from "@keiro-ui/client-keiro"
import { cn } from "cn"
import { useMemo } from "react"

import { BoxText, GraphCanvas } from "./GraphCanvas"
import { type LayoutEdge, layoutGraph, type LayoutNode, LINE_HEIGHT, NODE_PAD_Y } from "./layout"

/** A transition's identity within one machine, as the transitions table uses it. */
export const transitionId = (edge: Pick<AggregateMachineEdge, "source" | "edgeIndex">) =>
  `${edge.source}#${edge.edgeIndex}`

const LABEL_PAD_Y = 3

function stateMarker(machine: AggregateMachine, name: string, terminal: boolean): string {
  return [name === machine.initial ? "initial" : "", terminal ? "terminal" : ""]
    .filter(Boolean)
    .join(" · ")
}

const commandLine = (edge: AggregateMachineEdge) =>
  edge.mode === "ReplayOnly" ? `${edge.command} (replay only)` : edge.command
const eventsLine = (edge: AggregateMachineEdge) =>
  edge.events.length === 0 ? "no events" : edge.events.join(", ")

/** The machine as a graph: one node per state, one edge per (source, target) pair. */
export function machineGraph(machine: AggregateMachine) {
  const nodes: LayoutNode[] = machine.states.map((state) => {
    const marker = stateMarker(machine, state.name, state.terminal)
    return { id: state.name, lines: marker ? [state.name, marker] : [state.name] }
  })
  // Transitions sharing a source and target share one drawn edge with stacked labels.
  const bundles = new Map<string, AggregateMachineEdge[]>()
  for (const edge of machine.edges) {
    const key = `${edge.source}\u0000${edge.target}`
    bundles.set(key, [...(bundles.get(key) ?? []), edge])
  }
  const edges: (LayoutEdge & { transitions: AggregateMachineEdge[] })[] = [...bundles.values()].map(
    (transitions) => ({
      id: transitions.map(transitionId).join("|"),
      source: transitions[0]!.source,
      target: transitions[0]!.target,
      lines: transitions.flatMap((edge) => [commandLine(edge), eventsLine(edge)]),
      transitions,
    }),
  )
  return { nodes, edges }
}

/**
 * An aggregate's state machine drawn left to right. Every distinction is also text: the
 * initial and terminal states carry a word under their name, and a replay-only transition
 * says so beside its command. The transitions table below it carries the same information.
 */
export function MachineDiagram({
  machine,
  selected,
  onSelect,
}: {
  machine: AggregateMachine
  /** A transition id (`transitionId`). */
  selected?: string
  onSelect?(id: string): void
}) {
  const graph = useMemo(() => machineGraph(machine), [machine])
  const layout = useMemo(() => layoutGraph(graph.nodes, graph.edges, "LR"), [graph])
  const bundleOf = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph])
  const terminal = useMemo(
    () => new Set(machine.states.filter((state) => state.terminal).map((state) => state.name)),
    [machine],
  )
  const dashed = useMemo(
    () =>
      new Set(
        graph.edges
          .filter((edge) => edge.transitions.every((t) => t.mode === "ReplayOnly"))
          .map((edge) => edge.id),
      ),
    [graph],
  )
  const emphasis = useMemo(() => {
    if (!selected) return undefined
    const bundle = graph.edges.find((edge) =>
      edge.transitions.some((t) => transitionId(t) === selected),
    )
    return bundle ? new Set([bundle.id, bundle.source, bundle.target]) : undefined
  }, [graph, selected])
  const hasReplayOnly = machine.edges.some((edge) => edge.mode === "ReplayOnly")

  return (
    <figure className="flex flex-col gap-2" data-testid="machine-diagram">
      <GraphCanvas
        layout={layout}
        edges={graph.edges}
        label="State machine diagram"
        description="The same states and transitions are listed in the Transitions table below."
        maxHeight={480}
        emphasis={emphasis}
        dashedEdges={dashed}
        nodeLabel={(id) => {
          const marker = stateMarker(machine, id, terminal.has(id))
          return marker ? `State ${id}, ${marker.replace(" · ", " and ")}` : `State ${id}`
        }}
        renderNode={(node) => {
          const marker = stateMarker(machine, node.id, terminal.has(node.id))
          return (
            <>
              <rect
                width={node.width}
                height={node.height}
                rx={6}
                className="fill-card stroke-foreground"
                strokeWidth={1.25}
              />
              {terminal.has(node.id) && (
                <rect
                  x={3}
                  y={3}
                  width={node.width - 6}
                  height={node.height - 6}
                  rx={4}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={1}
                  data-terminal="true"
                />
              )}
              {node.id === machine.initial && (
                <path
                  d={`M-14,${node.height / 2}L-2,${node.height / 2}M-7,${node.height / 2 - 4}L-2,${node.height / 2}L-7,${node.height / 2 + 4}`}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={1.5}
                  data-initial="true"
                />
              )}
              <BoxText
                lines={marker ? [node.id, marker] : [node.id]}
                width={node.width}
                top={NODE_PAD_Y}
                lineHeight={LINE_HEIGHT}
                classNames={["font-medium", "fill-muted-foreground"]}
              />
            </>
          )
        }}
        renderEdgeLabel={(edge) => {
          const bundle = bundleOf.get(edge.id)
          if (!bundle || !edge.label) return null
          const width = edge.label.width
          return bundle.transitions.map((transition, i) => {
            const id = transitionId(transition)
            const isSelected = selected === id
            const top = LABEL_PAD_Y + i * 2 * LINE_HEIGHT
            return (
              <g
                key={id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Transition from ${transition.source} to ${transition.target}: ${commandLine(transition)}, ${eventsLine(transition)}`}
                data-graph-interactive="true"
                data-transition={id}
                data-selected={isSelected}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring"
                onClick={() => onSelect?.(id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect?.(id)
                  }
                }}
              >
                <rect
                  y={top - 1}
                  width={width}
                  height={2 * LINE_HEIGHT + 2}
                  rx={3}
                  className={cn(
                    "fill-background",
                    isSelected ? "stroke-foreground" : "stroke-transparent",
                  )}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                <BoxText
                  lines={[commandLine(transition), eventsLine(transition)]}
                  width={width}
                  top={top}
                  lineHeight={LINE_HEIGHT}
                  classNames={[undefined, "fill-muted-foreground"]}
                />
              </g>
            )
          })
        }}
      />
      <figcaption className="text-xs text-muted-foreground">
        An arrow into a state marks the initial state; a double border marks a terminal state. Each
        transition shows its command above the events it emits.
        {hasReplayOnly &&
          " A dashed arrow is a replay-only transition: it serves no new commands and exists so past events still replay."}{" "}
        Select a transition here or in the table to highlight it in both.
      </figcaption>
    </figure>
  )
}
