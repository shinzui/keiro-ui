import { afterEach, describe, expect, test } from "vitest"

import {
  formatInt64,
  int64,
  parseJsonLossless,
  parseJsonLosslessFallback,
  serializeJson,
  setJsonSourceSupport,
  supportsJsonSource,
  toInt64,
} from "../src/int64"

afterEach(() => setJsonSourceSupport(true))

const samples = [
  '{"msg_id":9223372036854775807}',
  '{"id":9007199254740993,"count":42,"ratio":3.5,"big":1e20,"neg":-9223372036854775808}',
  '{"text":"9223372036854775807","nested":{"items":[1,9007199254740993,"x\\"9007199254740993"]}}',
  '[9007199254740993, 2, -3.25e-2, "a\\\\", true, null]',
  '{"items":[{"msg_id":9007199254740994,"read_ct":0}],"next_cursor":9007199254740994}',
]

describe("parseJsonLossless", () => {
  test("this runtime supports the source-text path", () => {
    expect(supportsJsonSource).toBe(true)
  })

  test("int64 maximum survives as bigint", () => {
    const parsed = parseJsonLossless('{"msg_id":9223372036854775807}') as { msg_id: bigint }
    expect(parsed.msg_id).toBe(9223372036854775807n)
  })

  test("only oversized integers become bigint", () => {
    const parsed = parseJsonLossless(samples[1]!) as Record<string, unknown>
    expect(parsed.id).toBe(9007199254740993n)
    expect(parsed.count).toBe(42)
    expect(parsed.ratio).toBe(3.5)
    expect(parsed.big).toBe(1e20)
    expect(parsed.neg).toBe(-9223372036854775808n)
  })

  test("strings containing digits are untouched", () => {
    const parsed = parseJsonLossless(samples[2]!) as { text: string; nested: { items: unknown[] } }
    expect(parsed.text).toBe("9223372036854775807")
    expect(parsed.nested.items).toEqual([1, 9007199254740993n, 'x"9007199254740993'])
  })

  test.each(samples)("the fallback agrees with the source path: %s", (sample) => {
    expect(parseJsonLosslessFallback(sample)).toEqual(parseJsonLossless(sample))
  })

  test("setJsonSourceSupport(false) forces the fallback", () => {
    setJsonSourceSupport(false)
    expect((parseJsonLossless(samples[0]!) as { msg_id: bigint }).msg_id).toBe(9223372036854775807n)
  })
})

describe("serializeJson", () => {
  test("a bigint becomes a bare integer literal", () => {
    expect(serializeJson({ id: 9223372036854775807n })).toBe('{"id":9223372036854775807}')
    expect(serializeJson({ confirm: "execute" })).toBe('{"confirm":"execute"}')
  })

  test("round trip keeps the exact digits", () => {
    const text =
      '{"items":[{"msg_id":9007199254740994,"read_ct":0}],"next_cursor":9007199254740994}'
    expect(serializeJson(parseJsonLossless(text))).toBe(text)
  })
})

describe("int64()", () => {
  test("normalizes numbers, bigints, and decimal strings to bigint", () => {
    expect(int64().parse(42)).toBe(42n)
    expect(int64().parse(9007199254740993n)).toBe(9007199254740993n)
    expect(int64().parse("9223372036854775807")).toBe(9223372036854775807n)
  })

  test("rejects non-integers", () => {
    expect(int64().safeParse(3.5).success).toBe(false)
    expect(int64().safeParse("12a").success).toBe(false)
    expect(int64().safeParse(2 ** 60).success).toBe(false)
  })

  test("toInt64 and formatInt64", () => {
    expect(toInt64("7")).toBe(7n)
    expect(formatInt64(1234567n, { grouping: true })).toBe("1 234 567")
    expect(formatInt64(9223372036854775807n)).toBe("9223372036854775807")
  })
})
