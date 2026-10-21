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

import { PageHeader } from "@/components/page-header"
import { useAggregateTypes } from "@/features/aggregates/queries"
import { NotMountedState } from "@/features/shared/NotMountedState"
import { links } from "@/lib/links"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/aggregates/")({
  validateSearch: shellSearchSchema,
  component: AggregateKindsPage,
})

function AggregateKindsPage() {
  const types = useAggregateTypes()
  return (
    <>
      <PageHeader
        title="Aggregates"
        description="Each kind's instances are streams in its category; open one to see its events beside its folded state."
      />
      <div className="flex flex-col gap-3 p-6">
        {isRouteUnavailable(types.error) ? (
          <NotMountedState family="aggregate" />
        ) : (
          <>
            {types.isError && <p className="text-sm text-destructive">{types.error.message}</p>}
            <Table aria-label="Aggregate kinds">
              <TableHeader>
                <TableHead isRowHeader>Kind</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Snapshots</TableHead>
                <TableHead>Snapshot policy</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {types.isPending ? "Loading…" : "The host registers no aggregate kinds."}
                  </p>
                )}
              >
                {(types.data?.items ?? []).map((kind) => (
                  <TableRow key={kind.name} id={kind.name}>
                    <TableCell>
                      <Link
                        {...links.aggregateType(kind.name)}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {kind.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link {...links.category(kind.category)}>
                        <Badge variant="outline">{kind.category}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={kind.snapshots_configured ? "secondary" : "outline"}>
                        {kind.snapshots_configured ? "configured" : "off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{kind.snapshot_policy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </>
  )
}
