import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/categories/$name")({
  validateSearch: shellSearchSchema.extend({
    from: z.string().optional(),
  }),
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Category ${params.name}`}
      plan="docs/plans/13-build-the-streams-and-subscriptions-screens.md"
    />
  )
}
