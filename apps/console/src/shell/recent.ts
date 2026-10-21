import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"

import { createLocalStore } from "./local-store"
import { entityKindSection, type SectionId } from "./navigation"

export type EntityKind =
  | "workflow"
  | "aggregate"
  | "process-manager"
  | "timer"
  | "projection"
  | "stream"
  | "category"
  | "event"
  | "subscription"
  | "queue"
  | "queue-message"
  | "processor"

export interface Visit {
  kind: EntityKind
  label: string
  href: string
  at: string
}

const RECENT_LIMIT = 50

function parseVisits(raw: unknown): Visit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.filter(
    (v): v is Visit =>
      typeof v === "object" &&
      v !== null &&
      typeof v.kind === "string" &&
      typeof v.label === "string" &&
      typeof v.href === "string" &&
      typeof v.at === "string",
  )
}

export const recentStore = createLocalStore<Visit[]>("keiro-ui.recent.v1", [], parseVisits)
export const pinnedStore = createLocalStore<Visit[]>("keiro-ui.pinned.v1", [], parseVisits)

export function recordVisit(visit: Omit<Visit, "at">, at = new Date()): void {
  const entry: Visit = { ...visit, at: at.toISOString() }
  const rest = recentStore.get().filter((v) => v.href !== visit.href)
  recentStore.set([entry, ...rest].slice(0, RECENT_LIMIT))
}

/** Records a visit to an entity page once its entity is known (and again if it changes). */
export function useRecordVisit(visit: Omit<Visit, "at">): void {
  const { kind, label, href } = visit
  useEffect(() => {
    recordVisit({ kind, label, href })
  }, [kind, label, href])
}

export function useRecent(filter?: { section?: SectionId; limit?: number }): Visit[] {
  const visits = useSyncExternalStore(recentStore.subscribe, recentStore.get)
  const section = filter?.section
  const limit = filter?.limit
  return useMemo(() => {
    const matching = section ? visits.filter((v) => entityKindSection(v.kind) === section) : visits
    return limit === undefined ? matching : matching.slice(0, limit)
  }, [visits, section, limit])
}

export function usePinned(): {
  pinned: Visit[]
  isPinned(href: string): boolean
  toggle(visit: Omit<Visit, "at">): void
} {
  const pinned = useSyncExternalStore(pinnedStore.subscribe, pinnedStore.get)
  const isPinned = useCallback((href: string) => pinned.some((v) => v.href === href), [pinned])
  const toggle = useCallback((visit: Omit<Visit, "at">) => {
    const current = pinnedStore.get()
    pinnedStore.set(
      current.some((v) => v.href === visit.href)
        ? current.filter((v) => v.href !== visit.href)
        : [...current, { ...visit, at: new Date().toISOString() }],
    )
  }, [])
  return { pinned, isPinned, toggle }
}
