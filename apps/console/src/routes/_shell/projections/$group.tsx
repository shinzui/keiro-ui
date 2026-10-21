import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { Input } from "@keiro-ui/ui/components/input"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

import { EmptyState } from "@/components/empty-state"
import { JsonViewer } from "@/components/JsonViewer"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { positionDistance } from "@/features/projections/distance"
import { DistanceCell } from "@/features/projections/distance-cell"
import { AccessBadges, PhaseBadge, RebuildProgress } from "@/features/projections/projection-table"
import { useProjectionGroup, useProjectionPosition } from "@/features/projections/queries"
import { formatInt } from "@/lib/format"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/projections/$group")({
  validateSearch: shellSearchSchema.extend({
    subscription: z.string().min(1).optional().catch(undefined),
  }),
  component: ProjectionGroupPage,
})

function ProjectionGroupPage() {
  const { group: groupId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const found = useProjectionGroup(groupId)
  useRecordVisit({ kind: "projection", label: groupId, href: hrefOf(links.projection(groupId)) })
  const row = found.data
  return (
    <>
      <PageHeader
        title={groupId}
        description={
          <Link {...links.projections()} className="underline-offset-2 hover:underline">
            Projections
          </Link>
        }
      />
      <div className="flex max-w-5xl flex-col gap-4 p-6">
        {found.isPending && <Skeleton className="h-40" />}
        {found.isError && <p className="text-sm text-destructive">{found.error.message}</p>}
        {row === null && <EmptyState title="No projection group with this id" />}
        {row && (
          <Card size="sm" role="region" aria-label="Group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhaseBadge phase={row.group.lifecycle_phase} />
                <AccessBadges group={row.group} />
                {row.observed_at && (
                  <span className="text-xs font-normal text-muted-foreground">
                    as of <Timestamp value={row.observed_at} />
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">global position distance</span>
                <DistanceCell
                  large
                  distance={positionDistance({
                    head: row.visible_store_head,
                    applied: row.group.serving_applied_position,
                    basis: row.group.serving_position_basis,
                  })}
                />
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">visible store head</dt>
                <dd>
                  {row.visible_store_head === undefined ? (
                    "—"
                  ) : (
                    <PositionBadge value={row.visible_store_head} label="visible store head" />
                  )}
                </dd>
                <dt className="text-muted-foreground">serving</dt>
                <dd>
                  {row.group.serving_revision_id ?? "—"} · epoch {row.group.serving_epoch} · basis{" "}
                  {row.group.serving_position_basis}
                </dd>
                <dt className="text-muted-foreground">applied position</dt>
                <dd className="tabular-nums">
                  {row.group.serving_applied_position === null
                    ? "—"
                    : formatInt(row.group.serving_applied_position)}
                </dd>
                <dt className="text-muted-foreground">rebuild</dt>
                <dd>
                  <RebuildProgress group={row.group} />
                </dd>
                <dt className="text-muted-foreground">query models</dt>
                <dd>{row.group.query_models.join(", ") || "—"}</dd>
                <dt className="text-muted-foreground">last promoted</dt>
                <dd>
                  {row.group.last_promoted_at ? (
                    <Timestamp value={row.group.last_promoted_at} />
                  ) : (
                    "—"
                  )}
                </dd>
                {row.group.failed_at && (
                  <>
                    <dt className="text-muted-foreground">failed</dt>
                    <dd className="text-destructive">
                      <Timestamp value={row.group.failed_at} /> · {row.group.failure_code}
                    </dd>
                  </>
                )}
              </dl>
              {row.group.failure_detail !== null && row.group.failure_detail !== undefined && (
                <JsonViewer label="Failure detail" value={row.group.failure_detail} />
              )}
            </CardContent>
          </Card>
        )}
        <FeedingSubscription
          key={search.subscription ?? ""}
          subscription={search.subscription}
          onSubscription={(subscription) =>
            void navigate({ search: (prev) => ({ ...prev, subscription }) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Rebuild and promotion are operator-CLI actions in this release.
        </p>
      </div>
    </>
  )
}

function FeedingSubscription({
  subscription,
  onSubscription,
}: {
  subscription: string | undefined
  onSubscription: (subscription: string | undefined) => void
}) {
  const [draft, setDraft] = useState(subscription ?? "")
  const position = useProjectionPosition(subscription)
  const data = position.data
  return (
    <section aria-label="Feeding subscription" className="flex flex-col gap-3">
      <form
        aria-label="Feeding subscription"
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubscription(draft.trim() || undefined)
        }}
      >
        <Input
          aria-label="Feeding subscription name"
          placeholder="Feeding subscription"
          className="w-72"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          Show checkpoints
        </Button>
      </form>
      {subscription === undefined ? (
        <p className="text-sm text-muted-foreground" data-testid="subscription-limitation">
          keiro does not expose which subscription feeds this group; enter it to see checkpoints.
        </p>
      ) : position.isError ? (
        <p className="text-sm text-destructive">{position.error.message}</p>
      ) : data ? (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">store position</dt>
            <dd>
              <PositionBadge value={data.store_position} label="store position" />
            </dd>
            <dt className="text-muted-foreground">visible store head</dt>
            <dd>
              <PositionBadge value={data.visible_store_head} label="visible store head" />
            </dd>
            <dt className="text-muted-foreground">maximum global position distance</dt>
            <dd className="tabular-nums" data-testid="max-distance">
              {data.maximum_global_position_distance === null
                ? "—"
                : formatInt(data.maximum_global_position_distance)}
            </dd>
            <dt className="text-muted-foreground">minimum checkpoint position</dt>
            <dd className="tabular-nums">
              {data.minimum_checkpoint_position === null
                ? "—"
                : formatInt(data.minimum_checkpoint_position)}
            </dd>
          </dl>
          <Table aria-label="Members">
            <TableHeader>
              <TableHead isRowHeader>Member</TableHead>
              <TableHead>Checkpoint position</TableHead>
              <TableHead>Global position distance</TableHead>
              <TableHead>Updated</TableHead>
            </TableHeader>
            <TableBody
              renderEmptyState={() => (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No members have checkpoints.
                </p>
              )}
            >
              {data.members.map((member) => (
                <TableRow key={member.member} id={String(member.member)}>
                  <TableCell>{member.member}</TableCell>
                  <TableCell>
                    <PositionBadge value={member.checkpoint_position} label="checkpoint position" />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {member.global_position_distance === null ||
                    member.global_position_distance === undefined
                      ? "—"
                      : formatInt(member.global_position_distance)}
                  </TableCell>
                  <TableCell>
                    {member.checkpoint_updated_at ? (
                      <Timestamp value={member.checkpoint_updated_at} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Link
            {...links.subscription(subscription)}
            className="text-sm underline-offset-2 hover:underline"
          >
            Open {subscription} in Subscriptions
          </Link>
        </div>
      ) : (
        <Skeleton className="h-24" />
      )}
    </section>
  )
}
