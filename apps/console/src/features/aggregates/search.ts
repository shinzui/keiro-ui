import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

const limit = z.coerce.number().int().min(1).max(500).optional().catch(undefined)

/** Instance pages of one kind (`after` is keiro's opaque cursor). */
export const aggregatePageSearch = shellSearchSchema.extend({
  after: z.string().min(1).optional().catch(undefined),
  limit,
})

/** The browser's left pane: kiroku stream paging, newest first by default. */
export const aggregateBrowserSearch = shellSearchSchema.extend({
  from: z.string().regex(/^\d+$/).optional().catch(undefined),
  direction: z.enum(["forward", "backward"]).optional().catch(undefined),
})
