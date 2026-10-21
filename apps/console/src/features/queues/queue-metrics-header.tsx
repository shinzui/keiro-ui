import type { QueueMetrics } from "@keiro-ui/client-pgmq"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { cn } from "cn"

import { Timestamp } from "@/components/timestamp"
import { formatDuration, formatInt } from "@/lib/format"
import { useLiveness } from "@/shell/liveness"

import { partitionEstimate } from "./queue-table"

function Figure({
  label,
  value,
  hint,
  headline = false,
}: {
  label: string
  value: string
  hint?: string
  headline?: boolean
}) {
  return (
    <div className="flex flex-col" title={hint}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn("font-semibold tabular-nums", headline ? "text-2xl" : "text-xl")}
        data-figure={label}
      >
        {value}
      </span>
    </div>
  )
}

const age = (seconds: number | null) => (seconds === null ? "empty" : formatDuration(seconds))

/**
 * The queue's figures, latency first. `source` is the newest feed update's origin and `push`
 * the snapshot's notify flag; both are hints over the poll, which stays authoritative.
 */
export function QueueMetricsHeader({
  metrics,
  partitioned,
  source,
  push,
}: {
  metrics: QueueMetrics | undefined
  partitioned?: boolean
  source?: "poll" | "notify"
  push?: boolean
}) {
  const { paused } = useLiveness()
  if (!metrics) return <Skeleton className="h-14 w-full max-w-xl" />
  return (
    <section aria-label="Queue metrics" className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <Figure label="oldest" value={age(metrics.oldest_msg_age_sec)} headline />
      <Figure label="visible" value={formatInt(metrics.queue_visible_length)} hint="Readable now" />
      <Figure
        label="total"
        value={formatInt(metrics.queue_length)}
        hint="Visible, leased, and delayed rows together"
      />
      <Figure label="newest" value={age(metrics.newest_msg_age_sec)} />
      <Figure
        label="lifetime messages"
        value={formatInt(metrics.total_messages)}
        hint="The queue's sequence high-water mark: a lifetime counter, not a size"
      />
      {partitioned && (
        <Figure label="partition" value={partitionEstimate(metrics.default_partition_length)} />
      )}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>
          as of <Timestamp value={metrics.scrape_time} />
        </span>
        <span className="flex items-center gap-1.5" data-testid="metrics-source">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              paused
                ? "bg-muted-foreground/40"
                : source === "notify"
                  ? "bg-sky-500"
                  : "bg-emerald-500",
            )}
          />
          {paused ? "paused" : (source ?? "poll")}
          {!paused && push !== undefined && <span>· {push ? "notify-assisted" : "poll only"}</span>}
        </span>
      </div>
    </section>
  )
}
