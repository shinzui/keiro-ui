import { expect, test } from "vitest"

import { decodeSheet, encodeSheet } from "./right-sheet"

test("encodeSheet joins kind and ref with the first colon", () => {
  expect(encodeSheet({ kind: "event", ref: "0b0c" })).toBe("event:0b0c")
  expect(encodeSheet({ kind: "stream-event", ref: "orders/42:7" })).toBe("stream-event:orders/42:7")
})

test("decodeSheet splits on the first colon only", () => {
  expect(decodeSheet("about:console")).toEqual({ kind: "about", ref: "console" })
  expect(decodeSheet("stream-event:orders/42:7")).toEqual({
    kind: "stream-event",
    ref: "orders/42:7",
  })
  expect(decodeSheet("timer:")).toEqual({ kind: "timer", ref: "" })
})

test("decodeSheet rejects empty and colon-less values", () => {
  expect(decodeSheet(undefined)).toBeNull()
  expect(decodeSheet("")).toBeNull()
  expect(decodeSheet("about")).toBeNull()
  expect(decodeSheet(":console")).toBeNull()
})

test("encode and decode round-trip", () => {
  const target = { kind: "queue-message", ref: "jobs:9007199254740993" }
  expect(decodeSheet(encodeSheet(target))).toEqual(target)
})
