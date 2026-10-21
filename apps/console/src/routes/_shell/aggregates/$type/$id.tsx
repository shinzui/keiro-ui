import { isApiError } from "@keiro-ui/client-core"
import { isRouteUnavailable } from "@keiro-ui/client-keiro"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { createFileRoute, Link } from "@tanstack/react-router"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { FoldedStatePane } from "@/features/aggregates/FoldedStatePane"
import { useAggregate } from "@/features/aggregates/queries"
import { aggregateBrowserSearch } from "@/features/aggregates/search"
import { StreamEventsPane } from "@/features/aggregates/StreamEventsPane"
import { NotMountedState } from "@/features/shared/NotMountedState"
import { SplitPane } from "@/features/shared/SplitPane"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

export const Route = createFileRoute("/_shell/aggregates/$type/$id")({
  validateSearch: aggregateBrowserSearch,
  component: AggregateBrowserPage,
})

function AggregateBrowserPage() {
  const { type, id } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const view = useAggregate(type, id)
  // The client rethrows refusals as typed errors, so the query's error is wider than ApiError.
  const error: unknown = view.error
  useRecordVisit({
    kind: "aggregate",
    label: `${type} / ${id}`,
    href: hrefOf(links.aggregate(type, id)),
  })
  return (
    <>
      <PageHeader
        title={id}
        description={
          <Link {...links.aggregateType(type)} className="underline-offset-2 hover:underline">
            {type}
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {isRouteUnavailable(error) ? (
          <NotMountedState family="aggregate" />
        ) : isApiError(error, "command_failed") ? (
          <EmptyState title="No such aggregate" description={error.message} />
        ) : (
          <>
            {view.isError && <p className="text-sm text-destructive">{view.error.message}</p>}
            <SplitPane
              storageKey="keiro-ui.split.aggregate-browser"
              left={
                <StreamEventsPane
                  streamName={view.data?.stream_name}
                  from={search.from}
                  direction={search.direction ?? "backward"}
                  onDirection={(direction) =>
                    void navigate({ search: (prev) => ({ ...prev, direction, from: undefined }) })
                  }
                />
              }
              right={
                view.data ? <FoldedStatePane view={view.data} /> : <Skeleton className="h-64" />
              }
            />
            {view.data && (
              <p className="text-xs text-muted-foreground">
                Projections consuming category {view.data.category}: see{" "}
                <Link {...links.projections()} className="underline-offset-2 hover:underline">
                  Projections
                </Link>{" "}
                (keiro exposes no per-category projection mapping).
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
