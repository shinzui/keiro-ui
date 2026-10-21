import { expect, test } from "vitest"

import { deriveSegments } from "./segments"

const at = (s: number) => new Date(Date.UTC(2026, 9, 21, 0, 0, s)).toISOString()

test("spans between consecutive entries, time to first step, and the longest span", () => {
  const result = deriveSegments(
    [{ recorded_at: at(2) }, { recorded_at: at(3) }, { recorded_at: at(10) }],
    at(0),
  )
  expect(result.perEntry.map((s) => s.spanSeconds)).toEqual([2, 1, 7])
  expect(result.perEntry.map((s) => s.cumulativeSeconds)).toEqual([2, 3, 10])
  expect(result.timeToFirstStepSeconds).toBe(2)
  expect(result.totalSeconds).toBe(10)
  expect(result.longestIndex).toBe(2)
})

test("a page without its predecessor has no span for its first entry", () => {
  const result = deriveSegments([{ recorded_at: at(5) }, { recorded_at: at(6) }], at(0), false)
  expect(result.perEntry.map((s) => s.spanSeconds)).toEqual([null, 1])
  expect(result.timeToFirstStepSeconds).toBeNull()
  expect(result.longestIndex).toBe(1)
})

test("no entries and unparseable timestamps derive nothing", () => {
  expect(deriveSegments([], at(0))).toMatchObject({ totalSeconds: null, longestIndex: null })
  expect(deriveSegments([{ recorded_at: "garbage" }], at(0)).perEntry[0]?.spanSeconds).toBeNull()
})
