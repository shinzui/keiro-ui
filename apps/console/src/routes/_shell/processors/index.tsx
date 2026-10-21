import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { ProcessorTable } from "@/features/processors/processor-table"
import { useNow, useProcessors } from "@/features/processors/queries"
import { ReadinessSummary } from "@/features/processors/readiness-summary"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/processors/")({
  validateSearch: shellSearchSchema,
  component: ProcessorsPage,
})

function ProcessorsPage() {
  const processors = useProcessors()
  const now = useNow()
  return (
    <>
      <PageHeader title="Processors" description={<ReadinessSummary />} />
      <div className="flex flex-col gap-3 p-6">
        {processors.error && <p className="text-sm text-destructive">{processors.error.message}</p>}
        <ProcessorTable rows={processors.rows} now={now} isPending={processors.isPending} />
      </div>
    </>
  )
}
