import { expect, test } from "vitest"

import { keyPart, queryKeys, surfaceKey } from "../src/query-keys"

test("the surface is always the first key element", () => {
  expect(queryKeys.kiroku("streams", { category: "orders" })).toEqual([
    "kiroku",
    "streams",
    { category: "orders" },
  ])
  expect(surfaceKey("keiro", "workflows")).toEqual(["keiro", "workflows"])
})

test("bigint becomes its decimal string, also nested", () => {
  expect(keyPart(9007199254740993n)).toBe("9007199254740993")
  expect(
    queryKeys.pgmq("message", { queue: "q", msgId: 9007199254740993n as unknown as string }),
  ).toEqual(["pgmq", "message", { queue: "q", msgId: "9007199254740993" }])
  expect(() => JSON.stringify(queryKeys.pgmq({ id: 1n as unknown as number }))).not.toThrow()
})

test("undefined values are dropped from object parts", () => {
  expect(keyPart({ a: 1, b: undefined })).toEqual({ a: 1 })
})
