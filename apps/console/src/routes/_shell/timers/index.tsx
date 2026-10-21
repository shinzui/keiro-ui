import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/timers/")({
  validateSearch: shellSearchSchema.extend({
    manager: z.string().optional(),
    correlation: z.string().optional(),
    tab: z.enum(["pending", "stuck"]).optional(),
  }),
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Timers"}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
