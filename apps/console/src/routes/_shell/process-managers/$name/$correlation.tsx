import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/process-managers/$name/$correlation")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Process manager ${params.name} / ${params.correlation}`}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
