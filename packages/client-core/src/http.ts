import { normalizeError, ApiError } from "./errors"
import { parseJsonLossless, serializeJson } from "./int64"
import type { Surface } from "./surface"

export type QueryValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | ReadonlyArray<string | number | bigint | boolean>
export type Query = Record<string, QueryValue>

export interface RequestOptions {
  query?: Query
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Non-2xx statuses whose JSON body is returned instead of thrown (health routes' 503). */
  okStatuses?: readonly number[]
}

export interface HttpClient {
  readonly surface: Surface
  readonly baseUrl: string
  url(path: string, query?: Query): string
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>
  post<T = unknown>(path: string, options?: RequestOptions & { body?: unknown }): Promise<T>
}

/** Root-relative base URLs resolve against the page origin (or the dev server in node). */
function resolveBase(baseUrl: string): string {
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  if (/^https?:\/\//.test(trimmed)) return trimmed
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:5173"
  return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
}

function encodeValue(value: string | number | bigint | boolean): string {
  return typeof value === "string" ? value : String(value)
}

/** Keys in the caller's order; undefined omitted; arrays repeat the key (keiro's repeatable flags). */
export function encodeQuery(query: Query | undefined): string {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value as ReadonlyArray<string | number | bigint | boolean>)
        params.append(key, encodeValue(item))
    } else {
      params.append(key, encodeValue(value as string | number | bigint | boolean))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ""
}

export function createHttpClient(options: {
  surface: Surface
  baseUrl: string
  fetch?: typeof fetch
  headers?: Record<string, string>
}): HttpClient {
  const { surface } = options
  const base = resolveBase(options.baseUrl)
  const doFetch =
    options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  const url = (path: string, query?: Query) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}${encodeQuery(query)}`

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    opts: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...options.headers,
      ...opts.headers,
    }
    const init: RequestInit = { method, headers, signal: opts.signal }
    if (opts.body !== undefined) {
      headers["content-type"] = "application/json"
      init.body = serializeJson(opts.body)
    }
    let response: Response
    try {
      response = await doFetch(url(path, opts.query), init)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error
      throw new ApiError({
        surface,
        status: 0,
        code: "network_error",
        message: error instanceof Error ? error.message : String(error),
        raw: error,
      })
    }
    const text = await response.text()
    if (!response.ok && !(opts.okStatuses ?? []).includes(response.status)) {
      throw normalizeError(surface, response.status, text, response.headers)
    }
    if (response.status === 204 || text.trim() === "") return undefined as T
    try {
      return parseJsonLossless(text) as T
    } catch {
      throw new ApiError({
        surface,
        status: response.status,
        code: "invalid_json",
        message: "The response body is not JSON",
        raw: text,
        headers: response.headers,
      })
    }
  }

  return {
    surface,
    baseUrl: base,
    url,
    get: (path, opts) => request("GET", path, opts),
    post: (path, opts) => request("POST", path, opts),
  }
}
