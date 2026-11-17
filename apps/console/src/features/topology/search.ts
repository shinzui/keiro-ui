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

/** The map's view: which kind groups are drawn, and an optional focus and its reach. */
export const topologyMapSearch = shellSearchSchema.extend({
  /** Comma-separated kind group ids; absent means every group. */
  groups: z.string().optional().catch(undefined),
  /** A node key (`kind:name`): only its neighbourhood is drawn. */
  focus: z.string().optional().catch(undefined),
  /** How many relations away from the focus to draw. */
  depth: z.coerce.number().int().min(1).max(2).optional().catch(undefined),
})
export type TopologyMapSearch = z.infer<typeof topologyMapSearch>
