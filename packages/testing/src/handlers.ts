import { http, type HttpHandler, type HttpResponse } from "msw"

import {
  fixtureMeta,
  fixtureResponse,
  fixtureText,
  hasFixture,
  manifests,
  rawResponse,
} from "./fixtures"
import { fieldText } from "./json-text"
import { categoryOf, kirokuLog } from "./kiroku-log"
import { scenarioState } from "./scenario"
import { type FileMeta, type Surface, surfaces } from "./types"

// One MSW handler per (method, path template) recorded in fixtures/_meta.json. A request is
// answered by the fixture whose path parameters equal the request's and whose query matches:
// an exact query match first (error and second-page requests), otherwise the variant with the
// same non-paging keys, paged by the surface's cursor parameter. Bodies are never sliced or
// re-serialized.

interface Candidate {
  relative: string
  meta: FileMeta
}

const PAGING_KEYS = new Set(["limit", "from", "after"])
const warned = new Set<string>()

function warnOnce(message: string) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`@keiro-ui/testing: ${message}`)
}

/** `/events/{event_cause}` and `/events/{id}` are one route: placeholders become positional. */
function shapeOf(template: string): string {
  return template.replace(/\{[a-z_]+\}/g, "{}")
}

function mswPath(prefix: string, shape: string): string {
  let index = 0
  const path = shape.replace(/\{\}/g, () => `:p${index++}`)
  return `*${prefix}${path === "/" ? "" : path}`
}

/** A candidate's parameter values in template order. */
function orderedParams(meta: FileMeta): string[] {
  return [...meta.template.matchAll(/\{([a-z_]+)\}/g)].map((m) => meta.params[m[1]!] ?? "")
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function sameEntries(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a)
  return ak.length === Object.keys(b).length && ak.every((k) => b[k] === a[k])
}

function withoutPaging(query: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([k]) => !PAGING_KEYS.has(k)))
}

function notFound(surface: Surface, path: string): HttpResponse<string> {
  const body =
    surface === "shibuya"
      ? JSON.stringify({ error: `no fixture for ${path}`, code: "not_found" })
      : JSON.stringify({ error: { code: "not_found", message: `no fixture for ${path}` } })
  return rawResponse(body, 404)
}

/** An empty last page of the same shape (page-level fields such as `observed_at` kept). */
function emptyPage(firstPage: string): string {
  const observed = fieldText(firstPage, "observed_at")
  return observed ? `{"items":[],"observed_at":${observed}}` : `{"items":[]}`
}

function choose(surface: Surface, candidates: Candidate[], url: URL): HttpResponse<string> {
  const query = Object.fromEntries(url.searchParams)
  const cursorParam = manifests[surface].cursor_param
  const failing = new Set(scenarioState.fail[surface] ?? [])
  const recorded = new Set(scenarioState.recorded[surface] ?? [])

  const defaults = candidates.filter((c) => c.meta.variant === "default")
  const firstError = candidates.find((c) => c.meta.variant === "error")

  // Scenario: a failing slug answers with its recorded error fixture.
  for (const candidate of defaults) {
    if (!failing.has(candidate.meta.slug)) continue
    const error = `${surface}/${candidate.meta.slug}.error.json`
    if (hasFixture(error)) return fixtureResponse(error)
  }

  const exact = candidates.find(
    (c) => c.meta.variant !== "recorded" && sameEntries(c.meta.query, query),
  )
  if (exact && exact.meta.variant !== "default") return fixtureResponse(exact.relative)

  const variant = defaults.find((c) =>
    sameEntries(withoutPaging(c.meta.query), withoutPaging(query)),
  )
  if (!variant) {
    if (firstError) return fixtureResponse(firstError.relative)
    return notFound(surface, `${url.pathname}${url.search}`)
  }

  const slug = variant.meta.slug
  const recordedFile = `${surface}/${slug}.recorded.json`
  const first = recorded.has(slug) && hasFixture(recordedFile) ? recordedFile : variant.relative

  const recordedLimit = variant.meta.query.limit
  if (query.limit !== undefined && recordedLimit !== undefined && query.limit !== recordedLimit) {
    warnOnce(
      `${surface} ${slug}: limit=${query.limit} requested, serving the page recorded with limit=${recordedLimit}`,
    )
  }

  const cursor = query[cursorParam]
  const recordedCursor = variant.meta.query[cursorParam]
  if (
    cursor === undefined ||
    cursor === recordedCursor ||
    (cursorParam === "from" && cursor === "0")
  ) {
    return fixtureResponse(first)
  }
  const page2 = candidates.find(
    (c) => c.meta.variant === "page2" && c.meta.slug === slug && c.meta.cursor === cursor,
  )
  if (page2) return fixtureResponse(page2.relative)
  return rawResponse(emptyPage(fixtureText(first)), 200)
}

/** kiroku routes answered from the stateful log once it has grown. */
function kirokuLogResponse(
  template: string,
  url: URL,
  params: string[],
): HttpResponse<string> | null {
  if (!kirokuLog.grown()) return null
  if (template === "/events") {
    // A malformed limit still answers with the recorded 400.
    const limit = url.searchParams.get("limit")
    return limit !== null && !/^\d+$/.test(limit) ? null : kirokuLog.page(url.searchParams)
  }
  if (template.startsWith("/categories/") && template.endsWith("/events")) {
    return kirokuLog.page(url.searchParams, params[0])
  }
  if (template.startsWith("/events/")) {
    const id = params[0] ?? ""
    const text = kirokuLog.get(id)
    return text ? rawResponse(text, 200) : fixtureResponse("kiroku/event.error.json")
  }
  if (template === "/subscription-checkpoints") {
    const relative =
      scenarioState.recorded.kiroku?.includes("subscription-checkpoints") &&
      hasFixture("kiroku/subscription-checkpoints.recorded.json")
        ? "kiroku/subscription-checkpoints.recorded.json"
        : "kiroku/subscription-checkpoints.json"
    return rawResponse(kirokuLog.checkpoints(fixtureText(relative)), 200)
  }
  return null
}

/** The request's positional parameters, decoded. */
function requestParams(
  shape: string,
  params: Record<string, string | readonly string[] | undefined>,
): string[] {
  const count = shape.split("{}").length - 1
  return Array.from({ length: count }, (_, i) => {
    const value = params[`p${i}`]
    return decodeURIComponent(Array.isArray(value) ? value.join("/") : String(value ?? ""))
  })
}

export function surfaceHandlers(surface: Surface): HttpHandler[] {
  const { prefix } = manifests[surface]
  const groups = new Map<string, Candidate[]>()
  for (const [relative, meta] of Object.entries(fixtureMeta.files)) {
    if (meta.surface !== surface) continue
    const key = `${meta.method} ${shapeOf(meta.template)}`
    groups.set(key, [...(groups.get(key) ?? []), { relative, meta }])
  }

  // Literal templates before parameterized ones, longer before shorter.
  const ordered = [...groups.entries()].toSorted(([a], [b]) => {
    const pa = a.includes("{") ? 1 : 0
    const pb = b.includes("{") ? 1 : 0
    return pa - pb || b.length - a.length
  })

  return ordered.flatMap(([key, candidates]) => {
    const [method, shape] = key.split(" ") as [string, string]
    const register = method === "POST" ? http.post : http.get
    const paths = shape === "/" ? [mswPath(prefix, "/"), `*${prefix}/`] : [mswPath(prefix, shape)]
    return paths.map((path) =>
      register(path, ({ request, params }) => {
        const url = new URL(request.url)
        const values = requestParams(shape, params)
        if (surface === "kiroku") {
          const live = kirokuLogResponse(shape, url, values)
          if (live) return live
        }
        const matching = candidates.filter((c) => sameList(orderedParams(c.meta), values))
        if (matching.length === 0) {
          // An entity no fixture was recorded for: its error fixture when one exists.
          const error = candidates.find((c) => c.meta.variant === "error")
          return error ? fixtureResponse(error.relative) : notFound(surface, url.pathname)
        }
        return choose(surface, matching, url)
      }),
    )
  })
}

export const handlers: HttpHandler[] = surfaces.flatMap((surface) => surfaceHandlers(surface))

export { categoryOf }
