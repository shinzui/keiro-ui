import { isRouteUnavailable } from "@keiro-ui/client-keiro"
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
import { aggregatePageSearch } from "@/features/aggregates/search"
import { useInstancePage } from "@/features/process-managers/queries"
import { NotMountedState } from "@/features/shared/NotMountedState"
import { SkippedCaption } from "@/features/shared/SkippedCaption"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/process-managers/$name/")({
  validateSearch: aggregatePageSearch,
  component: ManagerPage,
})

function ManagerPage() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  const page = useInstancePage(name, search)
  const pager = useCursorTrail("after")
  const error: unknown = page.error
  return (
    <>
      <PageHeader
        title={name}
        description={
          <Link {...links.processManagers()} className="underline-offset-2 hover:underline">
            Process managers
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {isRouteUnavailable(error) ? (
          <NotMountedState family="pm" />
        ) : (
          <>
            {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
            {page.data && (
              <SkippedCaption
                skipped={page.data.skipped}
                category={name}
                what="not journals of this manager"
              />
            )}
            <Table aria-label="Process manager instances">
              <TableHeader>
                <TableHead isRowHeader>Correlation</TableHead>
                <TableHead>Journal stream</TableHead>
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
                {(page.data?.items ?? []).map((row) => (
                  <TableRow key={row.correlation_id} id={row.correlation_id}>
                    <TableCell>
                      <Link
                        {...links.processManagerInstance(name, row.correlation_id)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {row.correlation_id}
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
              nextCursor={page.data?.nextCursor}
              trail={pager.trail}
              onNavigate={pager.go}
              itemCount={page.data?.items.length}
            />
          </>
        )}
      </div>
    </>
  )
}
