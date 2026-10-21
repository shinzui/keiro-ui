import type { ProcessorMetrics } from "@keiro-ui/client-shibuya"
import { useState } from "react"

import { formatDuration, formatInt } from "@/lib/format"

import { type HistogramBar, summarizeHistogram } from "./histogram"

const WIDTH = 540
const HEIGHT = 120
const AXIS = 18
const GAP = 2

/** Bucket bounds: "0.1 ms", "250 ms", "2.5 s", "60 s". */
export function boundLabel(seconds: number): string {
  if (seconds === 0) return "0"
  if (seconds < 1) return `${Number((seconds * 1000).toPrecision(3))} ms`
  return `${Number(seconds.toPrecision(3))} s`
}

/** A bar anchored to the baseline with 4px rounded top corners. */
function topRounded(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2)
  return `M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`
}

function rangeLabel(bar: HistogramBar): string {
  return Number.isFinite(bar.le)
    ? `${boundLabel(bar.from)}–${boundLabel(bar.le)}`
    : `above ${boundLabel(bar.from)}`
}

function describe(bar: HistogramBar): string {
  return `${rangeLabel(bar)}: ${formatInt(bar.count)}`
}

/**
 * Per-bucket latency counts as SVG bars (one per finite bucket, plus the overflow above the
 * last bound), the mean, and p50/p90/p99 estimated from the buckets.
 */
export function LatencyHistogram({ latency }: { latency: ProcessorMetrics["latency"] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (!latency)
    return <p className="text-sm text-muted-foreground">latency detail not enabled on this host</p>
  const summary = summarizeHistogram(latency)
  const bars: HistogramBar[] = [
    ...summary.bars,
    { from: summary.bars.at(-1)?.le ?? 0, le: Number.POSITIVE_INFINITY, count: summary.overflow },
  ]
  const max = Math.max(1, ...bars.map((b) => b.count))
  const slot = WIDTH / bars.length
  const plot = HEIGHT - AXIS
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-2xl"
        role="img"
        aria-label={`Latency histogram of ${formatInt(summary.count)} messages`}
        data-testid="latency-histogram"
      >
        <line x1={0} x2={WIDTH} y1={plot} y2={plot} className="stroke-border" strokeWidth={1} />
        {bars.map((bar, i) => {
          const h = bar.count === 0 ? 0 : Math.max(2, (bar.count / max) * (plot - 4))
          const x = i * slot + GAP / 2
          const w = slot - GAP
          return (
            <g
              key={bar.le}
              data-bar={Number.isFinite(bar.le) ? "bucket" : "overflow"}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
            >
              {/* The hit target is the whole slot, taller than the bar. */}
              <rect x={i * slot} y={0} width={slot} height={plot} fill="transparent" />
              {h > 0 && (
                <path
                  d={topRounded(x, plot, w, h)}
                  className={
                    hovered === i
                      ? "fill-sky-700 dark:fill-sky-300"
                      : "fill-sky-600/80 dark:fill-sky-400/80"
                  }
                />
              )}
              <title>{describe(bar)}</title>
            </g>
          )
        })}
        {[0, Math.floor(bars.length / 2), bars.length - 2].map((i) => {
          const bar = bars[i]
          if (!bar) return null
          return (
            <text
              key={i}
              x={i * slot + slot}
              y={HEIGHT - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {boundLabel(bar.le)}
            </text>
          )
        })}
      </svg>
      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {hovered !== null && bars[hovered] ? describe(bars[hovered]) : "Hover a bar for its count."}
      </p>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">count</span> {formatInt(summary.count)}
        </span>
        <span>
          <span className="text-muted-foreground">mean</span>{" "}
          {summary.mean === null ? "—" : formatDuration(summary.mean)}
        </span>
        {summary.quantiles.map((q) => (
          <span key={q.q} data-quantile={`p${Math.round(q.q * 100)}`}>
            <span className="text-muted-foreground">p{Math.round(q.q * 100)}</span>{" "}
            {q.beyondLast ? "> " : "≈ "}
            {formatDuration(q.seconds)}
          </span>
        ))}
        <span className="text-xs text-muted-foreground">estimated from histogram buckets</span>
      </figcaption>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Buckets as a table</summary>
        <table className="mt-1">
          <thead>
            <tr>
              <th className="pr-4 text-left font-medium">Latency</th>
              <th className="text-right font-medium">Messages</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.le}>
                <td className="pr-4">{rangeLabel(bar)}</td>
                <td className="text-right tabular-nums">{formatInt(bar.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
