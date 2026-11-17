import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  aggregateDetails,
  indexTopology,
  parseTopologyDocument,
  topologyNodeKey,
} from "@keiro-ui/client-keiro"
import { topologyGolden, topologyGoldenNames } from "@keiro-ui/testing"
import { describe, expect, test } from "vitest"

import {
  boxesOverlap,
  edgePath,
  type GraphLayout,
  labelSize,
  layoutGraph,
  type LayoutEdge,
  type LayoutNode,
  nodeSize,
} from "./layout"

const documentOf = (name: (typeof topologyGoldenNames)[number]) =>
  parseTopologyDocument(JSON.parse(new TextDecoder().decode(topologyGolden(name))))

function serviceGraph(name: (typeof topologyGoldenNames)[number]) {
  const document = documentOf(name)
  const nodes: LayoutNode[] = document.nodes.map((node) => ({
    id: topologyNodeKey(node.kind, node.name),
    lines: [node.kind, node.name],
  }))
  const edges: LayoutEdge[] = document.edges.map((edge, i) => ({
    id: `e${i}`,
    source: topologyNodeKey(edge.from.kind, edge.from.name),
    target: topologyNodeKey(edge.to.kind, edge.to.name),
    lines: [edge.relation],
  }))
  return { nodes, edges }
}

function machines(name: (typeof topologyGoldenNames)[number]) {
  const index = indexTopology(documentOf(name))
  return index.byKind("aggregate").flatMap((node) => {
    const machine = aggregateDetails(node)?.machine
    if (!machine) return []
    return [
      {
        label: `${name} ${node.name}`,
        nodes: machine.states.map((state) => ({ id: state.name, lines: [state.name] })),
        edges: machine.edges.map((edge) => ({
          id: `${edge.source}#${edge.edgeIndex}`,
          source: edge.source,
          target: edge.target,
          lines: [edge.command, edge.events.join(", ") || "no events"],
        })),
      },
    ]
  })
}

function expectSound(result: GraphLayout, nodes: LayoutNode[], edges: LayoutEdge[]) {
  expect(result.nodes.map((node) => node.id).toSorted()).toEqual(
    nodes.map((node) => node.id).toSorted(),
  )
  expect(result.edges).toHaveLength(edges.length)
  for (const [i, a] of result.nodes.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(0)
    expect(a.y).toBeGreaterThanOrEqual(0)
    expect(a.x + a.width).toBeLessThanOrEqual(result.width)
    expect(a.y + a.height).toBeLessThanOrEqual(result.height)
    expect(
      result.nodes.slice(i + 1).find((b) => boxesOverlap(a, b))?.id,
      `${a.id} overlaps a node`,
    ).toBeUndefined()
  }
  const boxes = new Map(result.nodes.map((node) => [node.id, node]))
  for (const [i, edge] of result.edges.entries()) {
    const { source, target } = edges[i]!
    // An edge crosses no node other than its own two ends: sampled along every segment.
    const crossed = result.nodes.find(
      (node) =>
        node.id !== source &&
        node.id !== target &&
        edge.points.slice(0, -1).some((from, at) => {
          const to = edge.points[at + 1]!
          for (let step = 1; step < 8; step += 1) {
            const x = from.x + ((to.x - from.x) * step) / 8
            const y = from.y + ((to.y - from.y) * step) / 8
            if (
              x > node.x + 1 &&
              x < node.x + node.width - 1 &&
              y > node.y + 1 &&
              y < node.y + node.height - 1
            )
              return true
          }
          return false
        }),
    )
    expect(crossed?.id, `${edge.id} crosses a node`).toBeUndefined()
    if (source === target) {
      // A self-loop leaves and re-enters its own node, between the node and its label.
      const box = boxes.get(source)!
      const [start, , , end] = edge.points
      expect(edge.points, `${edge.id} loop`).toHaveLength(4)
      expect([start!.y, end!.y], `${edge.id} loop ends`).toEqual([
        box.y + box.height,
        box.y + box.height,
      ])
      expect(edge.points[1]!.y, `${edge.id} loop turn`).toBeLessThanOrEqual(edge.label!.y)
    }
    if (source !== target) {
      // It starts on its source's border and ends on its target's.
      const start = edge.points[0]!
      const end = edge.points.at(-1)!
      const onBorder = (p: { x: number; y: number }, box: (typeof result.nodes)[number]) =>
        p.x >= box.x - 0.5 &&
        p.x <= box.x + box.width + 0.5 &&
        p.y >= box.y - 0.5 &&
        p.y <= box.y + box.height + 0.5
      expect(onBorder(start, boxes.get(source)!), `${edge.id} start`).toBe(true)
      expect(onBorder(end, boxes.get(target)!), `${edge.id} end`).toBe(true)
    }
    expect(edge.points.length, edge.id).toBeGreaterThanOrEqual(2)
    expect(edge.label, edge.id).toBeDefined()
    // A label never sits on a node.
    expect(
      result.nodes.find((node) => boxesOverlap(edge.label!, node))?.id,
      `label of ${edge.id} overlaps a node`,
    ).toBeUndefined()
  }
}

describe.each(topologyGoldenNames)("the %s golden", (name) => {
  test("its whole service graph lays out soundly and identically across runs", () => {
    const { nodes, edges } = serviceGraph(name)
    const first = layoutGraph(nodes, edges, "LR")
    expectSound(first, nodes, edges)
    expect(layoutGraph(nodes, edges, "LR")).toEqual(first)
    expectSound(layoutGraph(nodes, edges, "TB"), nodes, edges)
  })

  test("every aggregate machine lays out soundly and identically across runs", () => {
    for (const machine of machines(name)) {
      const first = layoutGraph(machine.nodes, machine.edges, "LR")
      expectSound(first, machine.nodes, machine.edges)
      expect(layoutGraph(machine.nodes, machine.edges, "LR"), machine.label).toEqual(first)
    }
  })
})

test("the goldens exercise self-transitions and parallel transitions", () => {
  const all = topologyGoldenNames.flatMap(machines)
  expect(all.length).toBeGreaterThan(5)
  expect(all.some((m) => m.edges.some((edge) => edge.source === edge.target))).toBe(true)
  const pairs = all.flatMap((m) =>
    m.edges.map((edge) => `${m.label}|${edge.source}>${edge.target}`),
  )
  expect(new Set(pairs).size).toBeLessThan(pairs.length)
})

test("the largest golden lays out within the time budget", () => {
  const largest = topologyGoldenNames
    .map(serviceGraph)
    .toSorted((a, b) => b.nodes.length + b.edges.length - (a.nodes.length + a.edges.length))[0]!
  layoutGraph(largest.nodes, largest.edges, "LR") // warm the module
  const started = performance.now()
  layoutGraph(largest.nodes, largest.edges, "LR")
  expect(performance.now() - started).toBeLessThan(200)
})

test("a synthetic 300-node service still lays out without overlap", () => {
  // SYNTHETIC: a chain of 100 triples, larger than any golden.
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  for (let i = 0; i < 100; i += 1) {
    nodes.push(
      { id: `intake:${i}`, lines: ["intake", `intake_${i}`] },
      { id: `process:${i}`, lines: ["process", `Process${i}`] },
      { id: `aggregate:${i}`, lines: ["aggregate", `Aggregate${i}`] },
    )
    edges.push(
      { id: `f${i}`, source: `intake:${i}`, target: `process:${i}`, lines: ["feeds"] },
      { id: `d${i}`, source: `process:${i}`, target: `aggregate:${i}`, lines: ["dispatches"] },
      {
        id: `x${i}`,
        source: `process:${i}`,
        target: `aggregate:${(i + 7) % 100}`,
        lines: ["saga"],
      },
    )
  }
  const started = performance.now()
  const result = layoutGraph(nodes, edges, "LR")
  const elapsed = performance.now() - started
  expectSound(result, nodes, edges)
  console.log(`300 nodes, 300 edges: ${Math.round(elapsed)} ms, ${result.width}×${result.height}`)
})

test("edges naming an absent node are dropped, and duplicate nodes are placed once", () => {
  const result = layoutGraph(
    [
      { id: "a", lines: ["a"] },
      { id: "a", lines: ["a again"] },
      { id: "b", lines: ["b"] },
    ],
    [
      { id: "ab", source: "a", target: "b", lines: ["to b"] },
      { id: "ac", source: "a", target: "c", lines: ["to nowhere"] },
    ],
    "LR",
  )
  expect(result.nodes.map((node) => node.id)).toEqual(["a", "b"])
  expect(result.edges.map((edge) => edge.id)).toEqual(["ab"])
})

test("sizes come from the text alone", () => {
  expect(nodeSize(["abcd"])).toEqual({ width: Math.ceil(4 * 7.2 + 24), height: 32 })
  expect(nodeSize(["ab", "abcdef"]).height).toBe(48)
  expect(labelSize([])).toEqual({ width: 0, height: 0 })
  expect(edgePath([])).toBe("")
  expect(
    edgePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
  ).toBe("M0,0L10,0")
  // A corner is rounded by at most half of each segment; a repeated point is ignored.
  expect(
    edgePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]),
  ).toBe("M0,0L5,0Q10,0 10,5L10,10")
})

test("an empty graph has no size and no parts", () => {
  expect(layoutGraph([], [], "LR")).toMatchObject({ nodes: [], edges: [] })
})

// Optional evidence from a real service: `keiro-dsl topology` over mori's workspace, written
// to .dev/mori.topology.json (git-ignored; see docs/plans/29-...). Skipped when absent.
const realPath = join(import.meta.dirname, "../../../../../../.dev/mori.topology.json")
test.runIf(existsSync(realPath))("a real 150-declaration service lays out soundly", () => {
  const document = parseTopologyDocument(JSON.parse(readFileSync(realPath, "utf8")))
  const nodes: LayoutNode[] = document.nodes.map((node) => ({
    id: topologyNodeKey(node.kind, node.name),
    lines: [node.kind, node.name],
  }))
  const pairs = new Map<string, LayoutEdge>()
  for (const edge of document.edges) {
    const source = topologyNodeKey(edge.from.kind, edge.from.name)
    const target = topologyNodeKey(edge.to.kind, edge.to.name)
    const id = `${source}>${target}`
    const pair = pairs.get(id)
    if (pair) pair.lines.push(edge.relation)
    else pairs.set(id, { id, source, target, lines: [edge.relation] })
  }
  const edges = [...pairs.values()]
  const started = performance.now()
  const result = layoutGraph(nodes, edges, "LR")
  const elapsed = performance.now() - started
  expectSound(result, nodes, edges)
  console.log(
    `real service ${document.service}: ${nodes.length} nodes, ${edges.length} drawn edges, ${Math.round(elapsed)} ms, ${result.width}×${result.height}`,
  )
})
