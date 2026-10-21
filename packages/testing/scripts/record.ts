// Records every manifest entry from the local runtime stack (dev/README.md) into
// packages/testing/fixtures/<surface>/<slug>[.<variant>].json, byte for byte, and writes
// fixtures/_meta.json. Usage: bun run fixtures:record [surface...]
//
// Bodies are written exactly as received (never JSON.parse + stringify): ids and positions
// are int64 and may exceed 2^53.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  type FileMeta,
  type Manifest,
  type ManifestEntry,
  type MetaFile,
  type Surface,
  surfaces,
} from "../src/types"

const packageRoot = join(dirname(new URL(import.meta.url).pathname), "..")
const repoRoot = join(packageRoot, "../..")
const fixturesDir = join(packageRoot, "fixtures")
const manifestsDir = join(packageRoot, "manifests")

function loadEnv(): Record<string, string> {
  const text = readFileSync(join(repoRoot, "dev/.env"), "utf8")
  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (!match) continue
    env[match[1]!] = match[2]!.replace(/^"(.*)"$/, "$1")
  }
  return env
}

const env = loadEnv()
const metaPath = join(fixturesDir, "_meta.json")

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return fallback
  }
}

const meta: MetaFile = readJson(metaPath, {
  recorded_at: "",
  seed: "",
  sources: {},
  files: {},
})

function gitHead(repo: string | undefined): string {
  if (!repo) return "unknown"
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "--short", "HEAD"]).toString().trim()
  } catch {
    return "unknown"
  }
}

function baseUrl(manifest: Manifest): string {
  return `http://127.0.0.1:${env[manifest.port_env]}`
}

/** Expands `{name}` in a template from params; returns null when a value is missing. */
function expand(template: string, values: Record<string, string>): string | null {
  let missing = false
  const out = template.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    const value = values[name]
    if (!value) {
      missing = true
      return ""
    }
    return encodeURIComponent(value)
  })
  return missing ? null : out
}

function templateParams(template: string): string[] {
  return [...template.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]!)
}

/** Reads `next_cursor` textually so a numeric cursor above 2^53 is not rounded. */
export function nextCursorOf(body: string): string | undefined {
  const match = /"next_cursor"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+)/.exec(body)
  if (!match) return undefined
  const raw = match[1]!
  return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw
}

function fileName(slug: string, variant: FileMeta["variant"]): string {
  return variant === "default" ? `${slug}.json` : `${slug}.${variant}.json`
}

async function fetchRaw(url: string, method: string) {
  const response = await fetch(url, { method, headers: { accept: "application/json" } })
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    body: await response.text(),
  }
}

let written = 0

function write(
  surface: Surface,
  slug: string,
  variant: FileMeta["variant"],
  body: string,
  entry: Omit<FileMeta, "surface" | "slug" | "variant">,
) {
  const relative = `${surface}/${fileName(slug, variant)}`
  mkdirSync(join(fixturesDir, surface), { recursive: true })
  writeFileSync(join(fixturesDir, relative), body)
  meta.files[relative] = { surface, slug, variant, ...entry }
  written += 1
  return relative
}

async function recordEntry(manifest: Manifest, entry: ManifestEntry, pins: Record<string, string>) {
  const values = { ...pins, ...entry.params }
  const path = expand(entry.path, values)
  const queryEntries = Object.entries(entry.query ?? {}).map(
    ([k, v]) => [k, expand(v, values)] as const,
  )
  if (path === null || queryEntries.some(([, v]) => v === null)) {
    console.log(
      `${manifest.surface.padEnd(8)} skip ${entry.slug} (unresolved: ${(entry.needs ?? templateParams(entry.path)).join(", ")})`,
    )
    return
  }
  const query = Object.fromEntries(queryEntries) as Record<string, string>
  const search = new URLSearchParams(query).toString()
  const request = `${path}${search ? `?${search}` : ""}`
  const method = entry.method ?? "GET"
  const variant: FileMeta["variant"] = entry.variant ?? "default"
  const resolvedParams = Object.fromEntries(templateParams(entry.path).map((p) => [p, values[p]!]))
  const response = await fetchRaw(`${baseUrl(manifest)}${request}`, method)
  const relative = write(manifest.surface, entry.slug, variant, response.body, {
    method,
    template: entry.path,
    query,
    params: resolvedParams,
    request,
    status: response.status,
    contentType: response.contentType,
  })
  console.log(
    `${manifest.surface.padEnd(8)} ${method} ${request.padEnd(60)} ${response.status}  ${relative}`,
  )

  const cursor = entry.follow_next_cursor ? nextCursorOf(response.body) : undefined
  if (cursor !== undefined) {
    const pageQuery = { ...query, [manifest.cursor_param]: cursor }
    const pageRequest = `${path}?${new URLSearchParams(pageQuery).toString()}`
    const page = await fetchRaw(`${baseUrl(manifest)}${pageRequest}`, method)
    const pageFile = write(manifest.surface, entry.slug, "page2", page.body, {
      method,
      template: entry.path,
      query: pageQuery,
      params: resolvedParams,
      request: pageRequest,
      status: page.status,
      contentType: page.contentType,
      cursor,
    })
    console.log(
      `${manifest.surface.padEnd(8)} ${method} ${pageRequest.padEnd(60)} ${page.status}  ${pageFile}`,
    )
  }
}

// ---------------------------------------------------------------------------------------
// Pin resolvers: fill empty pins from the live data. Explicit pins are kept.

interface KirokuEvent {
  eventId: string
  causationId: string | null
  globalPosition: number
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} → ${response.status}`)
  return (await response.json()) as T
}

const derivedEventPins: { slug: string; from: string; causation: string }[] = []

async function resolveKiroku(manifest: Manifest, pins: Record<string, string>) {
  const base = baseUrl(manifest)
  if (!pins.stream) {
    const streams = await getJson<{ items: { name: string; category: string; version: number }[] }>(
      `${base}/streams?limit=1000`,
    )
    const candidates = streams.items.filter((s) => s.version >= 2)
    const chosen =
      candidates.find((s) => s.category === "order") ?? candidates[0] ?? streams.items[0]
    if (chosen) {
      pins.stream = chosen.name
      pins.category ||= chosen.category
    }
  }
  if (!pins.subscription) {
    const checkpoints = await getJson<{
      checkpoints: { subscription?: string; member?: string; subscription_name?: string }[]
    }>(`${base}/subscription-checkpoints`)
    const first = checkpoints.checkpoints[0]
    if (first) {
      pins.subscription = first.subscription ?? first.subscription_name ?? ""
      pins.member ||= first.member ?? ""
    }
  }
  if (!pins.event_with_causation) {
    const events = await getJson<{ items: KirokuEvent[] }>(`${base}/events?from=0&limit=1000`)
    const ids = new Set(events.items.map((e) => e.eventId))
    const linked = events.items.find((e) => e.causationId && ids.has(e.causationId))
    if (linked) {
      pins.event_with_causation = linked.eventId
      pins.event_cause = linked.causationId!
    } else if (events.items.length >= 2) {
      // The seed links no events by causation: derive one (see recordDerivedEvents).
      pins.event_cause = events.items[0]!.eventId
      pins.event_with_causation = events.items[1]!.eventId
      derivedEventPins.push({
        slug: "event-with-causation",
        from: events.items[1]!.eventId,
        causation: events.items[0]!.eventId,
      })
    }
    const dangling = events.items.find((e) => e.causationId && !ids.has(e.causationId))
    if (dangling) pins.event_causation_unresolved = dangling.eventId
    else if (events.items.length >= 3) {
      pins.event_causation_unresolved = events.items[2]!.eventId
      derivedEventPins.push({
        slug: "event-causation-unresolved",
        from: events.items[2]!.eventId,
        causation: "00000000-0000-4000-8000-00000000dead",
      })
    }
  }
}

async function resolvePgmq(manifest: Manifest, pins: Record<string, string>) {
  const base = baseUrl(manifest)
  const firstId = async (path: string) => {
    const text = await (await fetch(`${base}${path}`)).text()
    return /"msg_id"\s*:\s*(\d+)/.exec(text)?.[1] ?? ""
  }
  pins.msg_id ||= await firstId(`/queues/${pins.queue}/messages?limit=1`)
  pins.archived_msg_id ||= await firstId(`/queues/${pins.queue}/archive?limit=1`)
  pins.dlq_msg_id ||= await firstId(`/queues/${pins.dlq_queue}/messages?limit=1`)
}

async function resolveShibuya(manifest: Manifest, pins: Record<string, string>) {
  if (pins.processor) return
  const metrics = await getJson<Record<string, unknown>>(`${baseUrl(manifest)}/metrics`)
  pins.processor = Object.keys(metrics).toSorted()[0] ?? ""
}

async function resolveKeiro(manifest: Manifest, pins: Record<string, string>) {
  const base = baseUrl(manifest)
  if (!pins.workflow_name) {
    const list = await getJson<{ items: { workflow_name: string; workflow_id: string }[] }>(
      `${base}/wf/inspect/list?limit=100`,
    )
    const first = list.items[0]
    if (first) {
      pins.workflow_name = first.workflow_name
      pins.workflow_id = first.workflow_id
    }
  }
  if (!pins.timer_id) {
    const pending = await getJson<{ items: { timer_id: string }[] }>(
      `${base}/timer/pending/list?limit=1`,
    )
    pins.timer_id = pending.items[0]?.timer_id ?? ""
  }
  if (!pins.subscription) {
    const subs = await getJson<{ checkpoints: { subscription?: string }[] }>(
      `${base}/stream/subscriptions`,
    )
    pins.subscription = subs.checkpoints[0]?.subscription ?? ""
  }
  if (!pins.stream) {
    const kiroku = readJson<Manifest | null>(join(manifestsDir, "kiroku.json"), null)
    pins.stream = kiroku?.pins.stream ?? ""
  }
}

const resolvers: Record<Surface, (m: Manifest, pins: Record<string, string>) => Promise<void>> = {
  kiroku: resolveKiroku,
  pgmq: resolvePgmq,
  shibuya: resolveShibuya,
  keiro: resolveKeiro,
}

/** Writes the derived single-event fixtures the kiroku resolver asked for. */
function recordDerivedEvents() {
  for (const { slug, from, causation } of derivedEventPins) {
    const relative = `kiroku/${slug}.json`
    const original = readFileSync(join(fixturesDir, relative), "utf8")
    const body = original.replace(
      /"causationId"\s*:\s*null/,
      `"causationId":${JSON.stringify(causation)}`,
    )
    writeFileSync(join(fixturesDir, relative), body)
    meta.files[relative] = {
      ...meta.files[relative]!,
      derived: true,
      derived_from: `recorded GET /events/${from} with causationId set to ${causation}`,
    }
    console.log(`kiroku   derived ${relative} (causationId → ${causation})`)
  }
}

async function main() {
  const requested = process.argv.slice(2) as Surface[]
  const selected = requested.length ? requested : [...surfaces]
  // kiroku first: keiro's stream pin reuses kiroku's.
  const ordered = selected.toSorted((a, b) => surfaces.indexOf(a) - surfaces.indexOf(b))

  for (const surface of ordered) {
    const manifestPath = join(manifestsDir, `${surface}.json`)
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest
    for (const key of Object.keys(meta.files)) {
      if (meta.files[key]!.surface === surface && !meta.files[key]!.derived) delete meta.files[key]
    }
    const pins = { ...manifest.pins }
    await resolvers[surface](manifest, pins)
    manifest.pins = pins
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    for (const entry of manifest.entries) await recordEntry(manifest, entry, pins)
    if (surface === "kiroku") recordDerivedEvents()
  }

  const repos: Record<string, string | undefined> = {
    kiroku: env.KIROKU_REPO,
    "pgmq-hs": env.PGMQ_HS_REPO,
    shibuya: env.SHIBUYA_REPO,
    "shibuya-pgmq-adapter": env.SHIBUYA_PGMQ_ADAPTER_REPO,
    keiro: env.KEIRO_REPO,
  }
  meta.sources = Object.fromEntries(
    Object.entries(repos).map(([name, repo]) => [name, { commit: gitHead(repo) }]),
  )
  meta.recorded_at = new Date().toISOString()
  meta.seed = `keiro just jitsurei-all (keiro ${gitHead(env.KEIRO_REPO)}) + dev/seed-queues.sh`
  meta.files = Object.fromEntries(
    Object.entries(meta.files).toSorted(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
  const commits = Object.entries(meta.sources)
    .map(([name, s]) => `${name} ${s.commit}`)
    .join(", ")
  console.log(`wrote ${written} fixtures; _meta.json updated (${commits}; seed jitsurei-all)`)
}

await main()
