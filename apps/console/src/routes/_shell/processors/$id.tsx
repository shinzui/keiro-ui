import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { createFileRoute, Link } from "@tanstack/react-router"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { ProcessorDetail } from "@/features/processors/processor-detail"
import { useMissingProcessor, useNow, useProcessors } from "@/features/processors/queries"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/processors/$id")({
  validateSearch: shellSearchSchema,
  component: ProcessorPage,
})

function ProcessorPage() {
  const { id } = Route.useParams()
  const processors = useProcessors()
  const now = useNow()
  const row = processors.rows.find((r) => r.id === id)
  const missing = !processors.isPending && !processors.error && !row
  const probe = useMissingProcessor(id, missing)
  useRecordVisit({ kind: "processor", label: id, href: hrefOf(links.processor(id)) })
  return (
    <>
      <PageHeader
        title={id}
        description={
          <Link {...links.processors()} className="underline-offset-2 hover:underline">
            Processors
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {processors.error && <p className="text-sm text-destructive">{processors.error.message}</p>}
        {processors.isPending && <Skeleton className="h-48" />}
        {row && <ProcessorDetail row={row} now={now} />}
        {missing && (
          <EmptyState
            title="Processor not found"
            description={
              probe.isError
                ? probe.error.message
                : "The metrics server does not list this processor."
            }
          />
        )}
      </div>
    </>
  )
}
