import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/aggregates/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Aggregates"}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
