import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react"
import { z } from "zod"

import { createLocalStore } from "@/shell/local-store"

export type Surface = "kiroku" | "shibuya" | "pgmq" | "keiro"

export const surfaces: readonly Surface[] = ["kiroku", "shibuya", "pgmq", "keiro"]

/** The prefixes keiro's composeSurfaces mounts the surfaces under (and the dev proxy serves). */
export const surfacePrefixes: Record<Surface, string> = {
  kiroku: "/kiroku",
  shibuya: "/shibuya",
  pgmq: "/pgmq",
  keiro: "/keiro",
}

export interface ConnectionProfile {
  id: string
  name: string
  mode: "same-origin" | "separate"
  /** same-origin: ignored; separate: "https://host:port" for each surface. */
  origins: Record<Surface, string>
  /** keiro exposes no process-manager name discovery; the process-manager screens read this. */
  processManagerNames?: string[]
  /** Default "_dlq"; the gated-actions plan uses it to recognise dead-letter queues. */
  deadLetterQueueSuffix?: string
}

/**
 * An absolute http(s) origin with no path, query, or fragment — the only shape the
 * surfaces' CORS allow-lists accept.
 */
export const originSchema = z.string().superRefine((value, ctx) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Origin must be an absolute URL such as http://127.0.0.1:9092",
    })
    return
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    ctx.addIssue({ code: "custom", message: "Origin must use http or https" })
  } else if (url.username || url.password) {
    ctx.addIssue({ code: "custom", message: "Origin must not contain credentials" })
  } else if (url.search || value.includes("?")) {
    ctx.addIssue({ code: "custom", message: "Origin must not contain a query" })
  } else if (url.hash || value.includes("#")) {
    ctx.addIssue({ code: "custom", message: "Origin must not contain a fragment" })
  } else if (url.pathname !== "/" || /^[a-z]+:\/\/[^/]+\/./i.test(value)) {
    ctx.addIssue({ code: "custom", message: "Origin must not contain a path" })
  }
})

const originsShape = z.object({
  kiroku: z.string(),
  shibuya: z.string(),
  pgmq: z.string(),
  keiro: z.string(),
})

export const connectionProfileSchema: z.ZodType<ConnectionProfile> = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Name is required"),
    mode: z.enum(["same-origin", "separate"]),
    origins: originsShape,
    processManagerNames: z.array(z.string()).optional(),
    deadLetterQueueSuffix: z.string().optional(),
  })
  .superRefine((profile, ctx) => {
    if (profile.mode !== "separate") return
    for (const surface of surfaces) {
      const result = originSchema.safeParse(profile.origins[surface])
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["origins", surface],
          message: result.error.issues[0]?.message ?? "Invalid origin",
        })
      }
    }
  })

const emptyOrigins: Record<Surface, string> = { kiroku: "", shibuya: "", pgmq: "", keiro: "" }

export const sameOriginProfile: ConnectionProfile = {
  id: "same-origin",
  name: "Same origin",
  mode: "same-origin",
  origins: emptyOrigins,
}

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
  return value
}

export const DEFAULT_DEAD_LETTER_SUFFIX = "_dlq"

/** The profile's dead-letter queue suffix, or shibuya-pgmq-adapter's default `_dlq`. */
export function deadLetterSuffix(profile: ConnectionProfile): string {
  return profile.deadLetterQueueSuffix?.trim() || DEFAULT_DEAD_LETTER_SUFFIX
}

export function useSurfaceBaseUrl(surface: Surface): string {
  const { active } = useConnectionProfiles()
  return surfaceBaseUrl(active, surface, window.location.origin)
}

export function useWebSocketUrl(surface: Surface, path: string): string {
  return webSocketUrl(useSurfaceBaseUrl(surface), path)
}
