import { isApiError } from "@keiro-ui/client-core"
import {
  useKirokuCapabilities,
  useKirokuCheckpoints,
  useKirokuLiveSubscriptions,
  useKirokuMetrics,
} from "@keiro-ui/client-kiroku"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { createFileRoute, Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { groupCheckpoints } from "@/features/streams/subscriptions"
import { formatInt, formatPositionDistance } from "@/lib/format"
import { links } from "@/lib/links"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/subscriptions/")({
  validateSearch: shellSearchSchema,
  component: SubscriptionsPage,
})

function SubscriptionsPage() {
  const inventory = useKirokuCheckpoints()
  const live = useKirokuLiveSubscriptions()
  const capabilities = useKirokuCapabilities()
  const metricsMounted = capabilities.data?.routes.metrics !== false
  const metrics = useKirokuMetrics()
  const liveUnconfigured = live.isError && isApiError(live.error) && live.error.status === 404
  const groups = groupCheckpoints(inventory.data, live.data)
  const storePosition = inventory.data?.store_position

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description={
          <span className="flex items-center gap-2">
            Durable checkpoints. Store head (store_position):{" "}
            <PositionBadge value={storePosition} label="store position" />
          </span>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {inventory.isError && <p className="text-sm text-destructive">{inventory.error.message}</p>}
        {liveUnconfigured && (
          <p className="text-xs text-muted-foreground">
            live registry not configured on this surface
          </p>
        )}
        <Table aria-label="Subscription checkpoints">
          <TableHeader>
            <TableHead isRowHeader>Subscription</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>Checkpoint</TableHead>
            <TableHead>Distance to head</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Live (process-local)</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {inventory.isPending ? "Loading…" : "No durable checkpoints."}
              </p>
            )}
          >
            {groups.flatMap((group) =>
              group.members.map((row) => (
                <TableRow
                  key={`${group.subscription}/${row.member}`}
                  id={`${group.subscription}/${row.member}`}
                >
                  <TableCell>
                    <Link
                      {...links.subscription(group.subscription)}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {group.subscription}
                    </Link>
                  </TableCell>
                  <TableCell>{row.member}</TableCell>
                  <TableCell>
                    <PositionBadge value={row.checkpoint_position} label="checkpoint position" />
                  </TableCell>
                  <TableCell>
                    {storePosition === undefined
                      ? "—"
                      : formatPositionDistance(storePosition, row.checkpoint_position).text}
                  </TableCell>
                  <TableCell>
                    <Timestamp value={row.updated_at} />
                  </TableCell>
                  <TableCell>
                    {row.live ? (
                      <span className="flex items-center gap-1">
                        <Badge variant={row.live.phase === "live" ? "default" : "secondary"}>
                          {row.live.phase}
                        </Badge>
                        <PositionBadge
                          value={row.live.global_position}
                          label="process-local position"
                        />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
        {metricsMounted && metrics.data && Object.keys(metrics.data.subscriptions).length > 0 && (
          <section
            aria-label="Subscription metrics"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Object.entries(metrics.data.subscriptions).map(([name, m]) => (
              <Card key={name} size="sm">
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
                    <dt className="text-muted-foreground">last known position</dt>
                    <dd>{formatInt(m.last_known_position)}</dd>
                    <dt className="text-muted-foreground">
                      <TooltipTrigger>
                        <span tabIndex={0}>positions behind head</span>
                        <Tooltip>wire field: lag</Tooltip>
                      </TooltipTrigger>
                    </dt>
                    <dd>{formatInt(m.lag)}</dd>
                    <dt className="text-muted-foreground">database errors</dt>
                    <dd>{m.db_error_count}</dd>
                    <dt className="text-muted-foreground">last stop reason</dt>
                    <dd>{m.last_stop_reason ?? "—"}</dd>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        {!metricsMounted && (
          <p className="text-xs text-muted-foreground">/metrics is not mounted on this surface</p>
        )}
      </div>
    </>
  )
}
