import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/subscriptions/")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Subscriptions"}
      plan="docs/plans/13-build-the-streams-and-subscriptions-screens.md"
    />
  )
}
