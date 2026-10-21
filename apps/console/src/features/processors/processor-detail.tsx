import { extrapolateAge, type ProcessorMetrics } from "@keiro-ui/client-shibuya"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import type { ReactNode } from "react"

import { Timestamp } from "@/components/timestamp"
import { formatDuration, formatInt } from "@/lib/format"

import { ControlStatus } from "./control-status"
import { LatencyHistogram } from "./latency-histogram"
import { PROCESSED_LABEL } from "./processor-table"
import { ProgressCursors } from "./progress-cursors"
import type { ProcessorRow } from "./queries"
import { StateBadge } from "./state-badge"

export const QUEUE_CONTEXT_UNAVAILABLE =
  "Queue context unavailable (shibuya-pgmq-adapter IR-2 not implemented)"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm" role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Fields({ entries }: { entries: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {entries.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const when = (iso: string | undefined) => (iso ? <Timestamp value={iso} /> : "—")

function stateEntries(state: ProcessorMetrics["state"]): [string, ReactNode][] {
  switch (state.status) {
    case "processing":
      return [
        ["in flight", `${state.inFlight} / ${state.maxConcurrency}`],
        ["last activity", when(state.lastActivity)],
        ["last progress", when(state.lastProgress)],
      ]
    case "paused":
      return [
        [
          "in flight",
          state.inFlight === undefined ? "—" : `${state.inFlight} / ${state.maxConcurrency ?? "?"}`,
        ],
        ["paused", when(state.pausedAt)],
        ["last progress", when(state.lastProgress)],
      ]
    case "failed":
      return [
        [
          "error",
          <span key="error" className="text-destructive">
            {state.error}
          </span>,
        ],
        ["at", when(state.timestamp)],
      ]
    default:
      return []
  }
}

/** One processor: state, counters, latency, progress, oldest in flight, and control status. */
export function ProcessorDetail({ row, now }: { row: ProcessorRow; now: number }) {
  const { metrics } = row
  const status = row.terminal?.status ?? metrics.state.status
  const oldest = metrics.oldestInFlight
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="State">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <StateBadge status={status} />
            <span className="text-xs text-muted-foreground">
              started <Timestamp value={metrics.startedAt} />
            </span>
          </span>
          {row.terminal && (
            <p className="text-sm text-destructive">
              Left the registry ({row.terminal.status})
              {row.terminal.error && `: ${row.terminal.error}`}
            </p>
          )}
          <Fields entries={stateEntries(metrics.state)} />
          <p className="text-xs text-muted-foreground">{QUEUE_CONTEXT_UNAVAILABLE}</p>
        </div>
      </Section>
      <Section title="Counters">
        <div className="flex flex-col gap-3">
          <Fields
            entries={[
              ["received", formatInt(metrics.stats.received)],
              [PROCESSED_LABEL, formatInt(metrics.stats.processed)],
              ["failed", formatInt(metrics.stats.failed)],
            ]}
          />
          <Fields
            entries={[
              ["batches emitted", formatInt(metrics.batch.batchesEmitted)],
              ["batched messages", formatInt(metrics.batch.batchedMessages)],
              ["partial failures", formatInt(metrics.batch.partialFailures)],
              ["size-triggered", formatInt(metrics.batch.sizeTriggered)],
              ["timeout-triggered", formatInt(metrics.batch.timeoutTriggered)],
              ["flush-triggered", formatInt(metrics.batch.flushTriggered)],
            ]}
          />
        </div>
      </Section>
      <div className="lg:col-span-2">
        <Section title="Latency">
          <LatencyHistogram latency={metrics.latency} />
        </Section>
      </div>
      <Section title="Oldest in flight">
        {oldest ? (
          <Fields
            entries={[
              [
                "message",
                <span key="message" className="font-mono text-xs">
                  {oldest.messageId}
                </span>,
              ],
              ["started", <Timestamp key="started" value={oldest.startedAt} />],
              [
                "age",
                <span key="age" data-testid="oldest-age">
                  {formatDuration(extrapolateAge(oldest, new Date(row.receivedAt), new Date(now)))}
                </span>,
              ],
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing in flight, or in-flight detail not enabled on this host.
          </p>
        )}
      </Section>
      <Section title="Progress">
        <ProgressCursors progress={metrics.progress} />
      </Section>
      <ControlStatus />
    </div>
  )
}
