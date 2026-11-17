import { Graph, layout } from "@dagrejs/dagre"

// Layered layout as a pure function: sizes come from label text, never from the DOM, so a
// layout is the same in a test and in a browser. The console's single typeface is monospaced
// (ADR-8), so a label's width is its character count times a fixed advance.

/** Diagram text is 12px; Paper Mono advances 0.6 em per character. */
export const FONT_SIZE = 12
export const CHAR_WIDTH = FONT_SIZE * 0.6
export const LINE_HEIGHT = 16
export const NODE_PAD_X = 12
export const NODE_PAD_Y = 8
const LABEL_PAD_X = 6
const LABEL_PAD_Y = 3

export interface LayoutNode {
  id: string
  lines: string[]
  group?: string
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  lines: string[]
}

export interface Point {
  x: number
  y: number
}

export interface PlacedNode {
  id: string
  /** The box's top-left corner and size. */
  x: number
  y: number
  width: number
  height: number
}

export interface PlacedEdge {
  id: string
  /** From the source's border to the target's border. */
  points: Point[]
  /** The label box's top-left corner and size; absent when the edge has no label lines. */
  label?: { x: number; y: number; width: number; height: number }
}

export interface GraphLayout {
  width: number
  height: number
  nodes: PlacedNode[]
  edges: PlacedEdge[]
}

const widthOf = (lines: string[]) => Math.max(0, ...lines.map((line) => line.length)) * CHAR_WIDTH

export function nodeSize(lines: string[]): { width: number; height: number } {
  return {
    width: Math.ceil(widthOf(lines) + 2 * NODE_PAD_X),
    height: Math.max(1, lines.length) * LINE_HEIGHT + 2 * NODE_PAD_Y,
  }
}

export function labelSize(lines: string[]): { width: number; height: number } {
  if (lines.length === 0) return { width: 0, height: 0 }
  return {
    width: Math.ceil(widthOf(lines) + 2 * LABEL_PAD_X),
    height: lines.length * LINE_HEIGHT + 2 * LABEL_PAD_Y,
  }
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Places nodes in layers along `direction` and routes every edge, parallel edges and
 * self-loops included. Edges naming a node that is not in `nodes` are dropped, so a caller can
 * filter nodes without filtering edges first. The result depends only on the arguments and
 * their order.
 */
export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: "LR" | "TB",
): GraphLayout {
  const graph = new Graph({ multigraph: true, directed: true })
  graph.setGraph({
    rankdir: direction,
    nodesep: 28,
    edgesep: 16,
    ranksep: 56,
    marginx: 16,
    marginy: 16,
  })
  graph.setDefaultEdgeLabel(() => ({}))
  const known = new Set<string>()
  for (const node of nodes) {
    if (known.has(node.id)) continue
    known.add(node.id)
    graph.setNode(node.id, nodeSize(node.lines))
  }
  const routed: LayoutEdge[] = []
  for (const edge of edges) {
    if (!known.has(edge.source) || !known.has(edge.target)) continue
    routed.push(edge)
    graph.setEdge(edge.source, edge.target, { ...labelSize(edge.lines), labelpos: "c" }, edge.id)
  }
  layout(graph)

  const placedNodes = [...known].map((id) => {
    const box = graph.node(id) as { x: number; y: number; width: number; height: number }
    return {
      id,
      x: round(box.x - box.width / 2),
      y: round(box.y - box.height / 2),
      width: box.width,
      height: box.height,
    }
  })
  const boxOf = new Map(placedNodes.map((node) => [node.id, node]))
  const lanes = rankLanes(placedNodes, direction)
  const placedEdges = routed.map((edge) => {
    const placed = graph.edge(edge.source, edge.target, edge.id) as {
      points?: Point[]
      x?: number
      y?: number
      width?: number
      height?: number
    }
    const size = labelSize(edge.lines)
    const hasLabel = edge.lines.length > 0 && placed.x !== undefined && placed.y !== undefined
    const routedPoints = (placed.points ?? []).map((point) => ({
      x: round(point.x),
      y: round(point.y),
    }))
    const result: PlacedEdge = {
      id: edge.id,
      points:
        edge.source === edge.target
          ? selfLoop(
              routedPoints,
              boxOf.get(edge.source),
              hasLabel
                ? { x: placed.x!, y: placed.y!, width: size.width, height: size.height }
                : undefined,
            )
          : squareEnds(
              routedPoints,
              boxOf.get(edge.source),
              boxOf.get(edge.target),
              lanes,
              direction,
            ),
    }
    if (hasLabel)
      result.label = {
        x: round(placed.x! - size.width / 2),
        y: round(placed.y! - size.height / 2),
        width: size.width,
        height: size.height,
      }
    return result
  })
  const size = graph.graph() as { width?: number; height?: number }
  return {
    width: Math.ceil(size.width ?? 0),
    height: Math.ceil(size.height ?? 0),
    nodes: placedNodes,
    edges: placedEdges,
  }
}

type Box = { x: number; y: number; width: number; height: number }

/** How far outside a rank's widest node an edge turns. Smaller than half of `ranksep`. */
const LANE = 14

/**
 * The extent of every rank along the layout direction, keyed by the rank's centre. Nodes of
 * one rank share a centre and differ in width, so a line leaving a narrow node at an angle
 * can cross a wider neighbour of the same rank. Edges therefore turn only in the lane just
 * outside the rank's widest node.
 */
function rankLanes(
  nodes: Box[],
  direction: "LR" | "TB",
): Map<number, { low: number; high: number }> {
  const lanes = new Map<number, { low: number; high: number }>()
  for (const node of nodes) {
    const start = direction === "LR" ? node.x : node.y
    const size = direction === "LR" ? node.width : node.height
    const centre = Math.round(start + size / 2)
    const lane = lanes.get(centre) ?? { low: Infinity, high: -Infinity }
    lane.low = Math.min(lane.low, start - LANE)
    lane.high = Math.max(lane.high, start + size + LANE)
    lanes.set(centre, lane)
  }
  return lanes
}

/**
 * Replaces the ends of a routed edge so it leaves its source and enters its target square to
 * the node's side, travelling across the rank only in the lane outside it. The interior
 * points (dagre's, which already avoid nodes of the ranks they pass) are kept.
 */
function squareEnds(
  points: Point[],
  source: Box | undefined,
  target: Box | undefined,
  lanes: Map<number, { low: number; high: number }>,
  direction: "LR" | "TB",
): Point[] {
  if (points.length < 3 || !source || !target) return points
  // Work in (main, cross) coordinates: main runs along the layout direction.
  const lr = direction === "LR"
  const main = (p: Point) => (lr ? p.x : p.y)
  const cross = (p: Point) => (lr ? p.y : p.x)
  const at = (m: number, c: number): Point =>
    lr ? { x: round(m), y: round(c) } : { x: round(c), y: round(m) }
  const side = (box: Box, toward: Point) => {
    const start = lr ? box.x : box.y
    const size = lr ? box.width : box.height
    const centreMain = start + size / 2
    const centreCross = (lr ? box.y : box.x) + (lr ? box.height : box.width) / 2
    const forward = main(toward) >= centreMain
    const lane = lanes.get(Math.round(centreMain))
    const turn = lane
      ? forward
        ? lane.high
        : lane.low
      : forward
        ? start + size + LANE
        : start - LANE
    return { border: at(forward ? start + size : start, centreCross), turn, centreCross }
  }
  const inner = points.slice(1, -1)
  const first = inner[0]!
  const last = inner.at(-1)!
  const out = side(source, first)
  const into = side(target, last)
  return [
    out.border,
    at(out.turn, out.centreCross),
    at(out.turn, cross(first)),
    ...inner,
    at(into.turn, cross(last)),
    at(into.turn, into.centreCross),
    into.border,
  ]
}

/**
 * A self-loop drawn as a staple between the node and its label, which dagre places beside
 * the node in its own rank (below it when ranks run left to right, to its right otherwise):
 * out of the node, along the label's near side, and back in. dagre's own loop is a small
 * curve that the label covers. Without a label the routed points are kept.
 */
function selfLoop(
  points: Point[],
  node: Box | undefined,
  label: { x: number; y: number; width: number; height: number } | undefined,
): Point[] {
  if (!node || !label) return points
  const HALF = 12
  const GAP = 4
  const centreX = node.x + node.width / 2
  const centreY = node.y + node.height / 2
  const bottom = node.y + node.height
  const right = node.x + node.width
  const labelTop = label.y - label.height / 2
  const labelLeft = label.x - label.width / 2
  if (labelTop >= bottom) {
    const turn = round(Math.max(bottom + GAP, labelTop - GAP))
    return [
      { x: round(centreX - HALF), y: bottom },
      { x: round(centreX - HALF), y: turn },
      { x: round(centreX + HALF), y: turn },
      { x: round(centreX + HALF), y: bottom },
    ]
  }
  if (labelLeft >= right) {
    const turn = round(Math.max(right + GAP, labelLeft - GAP))
    return [
      { x: right, y: round(centreY - HALF) },
      { x: turn, y: round(centreY - HALF) },
      { x: turn, y: round(centreY + HALF) },
      { x: right, y: round(centreY + HALF) },
    ]
  }
  return points
}

/** A smooth SVG path through an edge's points. */
export function edgePath(points: Point[]): string {
  // Drop repeated points: a zero-length segment has no direction to round.
  const path = points.filter(
    (point, i) => i === 0 || point.x !== points[i - 1]!.x || point.y !== points[i - 1]!.y,
  )
  if (path.length === 0) return ""
  const first = path[0]!
  if (path.length === 1) return `M${first.x},${first.y}`
  let d = `M${first.x},${first.y}`
  for (let i = 1; i < path.length - 1; i += 1) {
    const before = path[i - 1]!
    const corner = path[i]!
    const after = path[i + 1]!
    // Round each corner by at most CORNER, and never past the middle of either segment.
    const enter = towards(corner, before, CORNER)
    const leave = towards(corner, after, CORNER)
    d += `L${enter.x},${enter.y}Q${corner.x},${corner.y} ${leave.x},${leave.y}`
  }
  const last = path.at(-1)!
  return `${d}L${last.x},${last.y}`
}

const CORNER = 10

/** The point `distance` from `from` towards `to`, at most half way. */
function towards(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length === 0) return from
  const ratio = Math.min(distance, length / 2) / length
  return { x: round(from.x + (to.x - from.x) * ratio), y: round(from.y + (to.y - from.y) * ratio) }
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}
