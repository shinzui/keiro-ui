import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/projections/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Projections"}
      plan="docs/plans/17-build-the-projections-and-overview-screens.md"
    />
  )
}
