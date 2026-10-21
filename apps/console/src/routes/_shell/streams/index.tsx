import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlaceholderPage } from "@/components/placeholder-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/streams/")({
  validateSearch: shellSearchSchema.extend({
    category: z.string().optional(),
    prefix: z.string().optional(),
  }),
  component: Page,
})

function Page() {
  return (
    <PlaceholderPage
      title={"Streams"}
      plan="docs/plans/13-build-the-streams-and-subscriptions-screens.md"
    />
  )
}
