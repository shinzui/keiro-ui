import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react"
import { z } from "zod"

import { createLocalStore } from "@/shell/local-store"

import { useSelectedConnection } from "./connection-context"
import {
  type ConnectionProfile,
  connectionProfileSchema,
  sameOriginProfile,
  type Surface,
  surfacePrefixes,
} from "./connection-profile-schema"
import { useTargetSelection } from "./target-selection"
export * from "./connection-profile-schema"

interface StoredProfiles {
  version: 1
  activeId: string
  profiles: ConnectionProfile[]
}

const storedSchema = z.object({
  version: z.literal(1),
  activeId: z.string(),
  profiles: z.array(z.unknown()),
})

function parseStored(raw: unknown): StoredProfiles | undefined {
  const parsed = storedSchema.safeParse(raw)
  if (!parsed.success) return undefined
  const profiles = parsed.data.profiles.flatMap((p) => {
    const profile = connectionProfileSchema.safeParse(p)
    return profile.success && profile.data.id !== sameOriginProfile.id ? [profile.data] : []
  })
  return { version: 1, activeId: parsed.data.activeId, profiles }
}

export const profileStore = createLocalStore<StoredProfiles>(
  "keiro-ui.connection-profiles.v1",
  { version: 1, activeId: sameOriginProfile.id, profiles: [] },
  parseStored,
)

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

/** The base URL a surface's client uses: `origin + prefix` for same-origin profiles. */
export function surfaceBaseUrl(
  profile: ConnectionProfile,
  surface: Surface,
  origin: string,
): string {
  return profile.mode === "same-origin"
    ? `${trimTrailingSlash(origin)}${surfacePrefixes[surface]}`
    : trimTrailingSlash(profile.origins[surface])
}

/** `http` → `ws`, `https` → `wss`, then the WebSocket path (`/ws`, `/ws/events`, ...). */
export function webSocketUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/^http/, "ws")}${path.startsWith("/") ? path : `/${path}`}`
}

interface ConnectionProfilesValue {
  profiles: ConnectionProfile[]
  active: ConnectionProfile
  setActive(id: string): void
  upsert(profile: ConnectionProfile): void
  remove(id: string): void
  exportJson(): string
  importJson(json: string): { imported: number }
}

function createActions(): Omit<ConnectionProfilesValue, "profiles" | "active"> {
  return {
    setActive(id) {
      profileStore.set({ ...profileStore.get(), activeId: id })
    },
    upsert(profile) {
      if (profile.id === sameOriginProfile.id) return
      const valid = connectionProfileSchema.parse(profile)
      const current = profileStore.get()
      const exists = current.profiles.some((p) => p.id === valid.id)
      profileStore.set({
        ...current,
        profiles: exists
          ? current.profiles.map((p) => (p.id === valid.id ? valid : p))
          : [...current.profiles, valid],
      })
    },
    remove(id) {
      if (id === sameOriginProfile.id) return
      const current = profileStore.get()
      profileStore.set({
        ...current,
        activeId: current.activeId === id ? sameOriginProfile.id : current.activeId,
        profiles: current.profiles.filter((p) => p.id !== id),
      })
    },
    exportJson() {
      return JSON.stringify(profileStore.get(), null, 2)
    },
    importJson(json) {
      const parsed = parseStored(JSON.parse(json))
      if (!parsed) throw new Error("Not a keiro-ui connection profile export (version 1)")
      const current = profileStore.get()
      const byId = new Map(current.profiles.map((p) => [p.id, p]))
      for (const profile of parsed.profiles) byId.set(profile.id, profile)
      profileStore.set({ ...current, profiles: [...byId.values()] })
      return { imported: parsed.profiles.length }
    },
  }
}

const actions = createActions()

const ConnectionProfilesContext = createContext<ConnectionProfilesValue | null>(null)

export function ConnectionProfileProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(profileStore.subscribe, profileStore.get)
  const value = useMemo<ConnectionProfilesValue>(() => {
    const profiles = [sameOriginProfile, ...stored.profiles]
    const active = profiles.find((p) => p.id === stored.activeId) ?? sameOriginProfile
    return { profiles, active, ...actions }
  }, [stored])
  return (
    <ConnectionProfilesContext.Provider value={value}>
      {children}
    </ConnectionProfilesContext.Provider>
  )
}

export function useConnectionProfiles(): ConnectionProfilesValue {
  const value = useContext(ConnectionProfilesContext)
  if (!value) throw new Error("useConnectionProfiles requires <ConnectionProfileProvider>")
  const selection = useTargetSelection()
  if (selection) {
    const asProfile = (
      target: import("./connection-targets").ConnectionTarget,
    ): ConnectionProfile => ({
      id: target.id,
      name: target.label,
      mode: "separate",
      origins: { kiroku: "", pgmq: "", shibuya: "", keiro: "", ...target.surfaces },
      processManagerNames: target.processManagerNames,
      deadLetterQueueSuffix: target.deadLetterQueueSuffix,
    })
    return {
      ...value,
      profiles: selection.entries.map((e) => asProfile(e.target)),
      active: selection.selected ? asProfile(selection.selected.target) : sameOriginProfile,
      setActive: selection.chooseTarget,
    }
  }
  return value
}

export const DEFAULT_DEAD_LETTER_SUFFIX = "_dlq"

/** The profile's dead-letter queue suffix, or shibuya-pgmq-adapter's default `_dlq`. */
export function deadLetterSuffix(profile: ConnectionProfile): string {
  return profile.deadLetterQueueSuffix?.trim() || DEFAULT_DEAD_LETTER_SUFFIX
}

export function useSurfaceBaseUrl(surface: Surface): string {
  const { active } = useConnectionProfiles()
  const selected = useSelectedConnection()
  return selected
    ? (selected.endpoints[surface] ?? "")
    : surfaceBaseUrl(active, surface, window.location.origin)
}

export function useWebSocketUrl(surface: Surface, path: string): string {
  return webSocketUrl(useSurfaceBaseUrl(surface), path)
}
