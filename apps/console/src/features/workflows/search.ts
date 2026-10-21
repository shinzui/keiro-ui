import { StatusClass } from "@keiro-ui/client-keiro"
import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

// Every list filter lives in the URL. A malformed value is dropped (`.catch(undefined)`), so a
// hand-edited URL still renders the list with the remaining filters.

export const STATUS_CLASSES = StatusClass.options
export const DEFAULT_LIMIT = 100

/** `?status_class=a&status_class=b` parses as an array, a single key as a string. */
const statusClasses = z
  .union([z.array(StatusClass), StatusClass])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional()
  .catch(undefined)
const instant = z.iso.datetime({ offset: true }).optional().catch(undefined)

export const workflowsSearch = shellSearchSchema.extend({
  status_class: statusClasses,
  workflow_name: z.string().min(1).optional().catch(undefined),
  created_since: instant,
  created_before: instant,
  updated_since: instant,
  updated_before: instant,
  ordering: z.enum(["key", "created_desc"]).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
  after: z.string().min(1).optional().catch(undefined),
})
export type WorkflowsSearch = z.infer<typeof workflowsSearch>

export const workflowTabs = ["journal", "steps", "children", "awakeables"] as const
export type WorkflowTab = (typeof workflowTabs)[number]
export const journalLenses = ["all", "steps", "errors"] as const
export type JournalLens = (typeof journalLenses)[number]

export const workflowSearch = shellSearchSchema.extend({
  tab: z.enum(workflowTabs).optional().catch(undefined),
  generation: z.coerce.number().int().min(0).optional().catch(undefined),
  lens: z.enum(journalLenses).optional().catch(undefined),
})
export type WorkflowSearch = z.infer<typeof workflowSearch>

/** The search keys a filter change keeps; `after` is dropped because a cursor is query-bound. */
export function withFilter(
  search: WorkflowsSearch,
  change: Partial<Omit<WorkflowsSearch, "after" | "sheet">>,
): WorkflowsSearch {
  return { ...search, ...change, after: undefined }
}
