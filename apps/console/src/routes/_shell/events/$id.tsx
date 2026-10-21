import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/events/$id")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Event ${params.id}`}
      plan="docs/plans/13-build-the-streams-and-subscriptions-screens.md"
    />
  )
}
