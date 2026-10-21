import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/aggregates/$type/")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Aggregate type ${params.type}`}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
