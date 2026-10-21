import { isRouteUnavailable } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { createFileRoute, Link } from "@tanstack/react-router"
import { z } from "zod"

import { EmptyState } from "@/components/empty-state"
import { JsonViewer } from "@/components/JsonViewer"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { LastReactionCard } from "@/features/process-managers/LastReactionCard"
import { useInstance } from "@/features/process-managers/queries"
import { WaitingForPanel } from "@/features/process-managers/WaitingForPanel"
import { HydrationBadge } from "@/features/shared/HydrationBadge"
import { NotMountedState } from "@/features/shared/NotMountedState"
import { TimersTable } from "@/features/timers/TimersTable"
import { hrefOf, links } from "@/lib/links"
import { useNow } from "@/lib/use-now"
import { useRecordVisit } from "@/shell/recent"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/process-managers/$name/$correlation")({
  validateSearch: shellSearchSchema.extend({
    timer_limit: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
  }),
  component: InstancePage,
})

function InstancePage() {
  const { name, correlation } = Route.useParams()
  const search = Route.useSearch()
  const instance = useInstance(name, correlation, search.timer_limit)
  const now = useNow()
  const error: unknown = instance.error
  useRecordVisit({
    kind: "process-manager",
    label: `${name} / ${correlation}`,
    href: hrefOf(links.processManagerInstance(name, correlation)),
  })
  const view = instance.data
  return (
    <>
      <PageHeader
        title={correlation}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link {...links.processManager(name)} className="underline-offset-2 hover:underline">
              {name}
            </Link>
            {view && (
              <>
                · as of <Timestamp value={view.observed_at} />
              </>
            )}
          </span>
        }
      >
        {view && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-medium">{view.state_label ?? "no state label"}</span>
            <HydrationBadge hydration={view.hydration} />
            <span className="text-xs text-muted-foreground">
              state{" "}
              {view.state_version === null ? (
                "—"
              ) : (
                <PositionBadge value={view.state_version} label="state version" />
              )}{" "}
              · stream <PositionBadge value={view.stream_version} label="stream version" /> ·
              observed head{" "}
              <PositionBadge value={view.observed_head_version} label="observed head version" />
            </span>
            {"deleted_at" in view && view.deleted_at ? (
              <Badge variant="destructive">deleted</Badge>
            ) : null}
          </div>
        )}
      </PageHeader>
      <div className="flex flex-col gap-4 p-6">
        {isRouteUnavailable(error) ? (
          <NotMountedState family="pm" />
        ) : instance.isPending ? (
          <Skeleton className="h-48" />
        ) : instance.isError ? (
          <p className="text-sm text-destructive">{instance.error.message}</p>
        ) : view === null || view === undefined ? (
          <EmptyState title={`No instance of ${name} with correlation ${correlation}`} />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card size="sm" role="region" aria-label="State">
                <CardHeader>
                  <CardTitle>State</CardTitle>
                </CardHeader>
                <CardContent>
                  <JsonViewer value={view.state} />
                </CardContent>
              </Card>
              <WaitingForPanel waitingFor={view.waiting_for} />
              <LastReactionCard
                reaction={view.last_reaction}
                manager={name}
                correlation={correlation}
              />
              <Card size="sm" role="region" aria-label="Pending timers">
                <CardHeader>
                  <CardTitle>Pending timers</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <TimersTable
                    timers={view.pending_timers.items}
                    now={now}
                    isPending={false}
                    label="Instance pending timers"
                  />
                  <Link
                    {...links.timers({ manager: name, correlation })}
                    className="text-sm underline-offset-2 hover:underline"
                  >
                    View all in Timers
                  </Link>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm">
              Journal:{" "}
              <Link
                {...links.stream(view.journal_stream_name)}
                className="font-mono text-xs underline-offset-2 hover:underline"
              >
                {view.journal_stream_name}
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  )
}
