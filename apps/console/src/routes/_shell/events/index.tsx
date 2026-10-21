import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/events/")({
  validateSearch: shellSearchSchema.extend({
    from: z.string().optional(),
    direction: z.enum(["forward", "backward"]).optional(),
  }),
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"All events"}
      plan="docs/plans/13-build-the-streams-and-subscriptions-screens.md"
    />
  )
}
