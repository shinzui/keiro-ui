import { z } from "zod"

/** Search parameters every page under the shell layout accepts. */
export const shellSearchSchema = z.object({
  sheet: z.string().optional(),
})
export type ShellSearch = z.infer<typeof shellSearchSchema>
