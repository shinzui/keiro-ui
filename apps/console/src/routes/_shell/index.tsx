import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { Overview } from "@/features/overview/overview"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/")({
  validateSearch: shellSearchSchema,
  component: OverviewPage,
})

function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Each card reads one surface; click a card to open its section."
      />
      <Overview />
    </>
  )
}
