import { Button } from "@keiro-ui/ui/components/button"
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import {
  type ComponentType,
  createElement,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react"

import { createLocalStore } from "./local-store"

/**
 * Props a registered sheet component receives. The entity reference is `entityRef`, not
 * `ref`, because React 19 treats a `ref` prop on a function component specially.
 */
export interface SheetProps {
  entityRef: string
  close: () => void
}

export interface SheetTarget {
  kind: string
  ref: string
}

const sheetRegistry = new Map<string, ComponentType<SheetProps>>()

/** Registers an inspector for a sheet kind; call it at module scope or from registerFeature. */
export function registerSheet(kind: string, component: ComponentType<SheetProps>): void {
  sheetRegistry.set(kind, component)
}

/** "kind:ref" — joined with the first colon. */
export function encodeSheet(target: SheetTarget): string {
  return `${target.kind}:${target.ref}`
}

/** Splits on the first colon only, because refs such as `orders/42:7` contain colons. */
export function decodeSheet(value: string | undefined): SheetTarget | null {
  if (!value) return null
  const colon = value.indexOf(":")
  if (colon <= 0) return null
  return { kind: value.slice(0, colon), ref: value.slice(colon + 1) }
}

const shellRoute = getRouteApi("/_shell")

export function useRightSheet(): {
  current: SheetTarget | null
  open: (target: SheetTarget) => void
  close: () => void
} {
  const sheet = shellRoute.useSearch({ select: (search) => search.sheet })
  const navigate = useNavigate()
  const current = useMemo(() => decodeSheet(sheet), [sheet])
  const open = useCallback(
    (target: SheetTarget) =>
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, sheet: encodeSheet(target) }),
      } as never),
    [navigate],
  )
  const close = useCallback(
    () =>
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, sheet: undefined }),
      } as never),
    [navigate],
  )
  return { current, open, close }
}

const MIN_WIDTH = 360
const maxWidth = () => Math.round(window.innerWidth * 0.6)
const clampWidth = (width: number) =>
  Math.min(Math.max(width, MIN_WIDTH), Math.max(MIN_WIDTH, maxWidth()))

const sheetWidthStore = createLocalStore<number>("keiro-ui.sheet-width.v1", 480, (raw) =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : undefined,
)

function ResizeHandle({ width }: { width: number }) {
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    const onMove = (move: PointerEvent) =>
      sheetWidthStore.set(clampWidth(startWidth + startX - move.clientX))
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") sheetWidthStore.set(clampWidth(width + 24))
    else if (event.key === "ArrowRight") sheetWidthStore.set(clampWidth(width - 24))
    else return
    event.preventDefault()
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      aria-valuemin={MIN_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize bg-transparent outline-none hover:bg-border focus-visible:bg-ring"
    />
  )
}

function UnregisteredSheet({ kind, close }: { kind: string; close: () => void }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>No inspector</SheetTitle>
        <SheetDescription>No inspector registered for {kind}.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <Button variant="outline" onPress={close}>
          Close
        </Button>
      </div>
    </>
  )
}

/** Renders the sheet named by the `sheet` search parameter; mounted once by the shell. */
export function RightSheetOutlet() {
  const { current, close } = useRightSheet()
  const storedWidth = useSyncExternalStore(sheetWidthStore.subscribe, sheetWidthStore.get)
  if (!current) return null
  const width = clampWidth(storedWidth)
  const Component = sheetRegistry.get(current.kind)
  return (
    <Sheet
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
      side="right"
      // The overlay receives `style`; the content inherits the width through the variable.
      className="w-(--sheet-width)! max-w-none!"
      style={{ "--sheet-width": `${width}px` } as CSSProperties}
    >
      <ResizeHandle width={width} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        {Component ? (
          createElement(Component, { entityRef: current.ref, close })
        ) : (
          <UnregisteredSheet kind={current.kind} close={close} />
        )}
      </div>
    </Sheet>
  )
}
