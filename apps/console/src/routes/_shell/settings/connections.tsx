import { createFileRoute } from "@tanstack/react-router"

import { PlaceholderPage } from "@/components/placeholder-page"

export const Route = createFileRoute("/_shell/settings/connections")({
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title="Connections"
      plan="docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md (Milestone 4)"
    />
  )
}
