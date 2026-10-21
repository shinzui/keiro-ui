import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/workflows/$name/$id")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const params = Route.useParams()
  // Recorded here so Recent is exercisable before the Workflows screens exist.
  useRecordVisit({
    kind: "workflow",
    label: `${params.name} / ${params.id}`,
    href: hrefOf(links.workflow(params.name, params.id)),
  })
  return (
    <PlaceholderPage
      title={`Workflow ${params.name} / ${params.id}`}
      plan="docs/plans/15-build-the-workflows-screens.md"
    />
  )
}
