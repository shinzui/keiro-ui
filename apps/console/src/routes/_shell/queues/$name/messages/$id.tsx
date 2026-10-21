import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/queues/$name/messages/$id")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  return (
    <PlaceholderPage
      title={`Message ${params.id} in ${params.name}`}
      plan="docs/plans/14-build-the-queues-and-processors-screens.md"
    />
  )
}
