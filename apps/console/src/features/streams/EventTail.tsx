import type { Frame } from "@keiro-ui/client-core"
import { type KirokuEvent, useKirokuEventTail } from "@keiro-ui/client-kiroku"
import { Alert, AlertDescription, AlertTitle } from "@keiro-ui/ui/components/alert"
import { toast } from "@keiro-ui/ui/components/sonner"
import { useState } from "react"

import { LiveTailControls } from "@/components/LiveTailControls"
import { useLiveness } from "@/shell/liveness"

const TOAST_CODES = new Set(["replay_failed", "category_read_failed", "live_decode_failed"])

/**
 * Follows the store live from `fromPosition` (optionally one category) while liveness is on.
 * Overflow shows the server's message (never a parsed count) and re-reads the poll path;
 * coded feed errors toast and polling continues.
 */
export function useEventTail(options: {
  fromPosition: bigint | undefined
  category?: string
  enabled: boolean
  onOverflow?: () => void
}) {
  const { paused } = useLiveness()
  const [overflow, setOverflow] = useState<string | null>(null)
  const tail = useKirokuEventTail({
    enabled: options.enabled && !paused && options.fromPosition !== undefined,
    fromPosition: options.fromPosition,
    category: options.category,
    onOverflow: (frame: Frame) => {
      setOverflow(typeof frame.message === "string" ? frame.message : "events were dropped")
      options.onOverflow?.()
    },
    onError: (frame: Frame) => {
      const code = typeof frame.code === "string" ? frame.code : "error"
      if (TOAST_CODES.has(code))
        toast.error(`Live tail: ${code}`, { description: String(frame.message ?? "") })
    },
  })
  const status = paused ? ("paused" as const) : tail.status
  return { events: tail.events, status, overflow, clearOverflow: () => setOverflow(null) }
}

export function OverflowNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Alert role="status">
      <AlertTitle>Events were dropped — reloading</AlertTitle>
      <AlertDescription>
        <span className="font-mono text-xs">{message}</span>{" "}
        <button type="button" className="underline" onClick={onDismiss}>
          Dismiss
        </button>
      </AlertDescription>
    </Alert>
  )
}

/** Newest first, de-duplicated by global position. */
export function mergeNewestFirst(...lists: KirokuEvent[][]): KirokuEvent[] {
  const byPosition = new Map<bigint, KirokuEvent>()
  for (const list of lists) for (const event of list) byPosition.set(event.globalPosition, event)
  return [...byPosition.values()].toSorted((a, b) => (a.globalPosition > b.globalPosition ? -1 : 1))
}

export { LiveTailControls }
