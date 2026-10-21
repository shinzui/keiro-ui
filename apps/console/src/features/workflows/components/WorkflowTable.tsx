import type { WorkflowInstance } from "@keiro-ui/client-keiro"
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

import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

import { StatusClassBadge } from "./StatusClassBadge"

/** `last_error` as one line of text (it is free-form JSON on the wire). */
export function errorText(error: unknown): string | null {
  if (error === null || error === undefined) return null
  return typeof error === "string" ? error : JSON.stringify(error)
}

function MaybeTime({ value }: { value: string | null }) {
  return value ? <Timestamp value={value} /> : <span className="text-muted-foreground">—</span>
}

/** One row per instance; the id links to the instance page. */
export function WorkflowTable({
  items,
  isPending,
}: {
  items: WorkflowInstance[]
  isPending: boolean
}) {
  return (
    <Table aria-label="Workflow instances">
      <TableHeader>
        <TableHead isRowHeader>Workflow</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Gen</TableHead>
        <TableHead>Attempts</TableHead>
        <TableHead>Last error</TableHead>
        <TableHead>Next attempt</TableHead>
        <TableHead>Wake after</TableHead>
        <TableHead>Lease</TableHead>
        <TableHead>Created</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead>Completed</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : "No workflow instances match these filters."}
          </p>
        )}
      >
        {items.map((wf) => {
          const key = `${wf.workflow_name}/${wf.workflow_id}`
          const error = errorText(wf.last_error)
          return (
            <TableRow key={key} id={key}>
              <TableCell textValue={key}>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{wf.workflow_name}</span>
                  <Link
                    {...links.workflow(wf.workflow_name, wf.workflow_id)}
                    className="font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {wf.workflow_id}
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <StatusClassBadge
                  statusClass={wf.status_class}
                  status={wf.status}
                  attempts={wf.attempts}
                />
              </TableCell>
              <TableCell className="tabular-nums">{wf.generation}</TableCell>
              <TableCell className="tabular-nums">{wf.attempts}</TableCell>
              <TableCell className="max-w-56">
                {error ? (
                  <TooltipTrigger>
                    <span role="button" tabIndex={0} className="block truncate text-destructive">
                      {error}
                    </span>
                    <Tooltip className="max-w-md whitespace-pre-wrap">{error}</Tooltip>
                  </TooltipTrigger>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <MaybeTime value={wf.next_attempt_at} />
              </TableCell>
              <TableCell>
                <MaybeTime value={wf.wake_after} />
              </TableCell>
              <TableCell className="text-xs">
                {wf.leased_by ? (
                  <span>
                    {wf.leased_by}
                    {wf.lease_expires_at && (
                      <>
                        {" "}
                        until <Timestamp value={wf.lease_expires_at} />
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Timestamp value={wf.created_at} />
              </TableCell>
              <TableCell>
                <Timestamp value={wf.updated_at} />
              </TableCell>
              <TableCell>
                <MaybeTime value={wf.completed_at} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
