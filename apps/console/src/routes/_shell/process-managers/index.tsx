import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/process-managers/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Process managers"}
      plan="docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md"
    />
  )
}
