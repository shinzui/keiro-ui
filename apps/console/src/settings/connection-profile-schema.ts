import { z } from "zod"

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
