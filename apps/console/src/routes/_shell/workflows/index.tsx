import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/workflows/")({
  validateSearch: shellSearchSchema.extend({
    status_class: z.array(z.string()).optional(),
    workflow_name: z.string().optional(),
  }),
  component: Page,
})

function Page() {
  return <PlaceholderPage title={"Workflows"} plan="docs/plans/15-build-the-workflows-screens.md" />
}
