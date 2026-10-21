import { Badge } from "@keiro-ui/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"

import { formatDuration, formatInt } from "@/lib/format"
import { links } from "@/lib/links"

import type { QueueRow } from "./queries"
import { defaultDirection, type QueueSort, type SortDirection } from "./sort"

function Age({ seconds }: { seconds: number | null | undefined }) {
  if (seconds === undefined) return <span className="text-muted-foreground">—</span>
  if (seconds === null) return <span className="text-muted-foreground">empty</span>
  return <>{formatDuration(seconds)}</>
}

function SortableHead({
  id,
  isRowHeader,
  children,
}: {
  id: QueueSort
  isRowHeader?: boolean
  children: ReactNode
}) {
  return (
    <TableHead
      id={id}
      isRowHeader={isRowHeader}
      allowsSorting
      className="cursor-pointer select-none"
    >
      {({ sortDirection }) => (
        <span className="inline-flex items-center gap-1">
          {children}
          {sortDirection === "ascending" && <ArrowUp aria-hidden className="size-3" />}
          {sortDirection === "descending" && <ArrowDown aria-hidden className="size-3" />}
        </span>
      )}
    </TableHead>
  )
}

/** "partition est. N", or "unknown" when the planner has no estimate (null is not zero). */
export function partitionEstimate(length: bigint | null | undefined): string {
  return `partition est. ${length === null || length === undefined ? "unknown" : formatInt(length)}`
}

/**
 * Queues, latency first: the oldest message's age is the headline column, then the visible
 * and total counts, then the newest age and the storage badges. Clicking a header sorts.
 */
export function QueueTable({
  rows,
  isPending,
  sort,
  direction,
  onSortChange,
}: {
  rows: QueueRow[]
  isPending: boolean
  sort: QueueSort
  direction: SortDirection
  onSortChange: (sort: QueueSort, direction: SortDirection) => void
}) {
  return (
    <Table
      aria-label="Queues"
      sortDescriptor={{ column: sort, direction: direction === "asc" ? "ascending" : "descending" }}
      onSortChange={(descriptor) => {
        const column = descriptor.column as QueueSort
        if (column !== sort) onSortChange(column, defaultDirection(column))
        else onSortChange(column, direction === "asc" ? "desc" : "asc")
      }}
    >
      <TableHeader>
        <SortableHead id="name" isRowHeader>
          Queue
        </SortableHead>
        <SortableHead id="oldest">Oldest</SortableHead>
        <SortableHead id="visible">Visible</SortableHead>
        <SortableHead id="total">Total</SortableHead>
        <SortableHead id="newest">Newest</SortableHead>
        <TableHead>Storage</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : "No queues."}
          </p>
        )}
      >
        {rows.map(({ queue, metrics }) => (
          <TableRow key={queue.queue_name} id={queue.queue_name}>
            <TableCell>
              <Link
                {...links.queue(queue.queue_name)}
                className="font-medium underline-offset-2 hover:underline"
              >
                {queue.queue_name}
              </Link>
            </TableCell>
            <TableCell className="font-semibold tabular-nums">
              <Age seconds={metrics ? metrics.oldest_msg_age_sec : undefined} />
            </TableCell>
            <TableCell className="tabular-nums">
              {metrics ? formatInt(metrics.queue_visible_length) : "—"}
            </TableCell>
            <TableCell className="tabular-nums">
              {metrics ? formatInt(metrics.queue_length) : "—"}
            </TableCell>
            <TableCell className="tabular-nums">
              <Age seconds={metrics ? metrics.newest_msg_age_sec : undefined} />
            </TableCell>
            <TableCell>
              <span className="flex gap-1">
                {queue.is_partitioned && (
                  <Badge variant="outline">
                    partitioned · {partitionEstimate(metrics?.default_partition_length)}
                  </Badge>
                )}
                {queue.is_unlogged && <Badge variant="outline">unlogged</Badge>}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
