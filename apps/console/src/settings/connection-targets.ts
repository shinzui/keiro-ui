import { z } from "zod"

import {
  connectionProfileSchema,
  type ConnectionProfile,
  surfacePrefixes,
  surfaces,
  type Surface,
} from "./connection-profile-schema"

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const label = z.string().trim().min(1)

/** Check spelling before URL parsing removes dot segments. */
export function normalizeEndpoint(value: string, origin: string): string {
  if (!value || value !== value.trim() || /[\\?#\s]/.test(value) || value.startsWith("//"))
    throw new Error(
      "Endpoint must be an HTTP(S) base URL or root-relative path without credentials, query, fragment or backslashes",
    )
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value))
    throw new Error("Endpoint must use HTTP(S) or a root-relative path")
  let decoded = value
  for (let count = 0; count < 5; count++) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new Error("Invalid endpoint encoding")
    }
    if (/[\\?#]/.test(next) || next.split("/").some((part) => part === "." || part === ".."))
      throw new Error("Endpoint must not contain traversal or encoded separators")
    if (next === decoded) break
    decoded = next
    if (count === 4) throw new Error("Excessively encoded endpoint")
  }
  const url = new URL(value, origin)
  if (!/^https?:$/.test(url.protocol) || url.username || url.password)
    throw new Error("Endpoint must use HTTP(S) without credentials")
  if (new URL(origin).protocol === "https:" && url.protocol === "http:")
    throw new Error("Mixed content: HTTPS consoles require HTTPS inspection endpoints")
  return url.href.replace(/\/+$/, "")
}

const endpoint = z.string().superRefine((value, ctx) => {
  try {
    normalizeEndpoint(value, "http://console.invalid")
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message })
  }
})

function targetSchema(id: z.ZodString) {
  return z
    .object({
      id,
      label,
      app: label,
      environment: label,
      surfaces: z
        .object({
          keiro: endpoint.optional(),
          kiroku: endpoint.optional(),
          pgmq: endpoint.optional(),
          shibuya: endpoint.optional(),
        })
        .strict(),
      workers: z
        .array(z.object({ id: identifier, label, shibuyaBaseUrl: endpoint }).strict())
        .optional(),
      defaultWorkerId: identifier.optional(),
      processManagerNames: z.array(z.string()).optional(),
      deadLetterQueueSuffix: z.string().optional(),
    })
    .strict()
    .superRefine((target, ctx) => {
      const workers = target.workers ?? []
      const issue = (message: string) => ctx.addIssue({ code: "custom", message })
      if (!Object.values(target.surfaces).some(Boolean) && !workers.length)
        issue("At least one surface or worker is required")
      if (workers.length && target.surfaces.shibuya)
        issue("Workers and a direct Shibuya endpoint are mutually exclusive")
      if (new Set(workers.map((w) => w.id)).size !== workers.length) issue("Duplicate worker ID")
      if (target.defaultWorkerId && !workers.some((w) => w.id === target.defaultWorkerId))
        issue("Unknown default worker")
    })
}

export const connectionTargetSchema = targetSchema(z.string().min(1))
export const managedTargetSchema = targetSchema(identifier)
export type ConnectionTarget = z.infer<typeof connectionTargetSchema>
export type WorkerTarget = NonNullable<ConnectionTarget["workers"]>[number]
export type TargetSource = "managed" | "local" | "builtin"
export interface SelectedConnection {
  target: ConnectionTarget
  worker?: WorkerTarget
  source: TargetSource
  endpoints: Partial<Record<Surface, string>>
  sessionKey: string
}

export const runtimeConsoleConfigSchema = z
  .object({
    version: z.literal(1),
    defaultTargetId: identifier.optional(),
    targets: z.array(managedTargetSchema),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (new Set(config.targets.map((t) => t.id)).size !== config.targets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate target ID" })
    if (config.defaultTargetId && !config.targets.some((t) => t.id === config.defaultTargetId))
      ctx.addIssue({ code: "custom", message: "Unknown default target" })
  })
export type RuntimeConsoleConfig = z.infer<typeof runtimeConsoleConfigSchema>
export const storedTargetsSchema = z
  .object({
    version: z.literal(2),
    activeId: z.string().optional(),
    targets: z.array(connectionTargetSchema),
  })
  .strict()
  .superRefine((stored, ctx) => {
    if (new Set(stored.targets.map((t) => t.id)).size !== stored.targets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate local target ID" })
    if (stored.targets.some((t) => t.id === "same-origin"))
      ctx.addIssue({ code: "custom", message: "The built-in target ID is reserved" })
  })
export type StoredTargets = z.infer<typeof storedTargetsSchema>
export const TARGET_STORAGE_KEY = "keiro-ui.connection-targets.v2"
export const builtinTarget: ConnectionTarget = {
  id: "same-origin",
  label: "Same origin",
  app: "same-origin",
  environment: "local",
  surfaces: { ...surfacePrefixes },
}

export function migrateProfile(profile: ConnectionProfile): ConnectionTarget {
  return connectionTargetSchema.parse({
    id: profile.id,
    label: profile.name,
    app: profile.id.trim() || profile.name,
    environment: "local",
    surfaces: profile.mode === "same-origin" ? { ...surfacePrefixes } : { ...profile.origins },
    processManagerNames: profile.processManagerNames,
    deadLetterQueueSuffix: profile.deadLetterQueueSuffix,
  })
}

export function migrateV1(raw: unknown): StoredTargets {
  const old = z
    .object({
      version: z.literal(1),
      activeId: z.string(),
      profiles: z.array(connectionProfileSchema),
    })
    .parse(raw)
  return storedTargetsSchema.parse({
    version: 2,
    activeId: old.activeId,
    targets: old.profiles.filter((p) => p.id !== "same-origin").map(migrateProfile),
  })
}

/** Validate everything before writing; v1 remains untouched for rollback. */
export function loadLocalTargets(storage: Storage): StoredTargets {
  const v2 = storage.getItem(TARGET_STORAGE_KEY)
  if (v2 !== null) return storedTargetsSchema.parse(JSON.parse(v2))
  const v1 = storage.getItem("keiro-ui.connection-profiles.v1")
  const stored: StoredTargets =
    v1 === null ? { version: 2, targets: [] } : migrateV1(JSON.parse(v1))
  storage.setItem(TARGET_STORAGE_KEY, JSON.stringify(stored))
  return stored
}

export function selectConnection(
  target: ConnectionTarget,
  source: TargetSource,
  workerId: string | undefined,
  origin: string,
): SelectedConnection {
  const worker = target.workers?.find((w) => w.id === workerId)
  const endpoints: SelectedConnection["endpoints"] = {}
  for (const surface of surfaces) {
    const raw =
      surface === "shibuya" && target.workers?.length
        ? worker?.shibuyaBaseUrl
        : target.surfaces[surface]
    if (raw) endpoints[surface] = normalizeEndpoint(raw, origin)
  }
  const sessionKey = JSON.stringify([
    source,
    target.id,
    target.app,
    target.environment,
    workerId,
    endpoints,
    target.processManagerNames ?? [],
    target.deadLetterQueueSuffix ?? "_dlq",
  ])
  return { target, source, worker, endpoints, sessionKey }
}
