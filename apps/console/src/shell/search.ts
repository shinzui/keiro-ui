import { z } from "zod"

/** Search parameters every page under the shell layout accepts. */
export const shellSearchSchema = z.object({
  target: z.string().optional(),
  worker: z.string().optional(),
  sheet: z.string().optional(),
})
export type ShellSearch = z.infer<typeof shellSearchSchema>
