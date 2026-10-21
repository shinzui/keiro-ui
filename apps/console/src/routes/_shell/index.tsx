import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Overview"}
      plan="docs/plans/17-build-the-projections-and-overview-screens.md"
    />
  )
}
