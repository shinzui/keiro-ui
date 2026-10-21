import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { ProjectionTable } from "@/features/projections/projection-table"
import { useProjectionStatus } from "@/features/projections/queries"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { useLiveness } from "@/shell/liveness"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/projections/")({
  validateSearch: shellSearchSchema.extend({
    after: z.string().min(1).optional().catch(undefined),
  }),
  component: ProjectionsPage,
})

const feedCaption = {
  live: "live",
  reconnecting: "reconnecting the feed",
  read_failed: "the feed's last read failed; polling",
  off: "polling",
} as const

function ProjectionsPage() {
  const search = Route.useSearch()
  const { page, feedStatus } = useProjectionStatus(search.after)
  const { paused } = useLiveness()
  const pager = useCursorTrail("after")
  const data = page.data
  return (
    <>
      <PageHeader
        title="Projections"
        description={
          <span className="flex flex-wrap items-center gap-x-2" data-testid="projections-caption">
            {data?.visible_store_head !== undefined && (
              <span>
                visible store head{" "}
                <PositionBadge value={data.visible_store_head} label="visible store head" />
              </span>
            )}
            {data?.observed_at && (
              <span>
                · as of <Timestamp value={data.observed_at} />
              </span>
            )}
            <span>
              ·{" "}
              {paused
                ? "paused"
                : search.after !== undefined
                  ? "polling (later pages are poll-only)"
                  : feedCaption[feedStatus]}
            </span>
          </span>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
        <ProjectionTable
          groups={data?.items ?? []}
          head={data?.visible_store_head}
          isPending={page.isPending}
        />
        <CursorPager
          cursor={search.after}
          nextCursor={data?.nextCursor}
          trail={pager.trail}
          onNavigate={pager.go}
          itemCount={data?.items.length}
        />
        <p className="text-xs text-muted-foreground">
          Rebuild and promotion are operator-CLI actions in this release.
        </p>
      </div>
    </>
  )
}
