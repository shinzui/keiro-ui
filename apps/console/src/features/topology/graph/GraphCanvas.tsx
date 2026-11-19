import { Button } from "@keiro-ui/ui/components/button"
import { Dialog, DialogTitle } from "@keiro-ui/ui/components/dialog"
import { cn } from "cn"
import { Expand, Maximize2, Shrink, ZoomIn, ZoomOut } from "lucide-react"
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  edgePath,
  FONT_SIZE,
  type GraphLayout,
  type LayoutEdge,
  type PlacedEdge,
  type PlacedNode,
} from "./layout"

// The one SVG renderer for the console's diagrams. Colours come from theme variables only,
// through Tailwind's token classes, so a diagram follows the light and dark theme. Nothing a
// diagram shows is absent from the table it names in its description.

const MIN_SCALE = 0.4
const MAX_SCALE = 2
const STEP = 1.25

export interface GraphCanvasProps {
  layout: GraphLayout
  /** The edges the layout was computed from: they give arrow-key navigation its directions. */
  edges: readonly LayoutEdge[]
  /** The accessible name, and where the same information is available as text. */
  label: string
  description: string
  /** The content of a node, drawn in the node's own coordinates (0,0 is its top-left). */
  renderNode(node: PlacedNode): ReactNode
  /** The content of an edge label, drawn in the label's own coordinates. */
  renderEdgeLabel?(edge: PlacedEdge): ReactNode
  nodeLabel(id: string): string
  dashedEdges?: ReadonlySet<string>
  /** When set, everything else is dimmed. Holds node and edge ids. */
  emphasis?: ReadonlySet<string>
  selected?: string
  onSelect?(nodeId: string): void
  /** Enter or a double click. */
  onActivate?(nodeId: string): void
  /** The tallest the canvas grows before it scrolls. */
  maxHeight?: number
  /** Drawn under the canvas, and under it in the maximized view too (e.g. the selection). */
  footer?: ReactNode
  className?: string
}

export function GraphCanvas({
  layout,
  edges,
  label,
  description,
  renderNode,
  renderEdgeLabel,
  nodeLabel,
  dashedEdges,
  emphasis,
  selected,
  onSelect,
  onActivate,
  maxHeight = 560,
  footer,
  className,
}: GraphCanvasProps) {
  const id = useId()
  const [scale, setScale] = useState(1)
  // Maximized, the same canvas moves into a near-full-screen dialog; the page keeps a
  // placeholder of the canvas's height so it does not jump underneath.
  const [maximized, setMaximized] = useState(false)
  const [placeholderHeight, setPlaceholderHeight] = useState(0)
  const viewport = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, SVGGElement>())
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  // Focus order follows the drawing: by column, then down the column.
  const ordered = useMemo(
    () => layout.nodes.toSorted((a, b) => a.x - b.x || a.y - b.y),
    [layout.nodes],
  )
  const steps = useMemo(() => {
    const next = new Map<string, string[]>()
    const previous = new Map<string, string[]>()
    for (const edge of edges) {
      if (edge.source === edge.target) continue
      next.set(edge.source, [...(next.get(edge.source) ?? []), edge.target])
      previous.set(edge.target, [...(previous.get(edge.target) ?? []), edge.source])
    }
    return { next, previous }
  }, [edges])

  const focusNode = useCallback((nodeId: string | undefined) => {
    if (nodeId) nodeRefs.current.get(nodeId)?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
    const position = ordered.findIndex((node) => node.id === nodeId)
    const move: Record<string, string | undefined> = {
      ArrowRight: steps.next.get(nodeId)?.[0],
      ArrowLeft: steps.previous.get(nodeId)?.[0],
      ArrowDown: ordered[position + 1]?.id,
      ArrowUp: ordered[position - 1]?.id,
      Home: ordered[0]?.id,
      End: ordered.at(-1)?.id,
    }
    if (event.key in move) {
      event.preventDefault()
      focusNode(move[event.key])
    } else if (event.key === "Enter") {
      event.preventDefault()
      ;(onActivate ?? onSelect)?.(nodeId)
    } else if (event.key === " ") {
      event.preventDefault()
      onSelect?.(nodeId)
    }
  }

  const fit = () => {
    const width = viewport.current?.clientWidth ?? 0
    // No layout engine (tests): keep the natural size.
    if (width <= 0) return setScale(1)
    // Inline the canvas scrolls down, so it fits the width; maximized it fits the whole view.
    const height = viewport.current?.clientHeight ?? 0
    const ratio =
      maximized && height > 0
        ? Math.min(width / layout.width, height / layout.height)
        : width / layout.width
    setScale(Math.max(MIN_SCALE, Math.min(1, ratio)))
  }
  const maximize = () => {
    setPlaceholderHeight(viewport.current?.offsetHeight ?? 0)
    setMaximized(true)
  }
  const zoom = (factor: number) =>
    setScale((value) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value * factor)))

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element
    if (event.button !== 0 || target.closest("[data-graph-node],[data-graph-interactive]")) return
    const element = viewport.current
    if (!element) return
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    }
    element.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    const element = viewport.current
    if (!start || !element) return
    element.scrollLeft = start.left - (event.clientX - start.x)
    element.scrollTop = start.top - (event.clientY - start.y)
  }
  const endDrag = () => {
    drag.current = null
  }

  const dimmed = (itemId: string) => emphasis !== undefined && !emphasis.has(itemId)

  const toolbar = (
    <div className="flex items-center gap-1" role="toolbar" aria-label={`${label} view`}>
      <Button size="xs" variant="outline" aria-label="Zoom out" onPress={() => zoom(1 / STEP)}>
        <ZoomOut />
      </Button>
      <span className="w-12 text-center text-xs text-muted-foreground" data-testid="graph-scale">
        {Math.round(scale * 100)}%
      </span>
      <Button size="xs" variant="outline" aria-label="Zoom in" onPress={() => zoom(STEP)}>
        <ZoomIn />
      </Button>
      <Button
        size="xs"
        variant="outline"
        aria-label={maximized ? "Fit to view" : "Fit to width"}
        onPress={fit}
      >
        <Maximize2 /> Fit
      </Button>
      <Button size="xs" variant="ghost" onPress={() => setScale(1)}>
        100%
      </Button>
      {maximized ? (
        <Button size="xs" variant="outline" onPress={() => setMaximized(false)}>
          <Shrink /> Restore
        </Button>
      ) : (
        <Button size="xs" variant="outline" onPress={maximize}>
          <Expand /> Maximize
        </Button>
      )}
      <span className="ml-2 text-xs text-muted-foreground">
        Drag to pan. Arrow keys move between nodes.
      </span>
    </div>
  )

  const canvas = (
    <div
      ref={viewport}
      className={cn(
        "cursor-grab overflow-auto rounded-md border bg-muted/20 active:cursor-grabbing",
        maximized && "min-h-0 flex-1",
      )}
      style={maximized ? undefined : { maxHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <svg
        role="group"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width * scale}
        height={layout.height * scale}
        className="block select-none font-mono text-foreground"
        style={{ fontSize: FONT_SIZE }}
      >
        <title id={`${id}-title`}>{label}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0L10,5L0,10z" className="fill-muted-foreground" />
          </marker>
          <marker
            id={`${id}-arrow-strong`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0L10,5L0,10z" className="fill-foreground" />
          </marker>
        </defs>
        <g aria-hidden="true">
          {layout.edges.map((edge) => {
            const strong = emphasis?.has(edge.id) ?? false
            return (
              <path
                key={edge.id}
                d={edgePath(edge.points)}
                data-graph-edge={edge.id}
                data-dashed={dashedEdges?.has(edge.id) ?? false}
                fill="none"
                strokeDasharray={dashedEdges?.has(edge.id) ? "6 4" : undefined}
                strokeWidth={strong ? 2 : 1.25}
                markerEnd={`url(#${id}-arrow${strong ? "-strong" : ""})`}
                className={cn(
                  strong ? "stroke-foreground" : "stroke-muted-foreground",
                  dimmed(edge.id) && "opacity-25",
                )}
              />
            )
          })}
        </g>
        {renderEdgeLabel &&
          layout.edges.map(
            (edge) =>
              edge.label && (
                <g
                  key={edge.id}
                  transform={`translate(${edge.label.x},${edge.label.y})`}
                  data-graph-edge-label={edge.id}
                  className={cn(dimmed(edge.id) && "opacity-25")}
                >
                  {renderEdgeLabel(edge)}
                </g>
              ),
          )}
        {ordered.map((node) => (
          <g
            key={node.id}
            ref={(element) => {
              if (element) nodeRefs.current.set(node.id, element)
              else nodeRefs.current.delete(node.id)
            }}
            transform={`translate(${node.x},${node.y})`}
            role="button"
            tabIndex={0}
            aria-label={nodeLabel(node.id)}
            aria-pressed={onSelect ? selected === node.id : undefined}
            data-graph-node={node.id}
            data-selected={selected === node.id}
            className={cn(
              "cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-ring [&:focus-visible>rect:first-of-type]:[stroke-width:3]",
              dimmed(node.id) && "opacity-30",
            )}
            onClick={() => onSelect?.(node.id)}
            onDoubleClick={() => onActivate?.(node.id)}
            onKeyDown={(event) => onKeyDown(event, node.id)}
          >
            {renderNode(node)}
          </g>
        ))}
      </svg>
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {toolbar}
      {maximized ? (
        <div
          aria-hidden="true"
          className="rounded-md border border-dashed bg-muted/10"
          style={{ height: placeholderHeight }}
        />
      ) : (
        <>
          {canvas}
          {footer}
        </>
      )}
      {maximized && (
        <Dialog
          isOpen
          onOpenChange={setMaximized}
          // Almost the whole window; the dialog's inner element becomes the flex column.
          className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-2 sm:max-w-none *:data-[slot=dialog]:min-h-0 *:data-[slot=dialog]:flex-1 *:data-[slot=dialog]:flex-col"
        >
          <DialogTitle className="pr-8">{label}</DialogTitle>
          {toolbar}
          {canvas}
          {footer}
        </Dialog>
      )}
    </div>
  )
}

/** Lines of text centred in a box, one `tspan` per line. */
export function BoxText({
  lines,
  width,
  top,
  lineHeight,
  classNames,
}: {
  lines: string[]
  width: number
  top: number
  lineHeight: number
  classNames?: (string | undefined)[]
}) {
  return (
    <text textAnchor="middle" className="fill-current">
      {lines.map((line, i) => (
        <tspan
          // Lines of one label; their order is their identity.
          // oxlint-disable-next-line react/no-array-index-key
          key={i}
          x={width / 2}
          y={top + lineHeight * i + lineHeight * 0.72}
          className={classNames?.[i]}
        >
          {line}
        </tspan>
      ))}
    </text>
  )
}
