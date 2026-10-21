import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@keiro-ui/ui/components/resizable"
import type { ReactNode } from "react"

const PANES = ["left", "right"] as const

function readLayout(key: string): Record<string, number> | undefined {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null")
    if (typeof parsed !== "object" || parsed === null) return undefined
    const layout = parsed as Record<string, unknown>
    const sizes = PANES.map((pane) => layout[pane])
    if (!sizes.every((size) => typeof size === "number" && size > 0 && size < 100)) return undefined
    return { left: sizes[0] as number, right: sizes[1] as number }
  } catch {
    return undefined
  }
}

function writeLayout(key: string, layout: Record<string, number>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // Storage may be full or blocked; the split still works for this page view.
  }
}

/** Two resizable panes whose ratio persists under `storageKey` (50/50 when absent or corrupt). */
export function SplitPane({
  storageKey,
  left,
  right,
}: {
  storageKey: string
  left: ReactNode
  right: ReactNode
}) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      defaultLayout={readLayout(storageKey) ?? { left: 50, right: 50 }}
      onLayoutChanged={(layout) => writeLayout(storageKey, layout)}
      className="min-h-96 rounded-lg border"
    >
      <ResizablePanel id="left" minSize="20" className="min-w-0">
        <div className="h-full overflow-auto p-3">{left}</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="right" minSize="20" className="min-w-0">
        <div className="h-full overflow-auto p-3">{right}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
