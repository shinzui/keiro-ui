import { expect, test } from "vitest"
import { z } from "zod"

import { int64, parseJsonLossless } from "../src/int64"
import { pageSchema } from "../src/pages"

const message = z.object({ msg_id: int64(), read_ct: z.number() })

test("next_cursor becomes nextCursor and int64 ids stay exact", () => {
  const page = pageSchema(message, int64()).parse(
    parseJsonLossless(
      '{"items":[{"msg_id":9007199254740993,"read_ct":0}],"next_cursor":9007199254740993}',
    ),
  )
  expect(page.items[0]!.msg_id).toBe(9007199254740993n)
  expect(page.nextCursor).toBe(9007199254740993n)
  expect("next_cursor" in page).toBe(false)
})

test("a missing or null next_cursor means the last page", () => {
  const schema = pageSchema(z.string(), z.string())
  expect(schema.parse({ items: ["a"] })).toEqual({ items: ["a"] })
  expect(schema.parse({ items: [], next_cursor: null })).toEqual({ items: [] })
})

test("declared page-level fields pass through (keiro observed_at)", () => {
  const schema = pageSchema(z.unknown(), z.string(), z.object({ observed_at: z.string() }))
  const page = schema.parse({
    items: [],
    next_cursor: "eyJ",
    observed_at: "2026-10-21T20:00:00Z",
    other: 1,
  })
  expect(page).toEqual({ items: [], nextCursor: "eyJ", observed_at: "2026-10-21T20:00:00Z" })
})

test("a string cursor is never derived from the items", () => {
  const page = pageSchema(z.object({ name: z.string() }), z.string()).parse({
    items: [{ name: "a" }, { name: "b" }],
    next_cursor: "page-inc-bob",
  })
  expect(page.nextCursor).toBe("page-inc-bob")
})
