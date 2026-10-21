import { Kbd } from "@keiro-ui/ui/components/kbd"
import { Separator } from "@keiro-ui/ui/components/separator"
import type { ReactNode } from "react"

import { useStatusSlotContent } from "./status-slots"

function Slot({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div data-slot={`status-${name}`} className="flex h-full shrink-0 items-center gap-1.5 px-2">
      {children}
    </div>
  )
}

/**
 * The 28 px bottom bar. Fixed slots, left to right: connection profile, per-surface health,
 * the free `page` slot, the `store-head` slot, the session's `actions`, liveness, version, and
 * the palette hint.
 */
export function StatusBar({
  connection,
  health,
  liveness,
  paletteHint,
}: {
  connection?: ReactNode
  health?: ReactNode
  liveness?: ReactNode
  paletteHint?: ReactNode
}) {
  const page = useStatusSlotContent("page")
  const storeHead = useStatusSlotContent("store-head")
  const actions = useStatusSlotContent("actions")
  return (
    <footer
      aria-label="Status"
      className="flex h-7 shrink-0 items-center border-t bg-sidebar text-xs text-sidebar-foreground"
    >
      <Slot name="connection">{connection}</Slot>
      <Separator orientation="vertical" />
      <Slot name="health">{health}</Slot>
      <div data-slot="status-page" className="flex min-w-0 flex-1 items-center px-2">
        {page}
      </div>
      {storeHead && <Slot name="store-head">{storeHead}</Slot>}
      {actions && <Slot name="actions">{actions}</Slot>}
      <Slot name="liveness">{liveness}</Slot>
      <Separator orientation="vertical" />
      <Slot name="version">
        <span className="text-muted-foreground" title={`commit ${__GIT_COMMIT__}`}>
          v{__APP_VERSION__} · {__GIT_COMMIT__}
        </span>
      </Slot>
      <Slot name="palette-hint">
        {paletteHint ?? (
          <span className="text-muted-foreground">
            <Kbd>⌘K</Kbd>
          </span>
        )}
      </Slot>
    </footer>
  )
}
