import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/queues/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Queues"}
      plan="docs/plans/14-build-the-queues-and-processors-screens.md"
    />
  )
}
