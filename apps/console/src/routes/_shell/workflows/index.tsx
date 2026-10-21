import { isApiError } from "@keiro-ui/client-core"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { Timestamp } from "@/components/timestamp"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { WorkflowFilters } from "@/features/workflows/components/WorkflowFilters"
import { WorkflowTable } from "@/features/workflows/components/WorkflowTable"
import { useDepartures } from "@/features/workflows/departures"
import { useWorkflowList } from "@/features/workflows/queries"
import { withFilter, workflowsSearch } from "@/features/workflows/search"
import { useLiveness } from "@/shell/liveness"

export const Route = createFileRoute("/_shell/workflows/")({
  validateSearch: workflowsSearch,
  component: WorkflowsPage,
})

const feedCaption = {
  live: "live",
  reconnecting: "reconnecting the feed",
  read_failed: "the feed's last read failed; polling",
  off: "polling",
} as const

function WorkflowsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { page, feedStatus, pollOnlyReason } = useWorkflowList(search)
  const { paused } = useLiveness()
  const pager = useCursorTrail("after")
  const items = page.data?.items ?? []
  const departed = useDepartures(
    items.map((wf) => `${wf.workflow_name}/${wf.workflow_id}`),
    search.after === undefined && feedStatus === "live",
  )

  // A cursor is bound to the query that produced it; a stale one restarts at page one.
  const staleCursor = isApiError(page.error, "invalid_cursor") && search.after !== undefined
  useEffect(() => {
    if (!staleCursor) return
    pager.reset()
    void navigate({ search: (prev) => ({ ...prev, after: undefined }), replace: true })
  }, [staleCursor, navigate, pager])

  return (
    <>
      <PageHeader
        title="Workflows"
        description={
          <span className="flex flex-wrap items-center gap-x-2" data-testid="list-caption">
            {page.data?.observed_at && (
              <span>
                as of <Timestamp value={page.data.observed_at} />
              </span>
            )}
            <span>
              ·{" "}
              {paused
                ? "paused"
                : pollOnlyReason
                  ? `polling (${pollOnlyReason})`
                  : feedCaption[feedStatus]}
            </span>
          </span>
        }
      >
        <WorkflowFilters
          search={search}
          onChange={(change) => {
            pager.reset()
            void navigate({ search: (prev) => withFilter(prev, change) })
          }}
        />
      </PageHeader>
      <div className="flex flex-col gap-3 p-6">
        {page.isError && !staleCursor && (
          <p className="text-sm text-destructive">{page.error.message}</p>
        )}
        {departed.length > 0 && (
          <p className="text-xs text-muted-foreground" role="status">
            Moved off this page: {departed.join(", ")}
          </p>
        )}
        <WorkflowTable items={items} isPending={page.isPending} />
        <CursorPager
          cursor={search.after}
          nextCursor={page.data?.nextCursor}
          trail={pager.trail}
          onNavigate={pager.go}
          itemCount={page.data?.items.length}
        />
      </div>
    </>
  )
}
