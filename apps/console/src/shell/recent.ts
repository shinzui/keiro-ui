import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"

import { useSelectedConnection } from "@/settings/connection-context"

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
  targetId?: string
  app?: string
  environment?: string
  workerId?: string
  at: string
}

const RECENT_LIMIT = 50

function parseVisits(raw: unknown): Visit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.filter(
    (v): v is Visit =>
      typeof v === "object" &&
      v !== null &&
      typeof v.targetId === "string" &&
      typeof v.kind === "string" &&
      typeof v.label === "string" &&
      typeof v.href === "string" &&
      typeof v.at === "string",
  )
}

export const recentStore = createLocalStore<Visit[]>("keiro-ui.recent.v2", [], parseVisits)
export const pinnedStore = createLocalStore<Visit[]>("keiro-ui.pinned.v2", [], parseVisits)

export function recordVisit(visit: Omit<Visit, "at">, at = new Date()): void {
  const entry: Visit = { ...visit, at: at.toISOString() }
  const rest = recentStore.get().filter((v) => !sameVisit(v, visit))
  recentStore.set([entry, ...rest].slice(0, RECENT_LIMIT))
}

/** Records a visit to an entity page once its entity is known (and again if it changes). */
export function useRecordVisit(visit: Omit<Visit, "at">): void {
  const selected = useSelectedConnection()
  const targetId = selected?.target.id
  const app = selected?.target.app
  const environment = selected?.target.environment
  const workerId = selected?.worker?.id
  const { kind, label, href } = visit
  useEffect(() => {
    if (targetId) recordVisit({ kind, label, href, targetId, app, environment, workerId })
  }, [kind, label, href, targetId, app, environment, workerId])
}

export function useRecent(filter?: {
  section?: SectionId
  limit?: number
  allTargets?: boolean
}): Visit[] {
  const selected = useSelectedConnection()
  const allTargets = filter?.allTargets
  const targetId = selected?.target.id
  const visits = useSyncExternalStore(recentStore.subscribe, recentStore.get)
  const section = filter?.section
  const limit = filter?.limit
  return useMemo(() => {
    const scoped = allTargets ? visits : visits.filter((v) => v.targetId === targetId)
    const matching = section ? scoped.filter((v) => entityKindSection(v.kind) === section) : scoped
    return limit === undefined ? matching : matching.slice(0, limit)
  }, [visits, section, limit, allTargets, targetId])
}

export function usePinned(): {
  pinned: Visit[]
  isPinned(href: string): boolean
  toggle(visit: Omit<Visit, "at">): void
} {
  const selected = useSelectedConnection()
  const allPinned = useSyncExternalStore(pinnedStore.subscribe, pinnedStore.get)
  const targetId = selected?.target.id
  const pinned = useMemo(
    () => allPinned.filter((v) => v.targetId === targetId),
    [allPinned, targetId],
  )
  const isPinned = useCallback((href: string) => pinned.some((v) => v.href === href), [pinned])
  const toggle = useCallback(
    (visit: Omit<Visit, "at">) => {
      if (!selected) return
      visit = {
        ...visit,
        targetId: selected.target.id,
        app: selected.target.app,
        environment: selected.target.environment,
        workerId: selected.worker?.id,
      }
      const current = pinnedStore.get()
      pinnedStore.set(
        current.some((v) => sameVisit(v, visit))
          ? current.filter((v) => !sameVisit(v, visit))
          : [...current, { ...visit, at: new Date().toISOString() }],
      )
    },
    [selected],
  )
  return { pinned, isPinned, toggle }
}

function sameVisit(a: Omit<Visit, "at">, b: Omit<Visit, "at">) {
  return (
    a.targetId === b.targetId && a.workerId === b.workerId && a.kind === b.kind && a.href === b.href
  )
}
