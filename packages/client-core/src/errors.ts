import { parseJsonLossless } from "./int64"
import type { Surface } from "./surface"

/**
 * Every failure from a surface. Three wire envelopes are normalized: the nested
 * `{"error":{code,message,details?}}` (kiroku's new routes, pgmq, keiro), shibuya's flat
 * `{"error":"text","code":"...",...context}`, and kiroku's legacy `{"error":"text",...}`
 * (code `legacy_error`); anything else becomes `http_<status>`. Network failures are status 0,
 * code `network_error`. Nothing inside `details` is renamed.
 */
export class ApiError extends Error {
  readonly surface: Surface
  readonly status: number
  readonly code: string
  readonly details?: unknown
  /** The parsed body, or the body text when it was not JSON. */
  readonly raw: unknown
  readonly headers: Headers

  constructor(init: {
    surface: Surface
    status: number
    code: string
    message: string
    details?: unknown
    raw: unknown
    headers?: Headers
  }) {
    super(init.message)
    this.name = "ApiError"
    this.surface = init.surface
    this.status = init.status
    this.code = init.code
    this.details = init.details
    this.raw = init.raw
    this.headers = init.headers ?? new Headers()
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function without(record: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
}

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  426: "Upgrade Required",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
}

export function normalizeError(
  surface: Surface,
  status: number,
  bodyText: string,
  headers: Headers,
): ApiError {
  let body: unknown = bodyText
  try {
    body = bodyText ? parseJsonLossless(bodyText) : bodyText
  } catch {
    body = bodyText
  }
  if (isObject(body)) {
    const error = body.error
    if (isObject(error) && typeof error.code === "string") {
      return new ApiError({
        surface,
        status,
        code: error.code,
        message: typeof error.message === "string" ? error.message : error.code,
        details: error.details,
        raw: body,
        headers,
      })
    }
    if (typeof error === "string" && typeof body.code === "string") {
      return new ApiError({
        surface,
        status,
        code: body.code,
        message: error,
        details: without(body, "error", "code"),
        raw: body,
        headers,
      })
    }
    if (typeof error === "string") {
      return new ApiError({
        surface,
        status,
        code: "legacy_error",
        message: error,
        details: without(body, "error"),
        raw: body,
        headers,
      })
    }
  }
  const text = typeof body === "string" ? body.trim() : bodyText
  return new ApiError({
    surface,
    status,
    code: `http_${status}`,
    message: STATUS_TEXT[status] ?? (text.slice(0, 200) || `HTTP ${status}`),
    raw: body,
    headers,
  })
}

export function isApiError(value: unknown, code?: string): value is ApiError {
  return value instanceof ApiError && (code === undefined || value.code === code)
}
