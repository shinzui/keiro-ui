// shibuya's latency histogram is Prometheus-shaped: cumulative finite buckets `{le, count}` plus
// a total `count` whose excess over the last bucket is the +Inf overflow.

export interface CumulativeBucket {
  le: number
  count: bigint | number
}

export interface Histogram {
  count: bigint | number
  sumSeconds: number
  buckets: CumulativeBucket[]
}

export interface HistogramBar {
  /** Lower bound (the previous bucket's `le`, 0 for the first). */
  from: number
  le: number
  count: number
}

export interface Quantile {
  q: number
  seconds: number
  /** The rank falls in the overflow above the last finite bucket; `seconds` is a lower bound. */
  beyondLast: boolean
}

export interface HistogramSummary {
  bars: HistogramBar[]
  overflow: number
  count: number
  mean: number | null
  quantiles: Quantile[]
}

/** Per-bucket counts: each cumulative count minus the previous one. */
export function bucketCounts(histogram: Histogram): { bars: HistogramBar[]; overflow: number } {
  const bars: HistogramBar[] = []
  let previous = 0
  let from = 0
  for (const bucket of histogram.buckets) {
    const cumulative = Number(bucket.count)
    bars.push({ from, le: bucket.le, count: cumulative - previous })
    previous = cumulative
    from = bucket.le
  }
  return { bars, overflow: Math.max(0, Number(histogram.count) - previous) }
}

/**
 * The Prometheus `histogram_quantile` estimate: find the first bucket whose cumulative count
 * reaches `q × count` and interpolate linearly inside it (the first bucket from 0). Null when
 * the histogram is empty.
 */
export function estimateQuantile(histogram: Histogram, q: number): Quantile | null {
  const total = Number(histogram.count)
  if (total <= 0 || histogram.buckets.length === 0) return null
  const rank = q * total
  let previousCount = 0
  let previousLe = 0
  for (const bucket of histogram.buckets) {
    const cumulative = Number(bucket.count)
    if (cumulative >= rank) {
      const inBucket = cumulative - previousCount
      const fraction = inBucket === 0 ? 1 : (rank - previousCount) / inBucket
      return { q, seconds: previousLe + (bucket.le - previousLe) * fraction, beyondLast: false }
    }
    previousCount = cumulative
    previousLe = bucket.le
  }
  return { q, seconds: previousLe, beyondLast: true }
}

export function summarizeHistogram(
  histogram: Histogram,
  qs: number[] = [0.5, 0.9, 0.99],
): HistogramSummary {
  const { bars, overflow } = bucketCounts(histogram)
  const count = Number(histogram.count)
  return {
    bars,
    overflow,
    count,
    mean: count > 0 ? histogram.sumSeconds / count : null,
    quantiles: qs.flatMap((q) => estimateQuantile(histogram, q) ?? []),
  }
}
