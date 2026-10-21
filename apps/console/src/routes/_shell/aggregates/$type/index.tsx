import { isRouteUnavailable } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { useAggregatePage } from "@/features/aggregates/queries"
import { aggregatePageSearch } from "@/features/aggregates/search"
import { NotMountedState } from "@/features/shared/NotMountedState"
import { SkippedCaption } from "@/features/shared/SkippedCaption"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/aggregates/$type/")({
  validateSearch: aggregatePageSearch,
  component: AggregateKindPage,
})

function AggregateKindPage() {
  const { type } = Route.useParams()
  const search = Route.useSearch()
  const page = useAggregatePage(type, search)
  const pager = useCursorTrail("after")
  const data = page.data
  return (
    <>
      <PageHeader
        title={type}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link {...links.aggregates()} className="underline-offset-2 hover:underline">
              Aggregates
            </Link>
            {data && (
              <>
                · category{" "}
                <Link {...links.category(data.category)}>
                  <Badge variant="outline">{data.category}</Badge>
                </Link>
              </>
            )}
          </span>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {isRouteUnavailable(page.error) ? (
          <NotMountedState family="aggregate" />
        ) : (
          <>
            {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
            {data && (
              <SkippedCaption
                skipped={data.skipped}
                category={data.category}
                what={`not instances of ${type}`}
              />
            )}
            <Table aria-label="Aggregate instances">
              <TableHeader>
                <TableHead isRowHeader>Aggregate id</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead>Truncate before</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {page.isPending ? "Loading…" : "No instances."}
                  </p>
                )}
              >
                {(data?.items ?? []).map((row) => (
                  <TableRow key={row.aggregate_id} id={row.aggregate_id}>
                    <TableCell>
                      <Link
                        {...links.aggregate(type, row.aggregate_id)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {row.aggregate_id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        {...links.stream(row.stream_name)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {row.stream_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PositionBadge value={row.stream_version} label="stream version" />
                    </TableCell>
                    <TableCell>
                      <Timestamp value={row.created_at} />
                    </TableCell>
                    <TableCell>
                      {row.deleted_at ? <Timestamp value={row.deleted_at} /> : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.truncate_before > 0n ? row.truncate_before.toString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <CursorPager
              cursor={search.after}
              nextCursor={data?.nextCursor}
              trail={pager.trail}
              onNavigate={pager.go}
              itemCount={data?.items.length}
            />
          </>
        )}
      </div>
    </>
  )
}
