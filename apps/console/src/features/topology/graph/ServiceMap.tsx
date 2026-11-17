import {
  parseTopologyNodeKey,
  topologyNodeKey,
  type TopologyIndex,
  type TopologyNode,
} from "@keiro-ui/client-keiro"
import { Button } from "@keiro-ui/ui/components/button"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { useMemo, useState } from "react"

import { links } from "@/lib/links"

import { KIND_GROUP_IDS, type KindGroupId, kindGroupOf, kindLabel } from "../labels"
import { BoxText, GraphCanvas } from "./GraphCanvas"
import { type LayoutEdge, layoutGraph, type LayoutNode, LINE_HEIGHT, NODE_PAD_Y } from "./layout"

/**
 * Above this many declarations the whole service is not drawn: a layered drawing of hundreds
 * of nodes is slow to read and tells an operator little. The map then asks for a kind group
 * or a declaration to start from.
 */
export const MAP_NODE_THRESHOLD = 80

// One hue per kind group, from the palette the console already uses for status, each with a
// dark-theme variant (the theme's own chart tokens are a grey ramp and cannot tell five groups
// apart). The group is also written on every node, so the tint is never the only signal.
const GROUP_TINT: Record<KindGroupId, { fill: string; stroke: string }> = {
  messaging: { fill: "fill-sky-500/15", stroke: "stroke-sky-600 dark:stroke-sky-400" },
  coordination: { fill: "fill-violet-500/15", stroke: "stroke-violet-600 dark:stroke-violet-400" },
  state: { fill: "fill-emerald-500/15", stroke: "stroke-emerald-600 dark:stroke-emerald-400" },
  queues: { fill: "fill-amber-500/15", stroke: "stroke-amber-600 dark:stroke-amber-400" },
  projections: { fill: "fill-rose-500/15", stroke: "stroke-rose-600 dark:stroke-rose-400" },
}

const keyOf = (ref: { kind: string; name: string }) => topologyNodeKey(ref.kind, ref.name)

export interface MapView {
  nodes: TopologyNode[]
  /** One per ordered pair of drawn declarations, with the relations between them. */
  bundles: { id: string; source: string; target: string; relations: string[] }[]
  /** Counts of the whole document and of what this view draws. */
  totalNodes: number
  totalEdges: number
  shownEdges: number
  /** The focus key when it names a declaration of the document. */
  focus: string | undefined
}

/**
 * What a map draws: the declarations within `depth` relations of `focus` in either direction
 * (all of them without a focus), restricted to the chosen kind groups. The focused
 * declaration is always drawn. A relation is drawn only when both its ends are.
 */
export function mapView(
  index: TopologyIndex,
  options: { groups?: readonly string[]; focus?: string; depth?: 1 | 2 },
): MapView {
  const { document } = index
  const groups = new Set(options.groups ?? KIND_GROUP_IDS)
  const focus = options.focus !== undefined && index.node(options.focus) ? options.focus : undefined

  let reach: Set<string> | undefined
  if (focus) {
    reach = new Set([focus])
    let frontier = [focus]
    for (let step = 0; step < (options.depth ?? 1); step += 1) {
      const next: string[] = []
      for (const key of frontier) {
        const around = [
          ...index.outgoing(key).map((edge) => keyOf(edge.to)),
          ...index.incoming(key).map((edge) => keyOf(edge.from)),
        ]
        for (const other of around) {
          if (reach.has(other)) continue
          reach.add(other)
          next.push(other)
        }
      }
      frontier = next
    }
  }

  const nodes = document.nodes.filter((node) => {
    const key = keyOf(node)
    if (key === focus) return true
    if (reach && !reach.has(key)) return false
    return groups.has(kindGroupOf(node.kind).id)
  })
  const drawn = new Set(nodes.map(keyOf))
  const bundles = new Map<string, MapView["bundles"][number]>()
  let shownEdges = 0
  for (const edge of document.edges) {
    const source = keyOf(edge.from)
    const target = keyOf(edge.to)
    if (!drawn.has(source) || !drawn.has(target)) continue
    shownEdges += 1
    const id = `${source}→${target}`
    const bundle = bundles.get(id)
    if (bundle) bundle.relations.push(edge.relation)
    else bundles.set(id, { id, source, target, relations: [edge.relation] })
  }
  return {
    nodes,
    bundles: [...bundles.values()],
    totalNodes: document.nodes.length,
    totalEdges: document.edges.length,
    shownEdges,
    focus,
  }
}

/** "dispatches ×3" when several relations of one kind join the same two declarations. */
export function relationLines(relations: string[]): string[] {
  const counts = new Map<string, number>()
  for (const relation of relations) counts.set(relation, (counts.get(relation) ?? 0) + 1)
  return [...counts].map(([relation, count]) => (count > 1 ? `${relation} ×${count}` : relation))
}

const nodeLines = (node: TopologyNode) => [
  `${kindGroupOf(node.kind).label} · ${kindLabel(node.kind)}`,
  node.name,
]

/**
 * The service drawn left to right along its relations. `onFocus` makes a declaration the
 * focus (double click or Enter); without it, activating a declaration does nothing more than
 * select it. The Relations tables on each declaration's page carry the same information.
 */
export function ServiceMap({
  index,
  groups,
  focus,
  depth,
  onFocus,
  maxHeight,
}: {
  index: TopologyIndex
  groups?: readonly string[]
  focus?: string
  depth?: 1 | 2
  onFocus?(key: string): void
  maxHeight?: number
}) {
  const [selected, setSelected] = useState<string>()
  const view = useMemo(
    () => mapView(index, { groups, focus, depth }),
    [index, groups, focus, depth],
  )
  const graph = useMemo(() => {
    const nodes: LayoutNode[] = view.nodes.map((node) => ({
      id: keyOf(node),
      lines: nodeLines(node),
      group: kindGroupOf(node.kind).id,
    }))
    const edges: LayoutEdge[] = view.bundles.map((bundle) => ({
      id: bundle.id,
      source: bundle.source,
      target: bundle.target,
      lines: relationLines(bundle.relations),
    }))
    return { nodes, edges }
  }, [view])
  const layout = useMemo(() => layoutGraph(graph.nodes, graph.edges, "LR"), [graph])
  const linesOf = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge.lines])), [graph])

  const active = selected && index.node(selected) ? selected : undefined
  const emphasis = useMemo(() => {
    if (!active) return undefined
    const ids = new Set([active])
    for (const bundle of view.bundles) {
      if (bundle.source !== active && bundle.target !== active) continue
      ids.add(bundle.id).add(bundle.source).add(bundle.target)
    }
    return ids
  }, [active, view])
  const activeNode = active ? index.node(active) : undefined

  const hiddenNodes = view.totalNodes - view.nodes.length
  const hiddenEdges = view.totalEdges - view.shownEdges

  return (
    <div className="flex flex-col gap-2" data-testid="service-map">
      <p className="text-xs text-muted-foreground" data-testid="map-counts">
        Drawing {view.nodes.length} of {view.totalNodes} declarations and {view.shownEdges} of{" "}
        {view.totalEdges} relations.
        {hiddenNodes > 0 || hiddenEdges > 0
          ? ` ${hiddenNodes} declarations and ${hiddenEdges} relations are hidden by the current view, so this is not the whole service.`
          : " This is the whole service."}
      </p>
      {view.nodes.length === 0 ? (
        <p className="text-sm" data-testid="map-empty">
          No declarations are in the chosen kind groups. The service has declarations; choose
          another group to see them.
        </p>
      ) : (
        <GraphCanvas
          layout={layout}
          edges={graph.edges}
          label="Service map"
          description="Each declaration's page lists the same relations as tables."
          maxHeight={maxHeight}
          selected={active}
          emphasis={emphasis}
          onSelect={(key) => setSelected((current) => (current === key ? undefined : key))}
          onActivate={(key) => {
            setSelected(key)
            onFocus?.(key)
          }}
          nodeLabel={(key) => {
            const ref = parseTopologyNodeKey(key)
            return ref ? `${kindLabel(ref.kind)} ${ref.name}` : key
          }}
          renderNode={(placed) => {
            const ref = parseTopologyNodeKey(placed.id)
            const tint = GROUP_TINT[kindGroupOf(ref?.kind ?? "").id]
            const isFocus = placed.id === view.focus
            const isSelected = placed.id === active
            return (
              <>
                <rect
                  width={placed.width}
                  height={placed.height}
                  rx={6}
                  className={cn(
                    tint.fill,
                    isFocus || isSelected ? "stroke-foreground" : tint.stroke,
                  )}
                  strokeWidth={isFocus || isSelected ? 2.25 : 1.25}
                />
                <BoxText
                  lines={[
                    `${kindGroupOf(ref?.kind ?? "").label} · ${kindLabel(ref?.kind ?? "")}`,
                    ref?.name ?? placed.id,
                  ]}
                  width={placed.width}
                  top={NODE_PAD_Y}
                  lineHeight={LINE_HEIGHT}
                  classNames={["fill-muted-foreground", "font-medium"]}
                />
              </>
            )
          }}
          renderEdgeLabel={(edge) =>
            edge.label && (
              <>
                <rect
                  width={edge.label.width}
                  height={edge.label.height}
                  rx={3}
                  className="fill-background"
                />
                <BoxText
                  lines={linesOf.get(edge.id) ?? []}
                  width={edge.label.width}
                  top={3}
                  lineHeight={LINE_HEIGHT}
                />
              </>
            )
          }
        />
      )}
      {activeNode && (
        <div
          role="status"
          aria-label="Selected declaration"
          className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"
          data-testid="map-selection"
        >
          <span>
            <span className="text-muted-foreground">{kindLabel(activeNode.kind)}</span>{" "}
            <span className="font-medium">{activeNode.name}</span>
          </span>
          <Link
            {...links.topologyNode(activeNode.kind, activeNode.name)}
            className="underline-offset-2 hover:underline"
          >
            Open declaration
          </Link>
          {onFocus && active !== view.focus && (
            <Button size="xs" variant="outline" onPress={() => onFocus(active!)}>
              Focus the map on it
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Its direct relations are highlighted. Double-click or press Enter on a declaration to
            focus the map on it.
          </span>
        </div>
      )}
    </div>
  )
}
