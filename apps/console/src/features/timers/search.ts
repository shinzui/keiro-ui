import { z } from "zod"

import { shellSearchSchema } from "@/shell/search"

const text = z.string().min(1).optional().catch(undefined)

export const timersSearch = shellSearchSchema.extend({
  tab: z.enum(["pending", "stuck"]).optional().catch(undefined),
  manager: text,
  correlation: text,
  after: text,
  limit: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
  min_age: text,
  min_attempts: z.coerce.number().int().min(0).optional().catch(undefined),
})
export type TimersSearch = z.infer<typeof timersSearch>

/**
 * keiro-ops's duration syntax (`parseDuration` in keiro-ops/src/Keiro/Ops/Parse.hs): a finite,
 * non-negative number of seconds with an optional s, m, h, or d suffix. Returns keiro's
 * message for invalid input, or null.
 */
export function durationError(input: string): string | null {
  const match = /^(.*?)([smhd])?$/i.exec(input)
  const number = match?.[1] ?? ""
  const value = /^\d+(\.\d+)?$/.test(number) ? Number(number) : Number.NaN
  if (!Number.isFinite(value) || value < 0)
    return `invalid duration "${input}": expected a finite, non-negative number of seconds, optionally with an s, m, h, or d suffix`
  return null
}
