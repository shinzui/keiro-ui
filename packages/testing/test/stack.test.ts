import { afterEach, describe, expect, test } from "vitest"

import { stackOrigin, stackPort } from "../src/stack"

const saved = process.env.STACK_KIROKU_PORT

afterEach(() => {
  if (saved === undefined) delete process.env.STACK_KIROKU_PORT
  else process.env.STACK_KIROKU_PORT = saved
})

describe("stack ports", () => {
  test("the environment wins over dev/.env, which wins over the default", () => {
    delete process.env.STACK_KIROKU_PORT
    expect(stackPort("kiroku", {})).toBe(9091)
    expect(stackPort("kiroku", { STACK_KIROKU_PORT: "19091" })).toBe(19091)
    process.env.STACK_KIROKU_PORT = "29091"
    expect(stackPort("kiroku", { STACK_KIROKU_PORT: "19091" })).toBe(29091)
    expect(stackOrigin("kiroku")).toBe("http://127.0.0.1:29091")
  })

  test("a value that is not a TCP port is refused, naming the variable", () => {
    delete process.env.STACK_KIROKU_PORT
    expect(() => stackPort("kiroku", { STACK_KIROKU_PORT: "kiroku" })).toThrow(
      "STACK_KIROKU_PORT=kiroku is not a TCP port",
    )
  })
})
