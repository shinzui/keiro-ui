import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

// Cursors stay strings in the URL: positions and versions can exceed 2^53 and become bigint only
// when the client is called.
const limit = z.coerce.number().int().min(1).max(1000).optional().catch(undefined)
const cursor = z.string().optional()

export const DEFAULT_LIMIT = 100

export const streamsSearch = shellSearchSchema.extend({
  category: z.string().optional(),
  prefix: z.string().optional(),
  from: cursor,
  limit,
})
export const streamEventsSearch = shellSearchSchema.extend({
  from: cursor,
  direction: z.enum(["forward", "backward"]).optional(),
  limit,
})
export const categoriesSearch = shellSearchSchema.extend({ from: cursor, limit })
export const categoryEventsSearch = shellSearchSchema.extend({
  from: cursor,
  limit,
  follow: z.enum(["1"]).optional(),
})
export const allEventsSearch = shellSearchSchema.extend({
  from: cursor,
  direction: z.enum(["forward", "backward"]).optional(),
  category: z.string().optional(),
  limit,
})
export const deadLettersSearch = shellSearchSchema.extend({
  from: cursor,
  member: z.coerce.number().int().min(0).optional().catch(undefined),
  limit,
})

/** A position cursor from the URL, or undefined when absent or malformed. */
export function positionFrom(text: string | undefined): bigint | undefined {
  return text !== undefined && /^\d+$/.test(text) ? BigInt(text) : undefined
}
