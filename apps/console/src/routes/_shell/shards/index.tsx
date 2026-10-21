import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/shards/")({
  validateSearch: shellSearchSchema.extend({
    subscription: z.string().optional(),
  }),
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Shards"}
      plan="docs/plans/17-build-the-projections-and-overview-screens.md"
    />
  )
}
