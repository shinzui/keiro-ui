// Durations derived in the browser from the journal's `recorded_at` values and the instance's
// `created_at`. They are labelled as derived wherever shown: the journal records when a step
// finished, not when a suspension began, so no waiting-versus-executing split is attempted.

export interface TimedEntry {
  recorded_at: string
}

export interface Segment {
  /** Seconds since the previous loaded entry (or since `created_at` for the first). */
  spanSeconds: number | null
  /** Seconds since `created_at`. */
  cumulativeSeconds: number | null
}

export interface Segments {
  perEntry: Segment[]
  timeToFirstStepSeconds: number | null
  totalSeconds: number | null
  /** Index of the entry with the longest span, when there is one. */
  longestIndex: number | null
}

const seconds = (from: string, to: string): number | null => {
  const a = Date.parse(from)
  const b = Date.parse(to)
  return Number.isNaN(a) || Number.isNaN(b) ? null : (b - a) / 1000
}

/**
 * Spans between consecutive loaded entries in stream-version order. When `firstLoaded` is
 * false (a later page is shown without its predecessor) the first entry has no span.
 */
export function deriveSegments(
  entries: TimedEntry[],
  createdAt: string | undefined,
  firstLoaded = true,
): Segments {
  const perEntry = entries.map((entry, i): Segment => {
    const previous = i > 0 ? entries[i - 1]!.recorded_at : firstLoaded ? createdAt : undefined
    return {
      spanSeconds: previous === undefined ? null : seconds(previous, entry.recorded_at),
      cumulativeSeconds: createdAt === undefined ? null : seconds(createdAt, entry.recorded_at),
    }
  })
  let longestIndex: number | null = null
  perEntry.forEach((segment, i) => {
    if (segment.spanSeconds === null) return
    const best = longestIndex === null ? null : perEntry[longestIndex]!.spanSeconds
    if (best === null || segment.spanSeconds > best) longestIndex = i
  })
  const first = entries[0]
  const last = entries.at(-1)
  return {
    perEntry,
    timeToFirstStepSeconds:
      firstLoaded && first && createdAt ? seconds(createdAt, first.recorded_at) : null,
    totalSeconds: last && createdAt ? seconds(createdAt, last.recorded_at) : null,
    longestIndex,
  }
}
