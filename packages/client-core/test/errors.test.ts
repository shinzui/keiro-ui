import { expect, test } from "vitest"

import { isApiError, normalizeError } from "../src/errors"

const h = new Headers()

test("the nested envelope", () => {
  const error = normalizeError(
    "kiroku",
    404,
    '{"error":{"code":"stream_not_found","message":"No stream named \'orders-42\' exists.","details":{"stream_name":"orders-42"}}}',
    h,
  )
  expect(error.code).toBe("stream_not_found")
  expect(error.message).toBe("No stream named 'orders-42' exists.")
  expect(error.details).toEqual({ stream_name: "orders-42" })
  expect(error.status).toBe(404)
  expect(error.surface).toBe("kiroku")
})

test("shibuya's flat envelope", () => {
  const error = normalizeError(
    "shibuya",
    404,
    '{"error":"processor not found","code":"processor_not_found","processor":"orders"}',
    h,
  )
  expect(error.code).toBe("processor_not_found")
  expect(error.message).toBe("processor not found")
  expect(error.details).toEqual({ processor: "orders" })
  const disabled = normalizeError(
    "shibuya",
    403,
    '{"error":"Control operations are disabled","code":"control_disabled"}',
    h,
  )
  expect(disabled.code).toBe("control_disabled")
})

test("kiroku's legacy string envelope", () => {
  const error = normalizeError(
    "kiroku",
    404,
    '{"error":"subscription not found","subscription":"orders-projector"}',
    h,
  )
  expect(error.code).toBe("legacy_error")
  expect(error.message).toBe("subscription not found")
  expect(error.details).toEqual({ subscription: "orders-projector" })
})

test("non-JSON bodies become http_<status>", () => {
  const error = normalizeError("pgmq", 502, "<html><body>Bad gateway</body></html>", h)
  expect(error.code).toBe("http_502")
  expect(error.message).toBe("Bad Gateway")
  expect(error.raw).toBe("<html><body>Bad gateway</body></html>")
  const odd = normalizeError("pgmq", 418, "short and stout", h)
  expect(odd.message).toBe("short and stout")
})

test("details keep int64 values exact", () => {
  const error = normalizeError(
    "pgmq",
    404,
    '{"error":{"code":"message_not_found","message":"gone","details":{"msg_id":9007199254740993}}}',
    h,
  )
  expect(error.details).toEqual({ msg_id: 9007199254740993n })
})

test("isApiError narrows by code", () => {
  const error = normalizeError(
    "keiro",
    403,
    '{"error":{"code":"mutations_disabled","message":"no"}}',
    h,
  )
  expect(isApiError(error)).toBe(true)
  expect(isApiError(error, "mutations_disabled")).toBe(true)
  expect(isApiError(error, "schema_drift")).toBe(false)
  expect(isApiError(new Error("x"))).toBe(false)
})
