import { expect, test } from "vitest"

import {
  formatBytes,
  formatDuration,
  formatInt,
  formatPositionDistance,
  formatRelativeTime,
  formatTimestamp,
  POSITION_DISTANCE_LABEL,
} from "./format"
// oxlint-disable-next-line import/default -- Vite raw imports have a default export
import source from "./format.ts?raw"

const now = new Date("2026-10-21T12:00:00Z")

test("formatRelativeTime", () => {
  expect(formatRelativeTime("2026-10-21T11:59:57Z", now)).toBe("3 s ago")
  expect(formatRelativeTime("2026-10-21T12:02:00Z", now)).toBe("in 2 min")
  expect(formatRelativeTime("2026-10-21T09:00:00Z", now)).toBe("3 h ago")
  expect(formatRelativeTime("2026-10-20T11:00:00Z", now)).toBe("yesterday")
  expect(formatRelativeTime("2026-10-16T12:00:00Z", now)).toBe("5 d ago")
  expect(formatRelativeTime("2026-08-01T12:00:00Z", now)).toBe("2026-08-01")
  expect(formatRelativeTime(now, now)).toBe("just now")
  expect(formatRelativeTime("not a date", now)).toBe("unknown time")
})

test("formatDuration", () => {
  expect(formatDuration(0.84)).toBe("840 ms")
  expect(formatDuration(3.2)).toBe("3.2 s")
  expect(formatDuration(42)).toBe("42 s")
  expect(formatDuration(252)).toBe("4 min 12 s")
  expect(formatDuration(7500)).toBe("2 h 05 min")
  expect(formatDuration(3 * 86400 + 4 * 3600)).toBe("3 d 04 h")
})

test("formatTimestamp", () => {
  expect(formatTimestamp("2026-10-21T11:59:57.123+02:00", now)).toEqual({
    absolute: "2026-10-21T09:59:57.123Z",
    relative: "2 h ago",
  })
})

test("formatInt groups with thin spaces and is exact for bigint", () => {
  expect(formatInt(1234567)).toBe("1 234 567")
  expect(formatInt(999)).toBe("999")
  expect(formatInt(-1234)).toBe("−1 234")
  expect(formatInt(2n ** 63n - 1n)).toBe("9 223 372 036 854 775 807")
})

test("formatBytes", () => {
  expect(formatBytes(512)).toBe("512 B")
  expect(formatBytes(1536)).toBe("1.5 KiB")
  expect(formatBytes(50 * 1024 * 1024)).toBe("50 MiB")
})

test("formatPositionDistance", () => {
  expect(formatPositionDistance(100n, 100n)).toEqual({
    distance: 0n,
    text: "at visible store head",
  })
  expect(formatPositionDistance(2000n, 766n)).toEqual({
    distance: 1234n,
    text: "1 234 behind visible store head",
  })
  expect(POSITION_DISTANCE_LABEL).toBe("global position distance")
})

test("format.ts never uses the forbidden vocabulary", () => {
  expect(source).not.toMatch(/\blag\b/i)
  expect(source).not.toMatch(/\bbacklog\b/i)
})
