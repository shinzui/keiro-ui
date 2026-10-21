import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

// Message ids stay decimal strings in the URL: they are int64 and can exceed 2^53.

export const queueSorts = ["oldest", "newest", "visible", "total", "name"] as const

export const queuesSearch = shellSearchSchema.extend({
  q: z.string().optional(),
  sort: z.enum(queueSorts).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
})
export type QueuesSearch = z.infer<typeof queuesSearch>

export const queueTabs = ["messages", "archive", "bindings"] as const
export type QueueTab = (typeof queueTabs)[number]

export const queueSearch = shellSearchSchema.extend({
  tab: z.enum(queueTabs).optional().catch(undefined),
  from: z.string().regex(/^\d+$/).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
})
export type QueueSearch = z.infer<typeof queueSearch>
