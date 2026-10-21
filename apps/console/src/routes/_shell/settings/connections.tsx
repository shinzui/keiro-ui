import { createFileRoute } from "@tanstack/react-router"

import { ConnectionsPage } from "@/settings/connections-page"

export const Route = createFileRoute("/_shell/settings/connections")({
  component: ConnectionsPage,
})
