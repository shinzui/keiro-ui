import type { ProjectionGroupStatus } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Progress } from "@keiro-ui/ui/components/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"

import { Timestamp } from "@/components/timestamp"
import { formatInt } from "@/lib/format"
import { links } from "@/lib/links"

import { positionDistance } from "./distance"
import { DistanceCell } from "./distance-cell"

const phaseTone: Record<string, string> = {
  live: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  rebuilding: "border-sky-600/40 text-sky-700 dark:text-sky-400",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge variant="outline" className={cn(phaseTone[phase])} data-phase={phase}>
      {phase}
    </Badge>
  )
}

export function AccessBadges({ group }: { group: ProjectionGroupStatus }) {
  return (
    <span className="flex gap-1">
      <Badge variant="outline" className={cn(!group.reads_allowed && "opacity-40")}>
        reads
      </Badge>
      <Badge variant="outline" className={cn(!group.writes_allowed && "opacity-40")}>
        writes
      </Badge>
    </span>
  )
}

/** The candidate rebuild's progress (position / head), or nothing without an active run. */
export function RebuildProgress({ group }: { group: ProjectionGroupStatus }) {
  if (!group.active_run_id) return <span className="text-muted-foreground">—</span>
  const position = group.candidate_rebuild_position
  const head = group.candidate_rebuild_head
  const label =
    position !== null && head !== null ? `${formatInt(position)} / ${formatInt(head)}` : "starting"
  const percent =
    position !== null && head !== null && head > 0n ? Number((position * 100n) / head) : 0
  return (
    <div className="flex min-w-40 flex-col gap-1 text-xs">
      <span>
        {group.candidate_revision_id ?? "candidate"} · {label}
      </span>
      <Progress aria-label={`Rebuild ${label}`} value={percent} />
      {group.rebuild_started_at && (
        <span className="text-muted-foreground">
          started <Timestamp value={group.rebuild_started_at} />
        </span>
      )}
    </div>
  )
}

export function firstLine(detail: unknown): string {
  if (detail === null || detail === undefined) return ""
  const text =
    typeof detail === "string"
      ? detail
      : typeof detail === "object" && "message" in detail && typeof detail.message === "string"
        ? detail.message
        : JSON.stringify(detail)
  return text.split("\n")[0] ?? ""
}

/** Projection groups with the global position distance against the page's visible head. */
export function ProjectionTable({
  groups,
  head,
  isPending,
}: {
  groups: ProjectionGroupStatus[]
  head: bigint | undefined
  isPending: boolean
}) {
  return (
    <Table aria-label="Projection groups">
      <TableHeader>
        <TableHead isRowHeader>Group</TableHead>
        <TableHead>Lifecycle</TableHead>
        <TableHead>Access</TableHead>
        <TableHead>Serving</TableHead>
        <TableHead>Basis</TableHead>
        <TableHead>Applied position</TableHead>
        <TableHead>Global position distance</TableHead>
        <TableHead>Rebuild</TableHead>
        <TableHead>Query models</TableHead>
        <TableHead>Failure</TableHead>
        <TableHead>Last promoted</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : "No projection groups."}
          </p>
        )}
      >
        {groups.map((group) => (
          <TableRow key={group.group_id} id={group.group_id}>
            <TableCell>
              <Link
                {...links.projection(group.group_id)}
                className="font-mono text-xs underline-offset-2 hover:underline"
              >
                {group.group_id}
              </Link>
            </TableCell>
            <TableCell>
              <PhaseBadge phase={group.lifecycle_phase} />
            </TableCell>
            <TableCell>
              <AccessBadges group={group} />
            </TableCell>
            <TableCell className="text-xs">
              {group.serving_revision_id ?? "—"}
              <span className="text-muted-foreground"> · epoch {group.serving_epoch}</span>
            </TableCell>
            <TableCell className="text-xs">{group.serving_position_basis}</TableCell>
            <TableCell className="tabular-nums">
              {group.serving_applied_position === null
                ? "—"
                : formatInt(group.serving_applied_position)}
            </TableCell>
            <TableCell data-testid={`distance-${group.group_id}`}>
              <DistanceCell
                distance={positionDistance({
                  head,
                  applied: group.serving_applied_position,
                  basis: group.serving_position_basis,
                })}
              />
            </TableCell>
            <TableCell>
              <RebuildProgress group={group} />
            </TableCell>
            <TableCell>
              <TooltipTrigger>
                <span role="button" tabIndex={0} className="text-xs outline-none">
                  {group.query_models.length}
                </span>
                <Tooltip>{group.query_models.join(", ") || "none"}</Tooltip>
              </TooltipTrigger>
            </TableCell>
            <TableCell className="max-w-56">
              {group.failed_at ? (
                <span className="flex flex-col gap-0.5 text-xs">
                  <Badge variant="destructive">failed</Badge>
                  <span className="font-mono">{group.failure_code}</span>
                  <span className="truncate text-muted-foreground">
                    {firstLine(group.failure_detail)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {group.last_promoted_at ? <Timestamp value={group.last_promoted_at} /> : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
