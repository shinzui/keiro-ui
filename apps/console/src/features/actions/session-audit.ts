import { useSyncExternalStore } from "react"

// The executed actions of this browser session, in memory only: they clear on reload.

export interface AuditEntry {
  surface: "keiro" | "shibuya"
  action: string
  target: string
  outcome: string
  exitCode?: number
  at: string
}

let entries: AuditEntry[] = []
const listeners = new Set<() => void>()

export function recordAction(entry: Omit<AuditEntry, "at">, at = new Date()): void {
  entries = [{ ...entry, at: at.toISOString() }, ...entries]
  for (const listener of listeners) listener()
}

export function clearSessionAudit(): void {
  entries = []
  for (const listener of listeners) listener()
}

export function useSessionAudit(): AuditEntry[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => entries,
  )
}
