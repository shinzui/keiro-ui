import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/processors/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Processors"}
      plan="docs/plans/14-build-the-queues-and-processors-screens.md"
    />
  )
}
