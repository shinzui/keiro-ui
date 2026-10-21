import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/queues/$name/")({
  validateSearch: shellSearchSchema.extend({
    tab: z.enum(["messages", "archive", "bindings"]).optional(),
  }),
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Queue ${params.name}`}
      plan="docs/plans/14-build-the-queues-and-processors-screens.md"
    />
  )
}
