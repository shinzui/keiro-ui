import { expect, test } from "vitest"

import { formatInt } from "@/lib/format"

import { positionDistance } from "./distance"

test("unmanaged, none, caught up, behind, ahead", () => {
  expect(positionDistance({ head: 30n, applied: 9n, basis: "unmanaged" })).toEqual({
    kind: "unmanaged",
  })
  expect(positionDistance({ head: 30n, applied: null, basis: "checkpoint" })).toEqual({
    kind: "none",
  })
  expect(positionDistance({ head: 30n, applied: 30n, basis: "append" })).toEqual({
    kind: "caught-up",
  })
  expect(positionDistance({ head: 30n, applied: 9n, basis: "checkpoint" })).toEqual({
    kind: "behind",
    distance: 21n,
  })
  expect(positionDistance({ head: 30n, applied: 31n, basis: "checkpoint" })).toEqual({
    kind: "ahead",
    distance: 1n,
  })
})

test("exact beyond 2^53, and a feed's number head mixes with a bigint position", () => {
  const result = positionDistance({
    head: 9007199254740999n,
    applied: 9007199254740993n,
    basis: "append",
  })
  expect(result).toEqual({ kind: "behind", distance: 6n })
  const huge = positionDistance({ head: 2n ** 62n, applied: 1n, basis: "append" })
  expect(huge.kind === "behind" && formatInt(huge.distance)).toBe(
    ["4", "611", "686", "018", "427", "387", "903"].join("\u2009"),
  )
  expect(positionDistance({ head: 30, applied: 9n, basis: "checkpoint" })).toEqual({
    kind: "behind",
    distance: 21n,
  })
})
