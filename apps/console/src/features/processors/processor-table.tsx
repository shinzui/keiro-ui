import type { ProcessorMetrics } from "@keiro-ui/client-shibuya"
import { extrapolateAge } from "@keiro-ui/client-shibuya"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"

import { Timestamp } from "@/components/timestamp"
import { formatDuration, formatInt } from "@/lib/format"
import { links } from "@/lib/links"

import type { ProcessorRow } from "./queries"
import { StateBadge } from "./state-badge"

export const PROCESSED_LABEL = "processed (includes retries)"

/** `inFlight / maxConcurrency` for processing and paused states, else "—". */
export function inFlightText(metrics: ProcessorMetrics): string {
  const state = metrics.state
  if (state.status !== "processing" && state.status !== "paused") return "—"
  if (state.inFlight === undefined) return "—"
  return `${state.inFlight} / ${state.maxConcurrency ?? "?"}`
}

/** The oldest in-flight age extrapolated to `now`; "—" when the host did not enable detail. */
export function oldestInFlightText(row: ProcessorRow, now: number): string {
  const oldest = row.metrics.oldestInFlight
  if (!oldest) return "—"
  return formatDuration(extrapolateAge(oldest, new Date(row.receivedAt), new Date(now)))
}

function ProcessorsTable({
  label,
  rows,
  now,
  terminal = false,
  emptyText,
}: {
  label: string
  rows: ProcessorRow[]
  now: number
  terminal?: boolean
  emptyText: string
}) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableHead isRowHeader>Processor</TableHead>
        <TableHead>State</TableHead>
        <TableHead>Received</TableHead>
        <TableHead>{PROCESSED_LABEL}</TableHead>
        <TableHead>Failed</TableHead>
        <TableHead>In flight</TableHead>
        <TableHead>Oldest in flight</TableHead>
        <TableHead>Started</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        )}
      >
        {rows.map((row) => {
          const { metrics } = row
          const status = row.terminal?.status ?? metrics.state.status
          return (
            <TableRow key={row.id} id={row.id}>
              <TableCell>
                <Link
                  {...links.processor(row.id)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {row.id}
                </Link>
                {terminal && row.terminal?.error && (
                  <p className="text-xs whitespace-normal text-destructive">{row.terminal.error}</p>
                )}
              </TableCell>
              <TableCell>
                <StateBadge status={status} />
              </TableCell>
              <TableCell className="tabular-nums">{formatInt(metrics.stats.received)}</TableCell>
              <TableCell className="tabular-nums">{formatInt(metrics.stats.processed)}</TableCell>
              <TableCell className="tabular-nums">{formatInt(metrics.stats.failed)}</TableCell>
              <TableCell className="tabular-nums">{inFlightText(metrics)}</TableCell>
              <TableCell className="tabular-nums" data-testid={`oldest-${row.id}`}>
                {terminal ? "—" : oldestInFlightText(row, now)}
              </TableCell>
              <TableCell>
                <Timestamp value={metrics.startedAt} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** Live processors, then the ones a `terminal` frame removed from the registry. */
export function ProcessorTable({
  rows,
  now,
  isPending,
}: {
  rows: ProcessorRow[]
  now: number
  isPending: boolean
}) {
  const live = rows.filter((row) => !row.terminal)
  const ended = rows.filter((row) => row.terminal)
  return (
    <div className="flex flex-col gap-6">
      <ProcessorsTable
        label="Processors"
        rows={live}
        now={now}
        emptyText={isPending ? "Loading…" : "No processors are registered."}
      />
      {ended.length > 0 && (
        <section aria-label="Terminal" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Terminal</h2>
          <ProcessorsTable
            label="Terminal processors"
            rows={ended}
            now={now}
            terminal
            emptyText=""
          />
        </section>
      )}
    </div>
  )
}
