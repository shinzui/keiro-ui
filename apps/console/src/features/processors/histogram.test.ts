import { describe, expect, it } from "vitest"

import { bucketCounts, estimateQuantile, summarizeHistogram } from "./histogram"

const small = {
  count: 6,
  sumSeconds: 2.4,
  buckets: [
    { le: 0.1, count: 2 },
    { le: 1, count: 5 },
  ],
}

describe("histogram", () => {
  it("turns cumulative buckets into per-bucket counts with the overflow", () => {
    const { bars, overflow } = bucketCounts(small)
    expect(bars.map((b) => b.count)).toEqual([2, 3])
    expect(bars.map((b) => b.from)).toEqual([0, 0.1])
    expect(overflow).toBe(1)
  })

  it("interpolates quantiles linearly inside the reaching bucket", () => {
    // rank 3 of 6 lands in the second bucket, one third of the way from 0.1 to 1.
    expect(estimateQuantile(small, 0.5)?.seconds).toBeCloseTo(0.4)
    // rank 1 of 6 lands in the first bucket, interpolated from 0.
    expect(estimateQuantile(small, 1 / 6)?.seconds).toBeCloseTo(0.05)
  })

  it("reports a rank in the overflow as at least the last finite bound", () => {
    expect(estimateQuantile(small, 0.99)).toEqual({ q: 0.99, seconds: 1, beyondLast: true })
  })

  it("has no estimates or mean for an empty histogram", () => {
    const summary = summarizeHistogram({ count: 0n, sumSeconds: 0, buckets: small.buckets })
    expect(summary.quantiles).toEqual([])
    expect(summary.mean).toBeNull()
  })

  it("reads bigint counts", () => {
    const summary = summarizeHistogram({
      count: 3n,
      sumSeconds: 0.42,
      buckets: [
        { le: 0.1, count: 1n },
        { le: 0.25, count: 3n },
      ],
    })
    expect(summary.bars.map((b) => b.count)).toEqual([1, 2])
    expect(summary.mean).toBeCloseTo(0.14)
    expect(summary.quantiles.map((q) => q.q)).toEqual([0.5, 0.9, 0.99])
  })
})
