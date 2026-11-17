import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

/** The inventory's filters live in the URL so a filtered view can be shared. */
export const topologySearch = shellSearchSchema.extend({
  /** Matches a declaration's name or stable name, case-insensitively. */
  q: z.string().optional().catch(undefined),
  /** One node kind; an unknown value is ignored by the page, not rejected. */
  kind: z.string().optional().catch(undefined),
})
export type TopologySearch = z.infer<typeof topologySearch>
