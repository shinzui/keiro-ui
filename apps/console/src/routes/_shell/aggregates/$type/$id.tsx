import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/aggregates/$type/$id")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Aggregate ${params.type}/${params.id}`}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
