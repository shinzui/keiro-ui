import type { WorkflowAwakeable, WorkflowChild, WorkflowStep } from "@keiro-ui/client-keiro"
import { Button } from "@keiro-ui/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"

import { toJsonText } from "@/components/JsonViewer"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

import { StatusClassBadge } from "./StatusClassBadge"

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  return (
    <code className="block max-w-md truncate font-mono text-xs" title={toJsonText(value)}>
      {toJsonText(value, 0)}
    </code>
  )
}

const empty = (pending: boolean, text: string) => () => (
  <p className="p-4 text-center text-sm text-muted-foreground">{pending ? "Loading…" : text}</p>
)

/** "Load more" under a cursor-paged tab. */
export function LoadMore({
  hasMore,
  isFetching,
  onMore,
}: {
  hasMore: boolean
  isFetching: boolean
  onMore: () => void
}) {
  if (!hasMore) return null
  return (
    <Button size="xs" variant="outline" isDisabled={isFetching} onPress={onMore} className="w-fit">
      {isFetching ? "Loading…" : "Load more"}
    </Button>
  )
}

/** The derived step index of one generation. */
export function StepsTable({ steps, isPending }: { steps: WorkflowStep[]; isPending: boolean }) {
  return (
    <Table aria-label="Steps">
      <TableHeader>
        <TableHead isRowHeader>Step</TableHead>
        <TableHead>Result</TableHead>
        <TableHead>Recorded</TableHead>
      </TableHeader>
      <TableBody renderEmptyState={empty(isPending, "No steps recorded in this generation.")}>
        {steps.map((step) => (
          <TableRow key={step.step} id={step.step}>
            <TableCell className="font-mono text-xs">{step.step}</TableCell>
            <TableCell>
              <Json value={step.result} />
            </TableCell>
            <TableCell>
              <Timestamp value={step.recorded_at} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Child workflows this instance started; each links to the child's own page. */
export function ChildrenTable({ rows, isPending }: { rows: WorkflowChild[]; isPending: boolean }) {
  return (
    <Table aria-label="Children">
      <TableHeader>
        <TableHead isRowHeader>Child</TableHead>
        <TableHead>Awaited by step</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Result</TableHead>
        <TableHead>Failure</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Completed</TableHead>
      </TableHeader>
      <TableBody renderEmptyState={empty(isPending, "This instance started no child workflows.")}>
        {rows.map((child) => {
          const key = `${child.child_name}/${child.child_id}`
          return (
            <TableRow key={key} id={key}>
              <TableCell textValue={key}>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{child.child_name}</span>
                  <Link
                    {...links.workflow(child.child_name, child.child_id)}
                    className="font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {child.child_id}
                  </Link>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{child.await_step ?? "—"}</TableCell>
              <TableCell>
                <StatusClassBadge statusClass={child.status} />
              </TableCell>
              <TableCell>
                <Json value={child.result} />
              </TableCell>
              <TableCell>
                <Json value={child.failure_reason} />
              </TableCell>
              <TableCell>
                <Timestamp value={child.created_at} />
              </TableCell>
              <TableCell>
                {child.completed_at ? <Timestamp value={child.completed_at} /> : "—"}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** External promises the instance waits on (or waited on). */
export function AwakeablesTable({
  awakeables,
  isPending,
}: {
  awakeables: WorkflowAwakeable[]
  isPending: boolean
}) {
  return (
    <Table aria-label="Awakeables">
      <TableHeader>
        <TableHead isRowHeader>Awakeable</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Payload</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Completed</TableHead>
      </TableHeader>
      <TableBody renderEmptyState={empty(isPending, "This instance has no awakeables.")}>
        {awakeables.map((a) => (
          <TableRow key={a.awakeable_id} id={a.awakeable_id}>
            <TableCell className="font-mono text-xs">{a.awakeable_id}</TableCell>
            <TableCell>
              <StatusClassBadge statusClass={a.status} />
            </TableCell>
            <TableCell>
              <Json value={a.payload} />
            </TableCell>
            <TableCell>
              <Timestamp value={a.created_at} />
            </TableCell>
            <TableCell>{a.completed_at ? <Timestamp value={a.completed_at} /> : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
