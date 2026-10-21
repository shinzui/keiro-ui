import { useState } from "react"

export type Trend = "up" | "down" | "flat" | undefined

interface History {
  at: number
  samples: (bigint | number)[]
}

/**
 * The last `size` samples of a headline, kept in memory per mounted card, and the trend of the
 * newest versus the previous sample. A sample is recorded when its time `at` changes
 * (adjusted during render, React's pattern for state derived from changing input).
 */
export function useSampleHistory(
  value: bigint | number | undefined,
  at: number,
  size = 30,
): { samples: (bigint | number)[]; trend: Trend } {
  const [history, setHistory] = useState<History>({ at: 0, samples: [] })
  if (value !== undefined && at > 0 && history.at !== at) {
    setHistory({ at, samples: [...history.samples, value].slice(-size) })
  }
  const [previous, current] = history.samples.slice(-2)
  const trend: Trend =
    previous === undefined || current === undefined
      ? undefined
      : current > previous
        ? "up"
        : current < previous
          ? "down"
          : "flat"
  return { samples: history.samples, trend }
}
