// Derives fixtures for routes no runnable host can produce today and registers them in
// fixtures/_meta.json with `derived: true`. Run after `bun run fixtures:record`:
//   bun run --filter @keiro-ui/testing derive
//
// kiroku: the standalone kiroku-inspect runs no subscriptions and the jitsurei seed parks no
// dead letters, so /subscriptions, /metrics, /metrics/{subscription}, /subscription-checkpoints,
// and the dead-letter pages are derived from kiroku's docs/user/metrics.md shapes. The recorded
// (empty) bodies are kept as <slug>.recorded.json for empty-state tests.
//
// shibuya: the only long-running host (the shibuya-pgmq-adapter example consumer) builds
// against Hackage shibuya-metrics 0.10.0.x: no detailed fields, no /control. The default
// /metrics is shibuya-metrics/test/golden/processor-metrics.json.golden (every processor state,
// latency, progress, oldestInFlight); the recorded basic map is metrics.recorded.json.
//
// keiro: /aggregate/* and /pm/* fixtures are written by hand from keiro's encoders (see their
// derived_from); this script only re-registers them.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { arrayElements, bigintField, stringField } from "../src/json-text"
import type { FileMeta, Manifest, MetaFile } from "../src/types"

const packageRoot = join(dirname(new URL(import.meta.url).pathname), "..")
const fixturesDir = join(packageRoot, "fixtures")
const metaPath = join(fixturesDir, "_meta.json")
const meta = JSON.parse(readFileSync(metaPath, "utf8")) as MetaFile

const SHIBUYA_REPO = "mori://shinzui/shibuya"
const KIROKU_DOCS = "mori://shinzui/kiroku docs/user/metrics.md"

function read(relative: string): string {
  return readFileSync(join(fixturesDir, relative), "utf8")
}

/** Keeps a recorded body as `<slug>.recorded.json` (once) before the derived default replaces it. */
function keepRecorded(relative: string) {
  const entry = meta.files[relative]
  if (!entry || entry.derived) return
  const recorded = relative.replace(/\.json$/, ".recorded.json")
  renameSync(join(fixturesDir, relative), join(fixturesDir, recorded))
  meta.files[recorded] = { ...entry, variant: "recorded" }
  delete meta.files[relative]
}

function derive(relative: string, body: string, entry: Omit<FileMeta, "derived">) {
  writeFileSync(join(fixturesDir, relative), body)
  meta.files[relative] = { ...entry, derived: true }
  console.log(`derived ${relative}`)
}

function json(value: unknown): string {
  return JSON.stringify(value)
}

// --- kiroku --------------------------------------------------------------------------------

const kirokuManifestPath = join(packageRoot, "manifests/kiroku.json")
const kirokuManifest = JSON.parse(readFileSync(kirokuManifestPath, "utf8")) as Manifest

// Named after keiro's projection group so the Projections and Subscriptions screens join.
const ORDERS = "jitsurei-order-reporting"
const CHAPTERS = "jitsurei-area-chapters"

interface RecordedEvent {
  position: bigint
  id: string
}

function recordedEvents(): RecordedEvent[] {
  const byPosition = new Map<bigint, RecordedEvent>()
  for (const slug of ["events-forward", "events-forward.page2", "events-backward"]) {
    const relative = `kiroku/${slug}.json`
    if (!existsSync(join(fixturesDir, relative))) continue
    for (const element of arrayElements(read(relative), "items")) {
      const position = bigintField(element, "globalPosition") ?? 0n
      byPosition.set(position, { position, id: stringField(element, "eventId") ?? "" })
    }
  }
  return [...byPosition.values()].toSorted((a, b) => (a.position < b.position ? -1 : 1))
}

function deriveKiroku() {
  const recordedCheckpoints = read(
    existsSync(join(fixturesDir, "kiroku/subscription-checkpoints.recorded.json"))
      ? "kiroku/subscription-checkpoints.recorded.json"
      : "kiroku/subscription-checkpoints.json",
  )
  const head = Number(bigintField(recordedCheckpoints, "store_position") ?? 0n)
  const events = recordedEvents()
  const at = (minutesAgo: number) =>
    new Date(Date.parse(meta.recorded_at) - minutesAgo * 60_000).toISOString()

  const checkpoints = [
    { subscription: CHAPTERS, member: 0, position: head },
    { subscription: ORDERS, member: 0, position: Math.max(head - 2, 0) },
    { subscription: ORDERS, member: 1, position: Math.min(9, head) },
  ]

  keepRecorded("kiroku/subscription-checkpoints.json")
  derive(
    "kiroku/subscription-checkpoints.json",
    `{"checkpoints":[${checkpoints
      .map(
        (c, i) =>
          `{"checkpoint_position":${c.position},"member":${c.member},"subscription":${json(c.subscription)},"updated_at":${json(at(i + 1))}}`,
      )
      .join(",")}],"store_position":${head}}`,
    {
      ...meta.files["kiroku/subscription-checkpoints.recorded.json"]!,
      variant: "default",
      derived_from: `${KIROKU_DOCS} (Durable subscription checkpoints); names from keiro projection groups`,
    },
  )

  // The live registry: member 1 of the orders subscription is retrying behind its checkpoint.
  keepRecorded("kiroku/subscriptions-live.json")
  derive(
    "kiroku/subscriptions-live.json",
    `[${[
      { subscription: CHAPTERS, member: 0, phase: "live", position: head },
      { subscription: ORDERS, member: 0, phase: "live", position: Math.max(head - 1, 0) },
      { subscription: ORDERS, member: 1, phase: "retrying", position: Math.min(9, head) },
    ]
      .map(
        (r) =>
          `{"global_position":${r.position},"member":${r.member},"phase":${json(r.phase)},"subscription":${json(r.subscription)}}`,
      )
      .join(",")}]`,
    {
      ...meta.files["kiroku/subscriptions-live.recorded.json"]!,
      variant: "default",
      derived_from: `${KIROKU_DOCS} (Subscription status over HTTP)`,
    },
  )
  derive("kiroku/subscriptions-live.error.json", `{"error":"subscription status not configured"}`, {
    surface: "kiroku",
    slug: "subscriptions-live",
    variant: "error",
    method: "GET",
    template: "/subscriptions",
    query: { scenario: "unconfigured" },
    params: {},
    request: "/subscriptions?scenario=unconfigured",
    status: 404,
    contentType: "application/json",
    derived_from: `${KIROKU_DOCS}: embedded hosts without a provider; select with useScenario({ fail: { kiroku: ["subscriptions-live"] } })`,
  })

  const ordersMetrics = `{"db_error_count":3,"lag":${head - 9},"last_known_position":9,"last_stop_reason":"crashed"}`
  const chaptersMetrics = `{"db_error_count":0,"lag":0,"last_known_position":${head},"last_stop_reason":null}`
  keepRecorded("kiroku/metrics.json")
  const recordedMetrics = read("kiroku/metrics.recorded.json")
  derive(
    "kiroku/metrics.json",
    recordedMetrics
      .replace('"active_subscribers":0', '"active_subscribers":3')
      .replace('"subscriptions_started":0', '"subscriptions_started":3')
      .replace('"subscriptions_caught_up":0', '"subscriptions_caught_up":2')
      .replace('"subscriptions_retrying":0', '"subscriptions_retrying":4')
      .replace('"subscriptions_stopped_crashed":0', '"subscriptions_stopped_crashed":1')
      .replace('"subscriptions_dead_lettered":0', '"subscriptions_dead_lettered":13')
      .replace(
        '"subscriptions":{}',
        `"subscriptions":{${json(CHAPTERS)}:${chaptersMetrics},${json(ORDERS)}:${ordersMetrics}}`,
      ),
    {
      ...meta.files["kiroku/metrics.recorded.json"]!,
      variant: "default",
      derived_from: `${KIROKU_DOCS} (GET /metrics): recorded store and counters with two subscriptions added`,
    },
  )
  derive("kiroku/metrics-subscription.json", ordersMetrics, {
    surface: "kiroku",
    slug: "metrics-subscription",
    variant: "default",
    method: "GET",
    template: "/metrics/{subscription}",
    query: {},
    params: { subscription: ORDERS },
    request: `/metrics/${ORDERS}`,
    status: 200,
    contentType: "application/json",
    derived_from: `${KIROKU_DOCS} (GET /metrics/<subscription>)`,
  })

  // Thirteen parked events for the orders subscription, newest first, over two members; each
  // event_id and global_position is a recorded $all event so the event links resolve.
  const parked = events.slice(-13).toReversed()
  const reasons = [
    { kind: "poison", detail: "unknown SKU" },
    { kind: "max_attempts_exceeded", detail: "5 attempts" },
    { kind: "decode_failure", detail: "unexpected schemaVersion 3" },
  ]
  const items = parked.map((event, index) => {
    const reason = reasons[index % reasons.length]!
    const id = 100 - index
    return {
      raw: `{"attempt_count":${(index % 5) + 1},"created_at":${json(at(index * 7))},"dead_letter_id":${id},"event_id":${json(event.id)},"global_position":${event.position},"member":${index % 2},"reason":{"detail":${json(reason.detail)},"kind":${json(reason.kind)}},"reason_summary":${json(`${reason.kind}: ${reason.detail}`)},"subscription":${json(ORDERS)}}`,
      cursor: `${event.position}:${id}`,
    }
  })
  const firstPage = items.slice(0, 10)
  const cursor = firstPage[firstPage.length - 1]!.cursor
  keepRecordedIfPresent("kiroku/dead-letters.json")
  const base = {
    surface: "kiroku" as const,
    slug: "dead-letters",
    method: "GET",
    template: "/subscriptions/{subscription}/dead-letters",
    params: { subscription: ORDERS },
    status: 200,
    contentType: "application/json",
    derived_from: `${KIROKU_DOCS} (Dead letters over HTTP); cursor format "<position>:<dead_letter_id>" from Kiroku/Metrics/DeadLetters.hs renderDeadLetterCursor`,
  }
  derive(
    "kiroku/dead-letters.json",
    `{"items":[${firstPage.map((i) => i.raw).join(",")}],"next_cursor":${json(cursor)}}`,
    {
      ...base,
      variant: "default",
      query: { limit: "10" },
      request: `/subscriptions/${ORDERS}/dead-letters?limit=10`,
    },
  )
  derive(
    "kiroku/dead-letters.page2.json",
    `{"items":[${items
      .slice(10)
      .map((i) => i.raw)
      .join(",")}]}`,
    {
      ...base,
      variant: "page2",
      query: { limit: "10", from: cursor },
      request: `/subscriptions/${ORDERS}/dead-letters?limit=10&from=${encodeURIComponent(cursor)}`,
      cursor,
    },
  )
  derive("kiroku/dead-letters.recorded.json", `{"items":[]}`, {
    ...base,
    variant: "recorded",
    query: { limit: "10" },
    request: `/subscriptions/${ORDERS}/dead-letters?limit=10`,
    derived_from:
      'kiroku answers 200 {"items":[]} for a subscription with nothing parked (the jitsurei seed parks nothing)',
  })

  kirokuManifest.pins.subscription = ORDERS
  kirokuManifest.pins.member = "0"
  writeFileSync(kirokuManifestPath, `${JSON.stringify(kirokuManifest, null, 2)}\n`)
}

function keepRecordedIfPresent(relative: string) {
  if (meta.files[relative]) keepRecorded(relative)
}

// --- shibuya -------------------------------------------------------------------------------

function deriveShibuya() {
  const golden = readFileSync(
    join(
      process.env.SHIBUYA_REPO ?? "/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya",
      "shibuya-metrics/test/golden/processor-metrics.json.golden",
    ),
    "utf8",
  ).trim()
  keepRecorded("shibuya/metrics.json")
  derive("shibuya/metrics.json", golden, {
    ...meta.files["shibuya/metrics.recorded.json"]!,
    variant: "default",
    derived_from: `${SHIBUYA_REPO} shibuya-metrics/test/golden/processor-metrics.json.golden (artifact-level URI pending)`,
  })
  const detailed = /"detailed":(\{.*?"stats":\{[^}]*\}\})/.exec(golden)?.[1]
  if (!detailed) throw new Error("golden has no `detailed` processor")
  derive("shibuya/processor-metrics-detailed.json", detailed, {
    surface: "shibuya",
    slug: "processor-metrics-detailed",
    variant: "default",
    method: "GET",
    template: "/metrics/{processor}",
    query: {},
    params: { processor: "detailed" },
    request: "/metrics/detailed",
    status: 200,
    contentType: "application/json",
    derived_from: `${SHIBUYA_REPO} shibuya-metrics/test/golden/processor-metrics.json.golden (the "detailed" processor)`,
  })

  keepRecorded("shibuya/control.json")
  derive("shibuya/control.json", `{"enabled":false,"operations":["pause","resume"]}`, {
    ...meta.files["shibuya/control.recorded.json"]!,
    variant: "default",
    status: 200,
    contentType: "application/json",
    derived_from: `${SHIBUYA_REPO} shibuya-metrics/src/Shibuya/Metrics/Control.hs (enableControl defaults off)`,
  })
  derive(
    "shibuya/control-pause.error.json",
    `{"code":"control_disabled","error":"Control operations are disabled"}`,
    {
      ...meta.files["shibuya/control-pause.error.json"]!,
      status: 403,
      contentType: "application/json",
      derived_from: `${SHIBUYA_REPO} shibuya-metrics/src/Shibuya/Metrics/Control.hs (403 control_disabled); the Hackage 0.10.0.x example host answers 404`,
    },
  )
}

deriveKiroku()
deriveShibuya()
meta.files = Object.fromEntries(
  Object.entries(meta.files).toSorted(([a], [b]) => a.localeCompare(b)),
)
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
