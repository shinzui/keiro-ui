import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@keiro-ui/ui/components/dialog"
import { Kbd, KbdGroup } from "@keiro-ui/ui/components/kbd"
import { useSidebar } from "@keiro-ui/ui/components/sidebar"
import { useRouter } from "@tanstack/react-router"
import { useEffect, useSyncExternalStore } from "react"

import { navigateToHref } from "@/lib/href"

import { useCommandPalette } from "./command-palette"
import { useRightSheet } from "./right-sheet"

export const chordTargets: Record<string, { href: string; title: string }> = {
  o: { href: "/", title: "Overview" },
  a: { href: "/aggregates", title: "Aggregates" },
  w: { href: "/workflows", title: "Workflows" },
  p: { href: "/process-managers", title: "Process Managers" },
  r: { href: "/projections", title: "Projections (read models)" },
  s: { href: "/streams", title: "Streams" },
  q: { href: "/queues", title: "Queues" },
}

const CHORD_WINDOW_MS = 1500

let shortcutsOpen = false
const listeners = new Set<() => void>()
export function setShortcutsOpen(open: boolean) {
  if (open === shortcutsOpen) return
  shortcutsOpen = open
  for (const listener of listeners) listener()
}
function useShortcutsOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => shortcutsOpen,
  )
}

/** True when the event comes from a place where typing must never trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

function anyDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

/** Mounted once inside the shell (it needs the sidebar context). */
export function useGlobalShortcuts(): void {
  const router = useRouter()
  const palette = useCommandPalette()
  const { toggleSidebar } = useSidebar()
  const sheet = useRightSheet()
  const { toggle: togglePalette } = palette
  const { current: currentSheet, close: closeSheet } = sheet

  useEffect(() => {
    let chordStartedAt: number | null = null
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault()
        togglePalette()
        return
      }
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === "Escape") {
        if (currentSheet && !anyDialogOpen()) closeSheet()
        return
      }
      if (anyDialogOpen()) return

      const now = Date.now()
      if (chordStartedAt !== null && now - chordStartedAt <= CHORD_WINDOW_MS) {
        chordStartedAt = null
        const target = chordTargets[event.key]
        if (target) {
          event.preventDefault()
          void navigateToHref(router, target.href)
        }
        return
      }
      chordStartedAt = null
      if (event.key === "g") {
        chordStartedAt = now
      } else if (event.key === "[") {
        event.preventDefault()
        toggleSidebar()
      } else if (event.key === "?") {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, togglePalette, toggleSidebar, currentSheet, closeSheet])
}

function Binding({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="contents">
      <dt>
        <KbdGroup>
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </dt>
      <dd className="text-muted-foreground">{description}</dd>
    </div>
  )
}

export function ShortcutsDialog() {
  const open = useShortcutsOpen()
  return (
    <Dialog isOpen={open} onOpenChange={setShortcutsOpen}>
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Shortcuts never fire while you type in a field.</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <Binding keys={["⌘", "K"]} description="Open the command palette (Ctrl+K)" />
        <Binding keys={["["]} description="Toggle the sidebar" />
        <Binding keys={["?"]} description="Show this help" />
        <Binding keys={["Esc"]} description="Close the inspector sheet" />
        {Object.entries(chordTargets).map(([key, target]) => (
          <Binding key={key} keys={["g", key]} description={`Go to ${target.title}`} />
        ))}
      </dl>
    </Dialog>
  )
}
