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
// keiro: /aggregate/* and /pm/* fixtures were written by hand from keiro's encoders (see their
// derived_from); this script only registers them. The jitsurei seed leaves no pending or stuck
// timer, so /timer/pending/list and /timer/stuck/list are derived from keiro's timer encoders;
// the recorded (empty) bodies are kept as <slug>.recorded.json.
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

// --- keiro ---------------------------------------------------------------------------------

// The aggregate and process-manager routes exist only when a host mounts AppHooks; no runnable
// host does, so these bodies were written by hand from keiro's encoders (route grammar: only the
// command words are path segments; type, id, and correlation are query flags).
const KEIRO = "mori://shinzui/keiro"
const keiroPins: {
  aggregate_type: string
  aggregate_id: string
  process_manager: string
  correlation_id: string
  timer_id?: string
} = {
  aggregate_type: "order",
  aggregate_id: "demo-20261021202320671316000000",
  process_manager: "jitsurei-fulfillment",
  correlation_id: "demo-20261021202320671316000000",
}

function keiroEntry(
  slug: string,
  variant: "default" | "error",
  template: string,
  query: Record<string, string>,
  status: number,
  derivedFrom: string,
): Omit<FileMeta, "derived"> {
  const search = new URLSearchParams(query).toString()
  return {
    surface: "keiro",
    slug,
    variant,
    method: "GET",
    template,
    query,
    params: {},
    request: `${template}${search ? `?${search}` : ""}`,
    status,
    contentType: "application/json; charset=utf-8",
    derived_from: `${KEIRO} ${derivedFrom}`,
  }
}

function registerKeiro() {
  const {
    aggregate_type: type,
    aggregate_id: id,
    process_manager: pm,
    correlation_id: correlation,
  } = keiroPins
  const entries: [string, Omit<FileMeta, "derived">][] = [
    [
      "keiro/aggregate-types.json",
      keiroEntry(
        "aggregate-types",
        "default",
        "/aggregate/types",
        {},
        200,
        "keiro/src/Keiro/Inspection/Aggregate.hs aggregateTypeJson; keiro-ops/src/Keiro/Ops/Aggregate.hs ({items} envelope); inspectors jitsurei/src/Jitsurei/Inspection.hs",
      ),
    ],
    [
      "keiro/aggregate-list.json",
      keiroEntry(
        "aggregate-list",
        "default",
        "/aggregate/list",
        { name: type },
        200,
        "keiro/src/Keiro/Inspection/Aggregate.hs aggregateListPageJson; rows from the recorded kiroku/streams-by-category.json",
      ),
    ],
    [
      "keiro/aggregate-show.json",
      keiroEntry(
        "aggregate-show",
        "default",
        "/aggregate/show",
        { name: type, id },
        200,
        "keiro/src/Keiro/Inspection/Aggregate.hs aggregate view, hydration, and snapshot encoders; state folded from the recorded order stream",
      ),
    ],
    [
      "keiro/aggregate-show.error.json",
      keiroEntry(
        "aggregate-show",
        "error",
        "/aggregate/show",
        { name: type, id: "missing" },
        422,
        "keiro-ops-http Application.hs 422 command_failed for AggregateNotFound",
      ),
    ],
    [
      "keiro/aggregate-snapshot.json",
      keiroEntry(
        "aggregate-snapshot",
        "default",
        "/aggregate/snapshot",
        { name: type, id },
        200,
        "keiro/src/Keiro/Inspection/Aggregate.hs snapshotStatusJson; keiro-ops/src/Keiro/Ops/Aggregate.hs",
      ),
    ],
    [
      "keiro/pm-list.json",
      keiroEntry(
        "pm-list",
        "default",
        "/pm/list",
        { name: pm },
        200,
        "keiro/src/Keiro/ProcessManager/Inspect.hs instancePageJson",
      ),
    ],
    [
      "keiro/pm-show.json",
      keiroEntry(
        "pm-show",
        "default",
        "/pm/show",
        { name: pm, correlation },
        200,
        "keiro/src/Keiro/ProcessManager/Inspect.hs processManagerViewJson; journal event from the recorded $all log",
      ),
    ],
    [
      "keiro/pm-show.error.json",
      keiroEntry(
        "pm-show",
        "error",
        "/pm/show",
        { name: pm, correlation: "missing" },
        200,
        "keiro/src/Keiro/ProcessManager/Inspect.hs: an unknown correlation id answers 200 with the body null",
      ),
    ],
  ]
  for (const [relative, entry] of entries) {
    meta.files[relative] = { ...entry, derived: true }
    console.log(`registered ${relative}`)
  }
  // A host without AppHooks refuses the command word; bodies captured from the standalone
  // jitsurei keiro-ops-http on 2026-10-21 (served for the `fail` scenario).
  derive(
    "keiro/aggregate-types.error.json",
    json({
      error: {
        code: "invalid_request",
        details: { arguments: ["aggregate", "types"] },
        message: "Invalid argument `aggregate'\n\nUsage: keiro-ops COMMAND",
      },
    }),
    keiroEntry(
      "aggregate-types",
      "error",
      "/aggregate/types",
      {},
      400,
      "keiro-ops-http on a host without AppHooks (live capture)",
    ),
  )
  derive(
    "keiro/pm-list.error.json",
    json({
      error: {
        code: "invalid_request",
        details: { arguments: ["pm", "list", `--name=${pm}`] },
        message:
          "Invalid argument `pm'\n\nDid you mean one of these?\n    pgmq\n    wf\n\nUsage: keiro-ops COMMAND",
      },
    }),
    keiroEntry(
      "pm-list",
      "error",
      "/pm/list",
      { name: pm },
      400,
      "keiro-ops-http on a host without AppHooks (live capture)",
    ),
  )
  const manifestPath = join(packageRoot, "manifests/keiro.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest
  manifest.pins = { ...manifest.pins, ...keiroPins }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

// Timer bodies follow pendingTimerItemJson (keiro/src/Keiro/Timer/Schema.hs) and timerJson
// (keiro-ops/src/Keiro/Ops/Timer.hs); the pending query admits `scheduled` and `firing` rows.
function deriveKeiroTimers() {
  const pendingPath = "keiro/timers-pending.json"
  const stuckPath = "keiro/timers-stuck.json"
  const pendingEntry = meta.files[pendingPath] ?? meta.files["keiro/timers-pending.recorded.json"]
  const stuckEntry = meta.files[stuckPath] ?? meta.files["keiro/timers-stuck.recorded.json"]
  if (!pendingEntry || !stuckEntry) throw new Error("record keiro timers before deriving them")
  keepRecorded(pendingPath)
  keepRecorded(stuckPath)
  const observed = Date.parse("2026-10-21T21:16:03.515441Z")
  const at = (seconds: number) => new Date(observed + seconds * 1000).toISOString()
  const base = {
    process_manager_name: keiroPins.process_manager,
    correlation_id: keiroPins.correlation_id,
    fired_event_id: null,
  }
  const timers = [
    {
      ...base,
      timer_id: "7b2f6a0e-5c1d-4e8a-9f3b-2d6c8a1e4f01",
      fire_at: at(-600),
      payload: { kind: "escalate", level: 2 },
      status: "firing",
      attempts: 3,
      last_error: null,
      due_in_seconds: -600,
    },
    {
      ...base,
      timer_id: "93c1d4b2-6a0e-4f7d-8b21-5e9a0c3f7d02",
      fire_at: at(-40),
      payload: { kind: "reminder" },
      status: "scheduled",
      attempts: 1,
      last_error: "transient: store busy (inspection_busy)",
      due_in_seconds: -40,
    },
    {
      ...base,
      timer_id: "c4e85f17-2b9d-4a6c-9e03-7f1b8d2a6e03",
      fire_at: at(300),
      payload: { kind: "escalate", level: 1 },
      status: "scheduled",
      attempts: 0,
      last_error: null,
      due_in_seconds: 300,
    },
  ]
  derive(pendingPath, json({ items: timers, observed_at: new Date(observed).toISOString() }), {
    ...pendingEntry,
    variant: "default",
    derived_from: `${KEIRO} keiro/src/Keiro/Timer/Schema.hs pendingTimerPageJson; ledger invented for the jitsurei-fulfillment pin`,
  })
  const stuck = timers
    .filter((timer) => timer.status === "firing")
    .map(({ last_error: _error, due_in_seconds: _due, ...row }) => row)
  derive(stuckPath, json(stuck), {
    ...stuckEntry,
    variant: "default",
    derived_from: `${KEIRO} keiro-ops/src/Keiro/Ops/Timer.hs timerJson (a bare array); the firing row of the derived pending ledger`,
  })
  keiroPins.timer_id = timers[0]!.timer_id
}

// Projection status rows follow keiro_read.projection_group_status_v1 (keiro/src/Keiro/ReadModel/
// Rebuild/Status.hs) and shards follow keiro-ops/src/Keiro/Ops/Shard.hs. The jitsurei seed
// serves no position for any group and runs no sharded subscription, so the derived bodies
// keep the recorded rows and add one group per display case, aligned with the derived kiroku
// checkpoints of jitsurei-order-reporting (members at 28 and 9; head 30).
function deriveKeiroProjections() {
  const statusPath = "keiro/projection-status.json"
  const positionPath = "keiro/projection-position.json"
  const shardsPath = "keiro/shards.json"
  const shardStatusPath = "keiro/shard-status.json"
  const recordedEntry = (path: string) =>
    meta.files[path] ?? meta.files[path.replace(/\.json$/, ".recorded.json")]
  const entries = [statusPath, positionPath, shardsPath, shardStatusPath].map((path) => {
    const entry = recordedEntry(path)
    if (!entry) throw new Error(`record ${path} before deriving it`)
    return entry
  })
  for (const path of [statusPath, positionPath, shardsPath, shardStatusPath]) keepRecorded(path)
  const recorded = JSON.parse(read("keiro/projection-status.recorded.json")) as {
    items: Record<string, unknown>[]
    observed_at: string
  }
  const head = 30
  const quiet = {
    active_run_id: null,
    candidate_rebuild_head: null,
    candidate_rebuild_position: null,
    candidate_revision_id: null,
    failed_at: null,
    failure_code: null,
    failure_detail: null,
    last_promoted_at: "2026-10-21T20:23:21.000Z",
    rebuild_started_at: null,
    reads_allowed: true,
    writes_allowed: true,
    serving_epoch: 1,
  }
  const items = [
    ...recorded.items.filter((row) => row.serving_position_basis === "unmanaged").map((row) => row),
    {
      ...quiet,
      group_id: "jitsurei-order-reporting",
      lifecycle_phase: "live",
      query_models: ["jitsurei-order-reporting"],
      serving_position_basis: "checkpoint",
      serving_applied_position: 9,
      serving_revision_id: "rev-order-reporting-1",
    },
    {
      ...quiet,
      group_id: "jitsurei-order-search",
      lifecycle_phase: "rebuilding",
      query_models: ["jitsurei-order-search", "jitsurei-order-search-facets"],
      serving_position_basis: "append",
      serving_applied_position: head,
      serving_revision_id: "rev-order-search-1",
      active_run_id: "run-order-search-2",
      candidate_revision_id: "rev-order-search-2",
      candidate_rebuild_position: 12,
      candidate_rebuild_head: head,
      rebuild_started_at: "2026-10-21T21:10:00.000Z",
    },
    {
      ...quiet,
      group_id: "jitsurei-carrier-quotes",
      lifecycle_phase: "failed",
      query_models: ["jitsurei-carrier-quotes"],
      reads_allowed: false,
      writes_allowed: false,
      serving_position_basis: "checkpoint",
      serving_applied_position: 4,
      serving_revision_id: "rev-carrier-quotes-1",
      failed_at: "2026-10-21T21:12:00.000Z",
      failure_code: "apply_failed",
      failure_detail: { message: "carrier quote decode failed\nat stream version 3" },
    },
  ]
  derive(statusPath, json({ items, observed_at: recorded.observed_at, visible_store_head: head }), {
    ...entries[0]!,
    variant: "default",
    derived_from: `${KEIRO} keiro/src/Keiro/ReadModel/Rebuild/Status.hs (projection_group_status_v1); recorded unmanaged rows kept, one group per display case added`,
  })
  derive(
    positionPath,
    json({
      subscription: "jitsurei-order-reporting",
      store_position: head,
      visible_store_head: head,
      minimum_checkpoint_position: 9,
      maximum_global_position_distance: 21,
      members: [
        {
          subscription: "jitsurei-order-reporting",
          member: 0,
          checkpoint_position: 28,
          checkpoint_updated_at: "2026-10-21T21:24:50.767Z",
          global_position_distance: 2,
        },
        {
          subscription: "jitsurei-order-reporting",
          member: 1,
          checkpoint_position: 9,
          checkpoint_updated_at: "2026-10-21T21:23:50.767Z",
          global_position_distance: 21,
        },
      ],
    }),
    {
      ...entries[1]!,
      variant: "default",
      derived_from: `${KEIRO} keiro-ops projection position; members from the derived kiroku/subscription-checkpoints.json`,
    },
  )
  const observed = "2026-10-21T21:16:03.536744Z"
  derive(
    shardsPath,
    json({
      observed_at: observed,
      items: [
        {
          subscription: "jitsurei-order-reporting",
          shard_counts: [{ shard_count: 4, rows: 4 }],
          buckets_total: 4,
          buckets_live: 2,
          buckets_expired: 1,
          buckets_unowned: 1,
          live_owners: 2,
        },
      ],
    }),
    {
      ...entries[2]!,
      variant: "default",
      derived_from: `${KEIRO} keiro-ops/src/Keiro/Ops/Shard.hs listResult`,
    },
  )
  const lease = (bucket: number, owner: string | null, state: string, age: number | null) => ({
    bucket,
    owner,
    lease_expires_at: owner
      ? state === "expired"
        ? "2026-10-21T21:15:30.000Z"
        : "2026-10-21T21:16:30.000Z"
      : null,
    lease_state: state,
    heartbeat_at: owner ? "2026-10-21T21:16:00.000Z" : null,
    updated_at: "2026-10-21T21:16:00.000Z",
    lease_age_seconds: age,
  })
  derive(
    shardStatusPath,
    json({
      subscription: "jitsurei-order-reporting",
      observed_at: observed,
      shard_counts: [{ shard_count: 4, rows: 4 }],
      ownership: [
        lease(0, "worker-a", "live", 12.5),
        lease(1, "worker-b", "live", 8),
        lease(2, "worker-a", "expired", 95.2),
        lease(3, null, "unowned", null),
      ],
    }),
    {
      ...entries[3]!,
      variant: "default",
      derived_from: `${KEIRO} keiro-ops/src/Keiro/Ops/Shard.hs statusResult`,
    },
  )
}

// pgmq: only the pinned queue's detail and metrics were recorded; the dead-letter queue's are
// taken from its own elements of the recorded /queues and /metrics arrays.
function derivePgmqDeadLetterQueue() {
  const pgmqManifest = JSON.parse(
    readFileSync(join(packageRoot, "manifests/pgmq.json"), "utf8"),
  ) as Manifest
  const dlq = pgmqManifest.pins.dlq_queue
  if (!dlq) throw new Error("the pgmq manifest pins no dlq_queue")
  const element = (relative: string) => {
    const found = arrayElements(read(relative)).find((e) => stringField(e, "queue_name") === dlq)
    if (!found) throw new Error(`${relative} has no ${dlq}`)
    return found
  }
  const entry = (slug: string, template: string): Omit<FileMeta, "derived"> => ({
    ...meta.files[`pgmq/${slug}.json`]!,
    slug: `${slug}-dlq`,
    template,
    params: { queue: dlq },
    request: template.replace("{queue}", dlq),
    derived_from: `the ${dlq} element of the recorded pgmq/${slug === "queue" ? "queues" : "metrics"}.json`,
  })
  derive("pgmq/queue-dlq.json", element("pgmq/queues.json"), entry("queue", "/queues/{queue}"))
  derive(
    "pgmq/queue-metrics-dlq.json",
    element("pgmq/metrics.json"),
    entry("queue-metrics", "/queues/{queue}/metrics"),
  )
}

deriveKiroku()
deriveShibuya()
derivePgmqDeadLetterQueue()
deriveKeiroTimers()
deriveKeiroProjections()
registerKeiro()
meta.files = Object.fromEntries(
  Object.entries(meta.files).toSorted(([a], [b]) => a.localeCompare(b)),
)
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
