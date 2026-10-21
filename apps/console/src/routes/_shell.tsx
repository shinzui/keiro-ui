import { createFileRoute } from "@tanstack/react-router"

import { AppShell } from "@/shell/app-shell"
import { shellSearchSchema } from "@/shell/search"

// The pathless layout every page lives under; a future full-screen route can opt out by
// living beside it instead.
export const Route = createFileRoute("/_shell")({
  validateSearch: shellSearchSchema,
  component: AppShell,
})
