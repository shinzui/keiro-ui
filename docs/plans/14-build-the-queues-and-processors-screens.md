---
id: 14
slug: build-the-queues-and-processors-screens
title: "Build the Queues and Processors screens"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
  revisions:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T15:56:48Z
      mode: "update"
      note: "Switch workspace tooling from pnpm to bun; vitest and Playwright kept on Node 22"
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      mode: "update"
      note: "Round 2: align to owning-plan spellings, correct audited upstream facts, e2e layout, light theme where applicable"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Build the Queues and Processors screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (the React application in `apps/console` of this repository,
coordinated by `docs/masterplans/2-build-the-keiro-runtime-console.md`) lets an operator
look inside an application built on the keiro runtime stack. This plan builds the
**Queues & Processors** section: the screens that answer "what is in this queue, how old is
its oldest message, why did this message dead-letter, and what are the queue processors
doing right now".

Queues are PostgreSQL-native work queues managed by pgmq; their inspection endpoints are
served by the `pgmq-inspect` package of the pgmq-hs repository. Processors are the
supervised consumers of those queues, run by the shibuya framework; their metrics are
served by the `shibuya-metrics` package. The console reaches both through the typed client
packages `@keiro-ui/client-pgmq` and `@keiro-ui/client-shibuya` built by
`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`, and renders them
inside the application shell built by
`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`.

After this plan an operator can start the console with `bun run dev` (or `VITE_MOCK=1 bun run dev`
against recorded fixtures), open `http://localhost:5173/queues`, and see every queue sorted
by the age of its oldest message with visible and total counts; click a queue to watch its
metrics update live, page through its messages and archive without leasing anything, open
a message in a right-hand sheet or on its own page, and see a structured "Dead letter"
panel whenever the message was written by the shibuya pgmq adapter's dead-lettering; open
`http://localhost:5173/processors` to see every processor's state, counters and oldest
in-flight message updating live from the shibuya WebSocket feed, and drill into one
processor for its latency histogram, cursor progress, and whether control operations are
enabled on the server. Nothing in this plan mutates anything: control is shown as text
only, and redrive is explicitly reported as unavailable.


## Progress

- [ ] M1: `/queues` lists every queue joined with its metrics, sorted by oldest message age
  descending by default, with sort and text filter in the URL; `/queues/$name` shows a
  metrics header that updates from the pgmq WebSocket feed over the authoritative poll.
- [ ] M2: `/queues/$name` has URL-selected Messages, Archive, and Bindings tabs with cursor
  paging, a routing-test tool, and a notify-throttles table; a row opens the
  `queue-message` right sheet; `/queues/$name/messages/$id` renders the full message with a
  structured Dead letter panel when the payload carries adapter dead-letter fields; a
  fixture id above 2^53 renders exactly.
- [ ] M3: `/processors` lists every processor from shibuya `/metrics` with state badge,
  counters, in-flight, and a locally extrapolated oldest-in-flight age, live from the
  shibuya feed; `terminal` frames regroup rows; the header summarizes `/health/ready`.
- [ ] M4: `/processors/$id` shows the state panel, counters, batch counters, a latency
  histogram with estimated p50/p90/p99, progress cursors per partition, and a read-only
  Control card reporting `GET /control`.
- [ ] M5: Sidebar entries, palette commands (`queue <name>`, `processor <id>`), recent
  entities, and the Playwright suite for this section pass against MSW fixtures.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The queue list polls `GET /pgmq/metrics` (one request for all queues) at the
  pgmq surface's 5-second default and never faster, and opens no WebSocket subscriptions;
  only the queue detail page subscribes to the feed, for its one queue.
  Rationale: `/metrics` runs `metrics_all`, which counts rows in every queue, so it is the
  most expensive read on the surface; the feed is per-queue and capped at 100 subscriptions
  per connection, so subscribing to every queue from a list would be both wasteful and
  bounded by server limits. Push remains a latency hint over the poll (ADR-3).
  Date: 2026-10-21

- Decision: The latency histogram and its p50/p90/p99 estimates are computed in the browser
  from shibuya's cumulative buckets using Prometheus-style linear interpolation and drawn
  with plain SVG inside `@keiro-ui/ui` primitives; no charting library is added by this plan.
  Rationale: the MasterPlan defers any charting-library decision to the Overview plan; 18
  cumulative buckets are trivially rendered as bars; the quantiles are estimates and are
  labelled as such.
  Date: 2026-10-21

- Decision: Dead-letter rendering is driven by payload shape — a message whose `message`
  value is an object carrying `original_message`, `dead_letter_reason`,
  `dead_letter_reason_code`, and `dead_letter_reason_detail` is treated as written by the
  shibuya pgmq adapter — and is read-only, with an explicit statement that redrive is not
  available because shibuya-pgmq-adapter IR-3 is still proposed. No disabled button and no
  stub action is rendered.
  Rationale: the adapter has no HTTP surface of its own (MasterPlan "Endpoint inventory"),
  and ADR-7 forbids a client-side workaround; the payload fields are the adapter's shipped
  IR-1 contract, so detecting them is the honest, available signal.
  Date: 2026-10-21

- Decision: The full message page is the placeholder route file EP-8 created,
  `apps/console/src/routes/_shell/queues/$name/messages/$id.tsx`, which is already a
  sibling of the queue page rather than a child of it (EP-8 created `queues/$name/index.tsx`
  and no `queues/$name.tsx` layout route, so nothing nests under the queue detail); the
  right sheet is the quick view and the page is the deep view.
  Rationale: the message page needs the whole content area for the payload viewer and the
  dead-letter panel; nesting it under the tabbed queue layout would waste space and couple
  the two.
  Date: 2026-10-21

- Decision: Control status is displayed as text ("Control enabled: yes/no", operations
  list) with no buttons; `docs/plans/19-add-gated-operator-actions.md` adds the pause and
  resume actions after the read-only release.
  Rationale: ADR-7 — the first release ships no mutations; showing the gate state now means
  EP-19 only adds the verbs.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

**The repository.** `apps/console` is the React 19 + TypeScript + Vite application;
`packages/ui` (`@keiro-ui/ui`) holds the shadcn/ui components generated on the React Aria
base, the Paper Mono font, and the theme; `packages/client-core` (`@keiro-ui/client-core`)
holds the HTTP client, error normalization, cursor paging, int64 handling, the WebSocket
core, and the live-query hooks; `packages/client-pgmq` and `packages/client-shibuya` hold
the typed clients for the two surfaces this plan reads; `packages/testing`
(`@keiro-ui/testing`) holds recorded fixtures and MSW handlers. Routes are files under
`apps/console/src/routes/` (TanStack Router file-based routing: the file path is the URL,
`$name` is a path parameter, `index.tsx` is the directory's own page, and every file of this
section already exists as a placeholder under `apps/console/src/routes/_shell/` created by
docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md — this plan
replaces their components and never creates or renames route files).
Feature code lives under `apps/console/src/features/<section>/`. UI primitives are imported
only from `@keiro-ui/ui/components/<name>`; nothing in this plan imports
`react-aria-components` directly (ADR-8).

**Terms.** A *queue* is a pgmq table of messages. A *message* has an int64 `msg_id`, a
`read_ct` (how many times it has been read), `enqueued_at`, `last_read_at`, a `vt`
("visible at": the moment after which the message becomes readable again — a `vt` in the
future means the message is currently leased by a consumer or deliberately delayed), a JSON
`message` payload, and JSON `headers`. The *archive* holds messages a consumer archived
instead of deleting; archived rows add `archived_at`. A *peek* is a read that does not
lease: `vt`, `read_ct`, and `last_read_at` are unchanged by anything this plan does. A
*topic binding* maps a routing pattern to a queue. A *processor* is one shibuya consumer
pipeline identified by a string id. A *dead letter* is a message that a processor gave up on
and the shibuya pgmq adapter moved to another queue with a structured reason. A *cursor* is
an opaque value the server hands back for the next page; the UI echoes it and never does
arithmetic on it. An *int64* is a 64-bit integer; JavaScript numbers lose precision above
2^53, so the client core represents these as `bigint` and the UI renders them with
`formatInt()` from `lib/format.ts`.

**The pgmq surface (`pgmq-inspect`, in tree, unreleased; audited 2026-10-21).** It is
reached at the `/pgmq` prefix on the console's origin (the Vite dev proxy forwards it to
port 9092; a composed deployment mounts it there). Every route is GET; pages take `from`
(an exclusive int64 `msg_id` cursor) and `limit` (default 50, silently capped at 500) and
return `{"items": [...], "next_cursor": N}` with `next_cursor` omitted on the last page.
Routes used here: `/pgmq/queues` (array of `{queue_name, created_at, is_partitioned,
is_unlogged}`), `/pgmq/metrics` (array of metrics for every queue), `/pgmq/queues/{queue}`,
`/pgmq/queues/{queue}/metrics`, `/pgmq/queues/{queue}/messages`,
`/pgmq/queues/{queue}/messages/{msg_id}`, `/pgmq/queues/{queue}/archive`,
`/pgmq/queues/{queue}/archive/{msg_id}`, `/pgmq/queues/{queue}/bindings`,
`/pgmq/routing/test?routing_key=`, `/pgmq/notify/throttles`, `/pgmq/health/ready`.
Metrics fields and the words the UI must use for them: `queue_length` is **total** rows
(visible, leased, and delayed together); `queue_visible_length` is **visible** rows
(readable now); `total_messages` is a **lifetime counter** from the queue's sequence, never
a size; `oldest_msg_age_sec` and `newest_msg_age_sec` are nullable seconds (null means the
queue is empty); `scrape_time` is when the metrics were taken; `default_partition_length`
is a nullable planner estimate that exists only for partitioned queues, where null means
"unknown", not zero. Errors are `{"error": {"code", "message", "details"?}}` with codes
`invalid_cursor`, `invalid_limit`, `invalid_message_id`, `invalid_routing_key` (400),
`queue_not_found`, `message_not_found` (404), `inspection_busy`, `inspection_timeout`,
`database_unavailable` (503). Timestamps are ISO-8601 UTC and optional fields are explicit
`null`. The WebSocket at `/pgmq/ws` carries metrics only: the client sends
`{"type":"subscribe","queue":"<name>"}`, `unsubscribe`, and `ping`; the server answers with
`snapshot {queue, metrics, push}` before any update, then `update {queue, metrics, source}`
where `source` is `"poll"` or `"notify"`, plus `pong`, `error {code, message, queue|null}`
(an `overflow` code means frames were dropped and the client must re-read), and `goodbye`
before a server-initiated close. `push: true` only means notify interest was registered for
the queue; polling remains authoritative at a 5-second server default. The contract is
recorded as `mori://shinzui/pgmq-hs/okf/capabilities/concepts/CAP-12`; the prose guide is
`docs/user/queue-inspection.md` in the pgmq-hs repository and the served OpenAPI document is
`/pgmq/openapi.json`.

**The shibuya surface (`shibuya-metrics` 0.10.0.1 plus unreleased changes; audited
2026-10-21).** Reached at `/shibuya` (dev port 9090). `GET /shibuya/metrics` returns an
object keyed by processor id whose values are **camelCase and frozen**: `state` (tagged by
`status`: `idle`; `processing` with `inFlight`, `maxConcurrency`, `lastActivity`,
`lastProgress`; `paused` with `inFlight`, `maxConcurrency`, `pausedAt`, `lastProgress`;
`failed` with `error`, `timestamp`; `stopped`), `stats {received, processed, failed}`,
`batch {batchesEmitted, batchedMessages, partialFailures, sizeTriggered, timeoutTriggered,
flushTriggered}`, `startedAt`, and — only when the host opted into detailed metrics —
`latency {count, sumSeconds, buckets: [{le, count}]}` (18 cumulative finite buckets from
0.0001 to 60 seconds; a record without `latency` simply omits the key), `oldestInFlight
{messageId, startedAt, ageSeconds}`, and `progress {latest?, partitions: {<key>: {kind:
"integer"|"text", value: "<string>"}}, truncated}`. `GET /shibuya/metrics/<id>` returns one
record or a 404 with the **flat** error envelope `{"error": "<text>", "code":
"processor_not_found", "processor": "<id>"}` (the client core normalizes this to the same
`ApiError` as the nested envelope). `GET /shibuya/health/ready` returns `{ready,
application, processors: {total, healthy, failed, stuck, paused}, dependencies: [{name,
healthy, latencyMs, error}]}` where `application` is one of `configured_empty`, `starting`,
`running`, `draining`, `stopped`, `failed`. `GET /shibuya/control` returns `{enabled,
operations: ["pause", "resume"]}` even when control is disabled; the POST routes it
describes are out of scope here. The `processed` counter currently includes retry
decisions (shibuya IR-8 is proposed to separate them), so the UI labels it "processed
(includes retries)". The WebSocket at `/shibuya/ws` accepts `subscribe_all`, `subscribe
{processors}`, `unsubscribe {processors}`, `ping`; the server sends `snapshot {metrics}` on
every subscription change, `update {processor, metrics}` roughly every 100 ms when
something other than age changed (so `ageSeconds` must be extrapolated locally between
updates), `terminal {processor, status: "stopped"|"failed", error?, messageId|null}` when a
processor leaves the registry, `pong`, `error {code, message}` with `invalid_message`,
`subscription_limit_exceeded` (then close 1008), and `queue_overflow` (immediately followed
by a replacement snapshot), and `goodbye`. There is no replay cursor; a reconnect starts
from a fresh snapshot. These rules are shibuya's decisions
`docs/adr/0007-evolve-the-metrics-wire-contract-additively-and-keep-browser-access-and-control-opt-in.md`
and `docs/adr/0011-gate-control-endpoints-off-by-default-and-refuse-with-a-structured-error.md`
in `mori://shinzui/shibuya` (that directory is not a registered OKF bundle, so the
artifact-level URIs are pending); the prose contract is `docs/architecture/METRICS.md` in
the shibuya repository and the golden record is
`shibuya-metrics/test/golden/processor-metrics.json.golden`.

**What does not exist upstream, and what this plan does about it.** shibuya-pgmq-adapter's
requests IR-2 (queue depth and age context behind a processor) and IR-3 (dead-letter browse
and gated redrive) are still `proposed`, and the adapter has no HTTP surface. Therefore the
processor pages carry no link to a queue and say so, and dead letters are shown only as
pgmq messages whose payload the adapter wrote: always `original_message`,
`dead_letter_reason` (legacy rendered text), `dead_letter_reason_code` (a dotted code),
`dead_letter_reason_detail` (structured, possibly null); and, when the application enabled
`includeMetadata`, `original_message_id`, `original_enqueued_at`, `last_read_at`,
`read_count` (the attempt count), `original_headers`. There is no original-queue field.
The "pipeline stage graph" of the direction document also does not exist in shibuya; the
processor screens render what the metrics record carries.

**Relevant decisions.** Local: [ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md) —
every live view polls; feeds only shorten latency and any overflow or gap triggers a
re-read. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) — no
mutations in the first release, and a server-side gate is rendered honestly, never
hidden or worked around. [ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
— primitives come from `@keiro-ui/ui` only. The direction document
(`docs/architecture/ui-direction.md`) fixes the ordering rule borrowed from Sidekiq:
**latency first, depth second** — the age of the oldest ready message is the headline, and
counts come after.

**Shell contracts consumed (owned by EP-8, under `apps/console/src/`).** `shell/navigation.ts`
declares the rail section and its sidebar entries ("Queues" and "Processors" already exist
there); this plan adds recent-entity groups for both through `registerFeature` in
`shell/features.ts`. `shell/commands.ts` exports `useRegisterCommands(commands)` for static
entries and already owns the parsed `queue <name>`, `message <queue>/<id>`, and
`processor <id>` jump commands; `shell/recent.ts` exports `useRecordVisit({kind, label, href})`.
`shell/right-sheet.tsx` exports `registerSheet(kind, Component)` and `useRightSheet()`
whose `open({kind, ref})` mirrors the sheet into the `sheet` search parameter (`kind:ref`),
so a sheet URL such as `/queues/orders?tab=messages&sheet=queue-message:orders/42` reopens
the sheet on load. `lib/links.ts` exports the typed route builders (`links.queue(name, search?)`,
`links.queueMessage(queue, id)`, `links.archivedMessage(queue, id)`, `links.processor(id)`,
all declared by EP-8). `lib/format.ts` exports `formatRelativeTime`, `formatDuration`,
`formatInt`, and `formatTimestamp`. The keyboard contract is the shell's: Escape closes
the sheet.

**Client contracts consumed (owned by EP-10 and EP-11).** From `@keiro-ui/client-core`:
`useSurfaceQuery` (TanStack Query with per-surface polling defaults and the liveness
clamp), `useCursorPages` (the `useInfiniteQuery` adapter over `Page<T, Cursor>` that echoes
`nextCursor` back as `from`), `useLiveness` (`paused`, `pause`, `resume`, `refreshAll`), and
`ApiError`. From `@keiro-ui/client-pgmq`: `createPgmqClient({baseUrl})` and
`usePgmqQueueMetricsFeed(queueName)`. From `@keiro-ui/client-shibuya`:
`createShibuyaClient({baseUrl})`, `useShibuyaProcessorsFeed()`, and `extrapolateAge`. The
exact method names those packages export are theirs; this plan isolates every call in one
`queries.ts` per feature so that a naming difference is a one-file change.


## Plan of Work

The work is five milestones, each independently verifiable in the browser against the
recorded fixtures (`VITE_MOCK=1 bun run dev`) and, when the local stack from
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` is running,
against real servers (`bun run dev`).

**M1 — queue list and queue detail header.** Create the routes
`apps/console/src/routes/_shell/queues/index.tsx` and `apps/console/src/routes/_shell/queues/$name.tsx`
and the feature module `apps/console/src/features/queues/`. In `queries.ts`, wrap the pgmq
client: `useQueueInventory()` fetches `/pgmq/queues` and `/pgmq/metrics` with
`useSurfaceQuery` (surface `pgmq`, `poll: 5000`; the client core's adaptive clamp only ever
lengthens an interval after a slow fetch and never shortens it below the base) and joins
them on `queue_name` into one array; `useQueueMetrics(name)` reads `usePgmqQueueMetrics(name)`
(the authoritative poll) and mounts `usePgmqQueueMetricsFeed(name)`, which writes each feed
frame into that same cache entry and returns `{status, source, push}` for the header's
indicator, so the header shows the newest of poll and feed from one cache entry. The
list route validates its search params with zod 4 (`q` text filter, `sort` in
`oldest | newest | visible | total | name`, `dir` in `asc | desc`, defaults `oldest`/`desc`);
`sort.ts` implements the comparators with nulls (empty queues) last. `queue-table.tsx`
renders the table from `@keiro-ui/ui/components/table` with columns Queue, Oldest (the
headline: `oldest_msg_age_sec` as a duration, or "empty" when null), Visible
(`queue_visible_length`), Total (`queue_length`), Newest, and badges for `is_partitioned`
and `is_unlogged`; a partitioned queue additionally shows "partition est. N" or
"partition est. unknown" from `default_partition_length`. `queue-metrics-header.tsx` is
the detail header: the same numbers as big figures, `total_messages` labelled "lifetime
messages", `scrape_time` as "as of …", a dot that says "poll" or "notify" after each update
(`source`) and a caption "notify-assisted" or "poll only" from the snapshot's `push` flag,
and the shell's liveness state honoured (paused means no polling and the feed is
unsubscribed). Acceptance: the list is ordered by oldest age descending with empty queues
at the bottom; typing in the filter and changing sort updates the URL; opening a queue
shows the header, and injecting a feed `update` frame (fixture feed script) changes the
numbers without a page reload.

**M2 — tabs, message sheet, message page, dead-letter panel.** Extend the detail route's
search schema with `tab` in `messages | archive | bindings` (default `messages`), `from`
(an optional decimal string, the int64 cursor), and `limit` (optional, 1–500). Build
`queue-messages-tab.tsx` and `queue-archive-tab.tsx` over `useSurfaceQuery` keyed by the
URL's `from` cursor (one page per query; the client core's `useCursorPages` is the "load
more" adapter and does not fit a URL-addressed page) with columns Message id (`formatInt`),
Reads (`read_ct`), Enqueued, Last read, Visible at (`vt`, with
a tooltip explaining that a future value means leased or delayed; rendered as relative time
with "in …" or "… ago"), Headers (a one-line summary), and for the archive, Archived at.
"Next page" navigates with `from = page.nextCursor`; "First page" clears it. Clicking a row
calls `useRightSheet().open({kind: "queue-message", ref: `${name}/${msg_id}`})`.
`queue-message-sheet.tsx` is registered with `registerSheet("queue-message", …)` at module
load (imported from the section's route file so it is registered whenever the section is
loaded) and fetches `/pgmq/queues/{queue}/messages/{id}`, falling back to the archive route
when the messages route returns `message_not_found`; it shows the timing fields, headers, the
payload in `JsonViewer` from `apps/console/src/components/JsonViewer.tsx` (EP-13's shared
component, or this plan's minimal copy at the same path when EP-13 has not landed), the
dead-letter panel when applicable, and a link "Open full page" to
`links.queueMessage(name, id)`. `queue-bindings-tab.tsx` lists
`/pgmq/queues/{queue}/bindings` (pattern, compiled_regex, bound_at), and `routing-test.tsx`
is a small form (`@keiro-ui/ui/components/input` plus a button) that calls
`/pgmq/routing/test?routing_key=` and lists the matching queues as links; an
`invalid_routing_key` error is shown inline. `notify-throttles.tsx` renders the row of
`/pgmq/notify/throttles` for this queue when one exists. Fill the placeholder route
`apps/console/src/routes/_shell/queues/$name/messages/$id.tsx` rendering
`queue-message-page.tsx`: the same content as the sheet with the full width, a breadcrumb
back to the queue, and `useRecordVisit`. `dead-letter.ts` exports
`detectDeadLetter(message): DeadLetterPayload | null`, true when the payload object carries
the four always-present adapter fields; `dead-letter-panel.tsx` renders Reason code
(`dead_letter_reason_code`), Reason (`dead_letter_reason`), Detail
(`dead_letter_reason_detail` as a JSON tree or "none"), Attempts (`read_count`, or
"not recorded"), Originally enqueued (`original_enqueued_at`), Original message id, Original
headers, and the original message payload in its own viewer, followed by the sentence
"Redrive is not available: shibuya-pgmq-adapter has not shipped a dead-letter redrive
endpoint (IR-3 is proposed)." Acceptance: the fixture message with `msg_id`
`9007199254740993` renders exactly that string in the table, the sheet, the page, and the
URL; the dead-letter fixture renders the panel; a page URL with `tab=archive&from=…`
reloads to the same page.

**M3 — processors list.** Create `apps/console/src/routes/_shell/processors/index.tsx` and
`apps/console/src/features/processors/`. `queries.ts` wraps the shibuya client:
`useProcessors()` reads `useShibuyaProcessors()` (the poll of `/shibuya/metrics` at the
shibuya surface default of 2 s) and mounts `useShibuyaProcessorsFeed()`, which writes into
that cache entry — `snapshot` replaces the map, `update` upserts one entry, `terminal` sets
the entry's `state` to its terminal status — and returns `{status, terminal, receivedAt}`;
the `terminal` map (status, error, and `messageId`) is what moves a row into the table's
"Terminal" group with its error text, and `receivedAt` feeds the age extrapolation. The
client core's handling of `queue_overflow` (take the replacement snapshot) and reconnect
(fresh snapshot) needs no screen code; `useReadiness()` polls `/shibuya/health/ready`
through the client's `health.ready()`, which resolves with `{status, body}` for both 200
and 503. `state-badge.tsx` maps `state.status` to a badge
(`@keiro-ui/ui/components/badge`) with distinct variants for idle, processing, paused,
failed, stopped. `processor-table.tsx` renders Processor, State, Received, Processed
(labelled "processed (includes retries)"), Failed, In flight (`inFlight / maxConcurrency`
for processing and paused states), Oldest in flight (`extrapolateAge(oldestInFlight,
receivedAt, now)` ticking once per second via a shared interval; "—" when the host did not
enable detail), and Started. `readiness-summary.tsx` sits in the page header: the
`application` state, "N healthy, N failed, N stuck, N paused of N", and dependency dots
with latency. Acceptance: rows reflect the fixture; a scripted `update` frame changes a
counter without reload; a scripted `terminal` frame moves the row to the Terminal group with
its error text; the oldest-in-flight age increases between frames.

**M4 — processor detail.** Create `apps/console/src/routes/_shell/processors/$id.tsx` rendering
`processor-detail.tsx`: the state panel (status, and for processing/paused the in-flight,
concurrency, `lastActivity`, `lastProgress`, `pausedAt`; for failed the `error` and
`timestamp`), the counters and batch counters as labelled figures,
`latency-histogram.tsx` fed by `histogram.ts` — which turns the cumulative `buckets` into
per-bucket counts (each bucket minus the previous; the overflow above the last `le` is
`latency.count` minus the last cumulative), computes the mean from `sumSeconds / count`, and
estimates p50, p90, p99 by finding the first bucket whose cumulative count reaches
`q × count` and interpolating linearly between the previous and current `le` (the
Prometheus `histogram_quantile` rule; the lowest bucket interpolates from 0) — drawn as SVG
bars with the estimates captioned "estimated from histogram buckets"; `progress-cursors.tsx`
listing `progress.latest` and each partition's cursor (`kind` and `value`) with a notice when
`truncated` is true; the oldest in-flight card with `messageId`, `startedAt`, and the
extrapolated age; and `control-status.tsx`, which reads `/shibuya/control` and renders
"Control enabled: yes" or "Control enabled: no" plus the operations list as plain text with
the caption "Operator actions arrive in a later release" — no buttons. A muted note reads
"Queue context unavailable (shibuya-pgmq-adapter IR-2 not implemented)" where a queue link
would otherwise go. A 404 renders the shell's not-found state with the `processor_not_found`
message. Acceptance: the fixture processor with detailed metrics shows 18 bars, a mean, and
three estimates; a processor without `latency` shows "latency detail not enabled on this
host"; the control card reflects `enabled` from the fixture.

**M5 — navigation, commands, recents, end-to-end tests.** Register the section's
recent-entity groups and static commands through `registerQueuesFeature()` (one
`registerFeature` call wired into `apps/console/src/features/index.ts`); the parsed
`queue <name>`, `message <queue>/<id>`, and `processor <id>` jumps already exist in the
shell's `jumpParsers` and are verified, not re-registered. Record visits with
`useRecordVisit` on the queue detail, message page, and processor detail. Write the
Playwright suite `apps/console/e2e/queues/queues.spec.ts` and
`apps/console/e2e/queues/processors.spec.ts` against the MSW browser mode. Acceptance: the
five end-to-end scenarios listed in Validation pass; ⌘K then "queue orders" lands on
`/queues/orders`.


## Concrete Steps

All commands run from the repository root, `/Users/shinzui/Keikaku/bokuno/keiro-ui`. The
workspace, scripts, and Playwright project exist from EP-7; the shell from EP-8; the
clients from EP-11. If `packages/testing/fixtures/pgmq/` or `packages/testing/fixtures/shibuya/`
lack a fixture this plan needs, add it (see Interfaces and Dependencies for the list) by
copying the owning repository's golden file and editing it minimally; name the source in
`_meta.json`.

1. Confirm the prerequisites are in place and the baseline is green:

    ```bash
    bun install
    bun run check
    bun run test
    ls packages/client-pgmq/src packages/client-shibuya/src apps/console/src/shell
    ```

    Expected: `bun run check` and `bun run test` exit 0; the three directories exist.

2. Add any UI primitive this section needs that `packages/ui` does not yet have — the table,
   tabs, badge, card, input, button, tooltip, skeleton, empty, and separator components are
   expected from EP-7/EP-8; if one is missing:

    ```bash
    cd packages/ui && bunx shadcn@latest add tabs badge tooltip empty && cd ../..
    ```

    Expected: new files under `packages/ui/src/components/`; `bun run check` still passes.

3. Create the M1 files and run the dev server in mock mode:

    ```bash
    VITE_MOCK=1 bun run dev
    ```

    Open `http://localhost:5173/queues`. Expected: the fixture queues, oldest-age descending,
    empty queues last. Open one; expected: the metrics header with "as of" time and the
    poll/notify indicator.

4. Create the M2 files. Verify the big-id and dead-letter fixtures:

    ```bash
    bun run --filter @keiro-ui/console test -- src/features/queues
    ```

    Expected transcript tail:

    ```text
    ✓ src/features/queues/queue-messages-tab.test.tsx (3)
    ✓ src/features/queues/dead-letter-panel.test.tsx (2)
    ✓ src/features/queues/queue-message-sheet.test.tsx (2)
    Test Files  3 passed
    ```

5. Create the M3 and M4 files; run the processor tests:

    ```bash
    bun run --filter @keiro-ui/console test -- src/features/processors
    ```

    Expected: `histogram.test.ts` (per-bucket differences, overflow bucket, quantile
    interpolation on a hand-computed fixture), `processor-table.test.tsx` (terminal regroup,
    age extrapolation), `control-status.test.tsx` pass.

6. Create the M5 wiring and the end-to-end suite; run it:

    ```bash
    bun run --filter @keiro-ui/console test:e2e -- e2e/queues
    ```

    Expected: all scenarios pass; Playwright prints `N passed`.

7. When the local stack is running (EP-9's recipe; pgmq-inspect on 9092 and a shibuya
   metrics server on 9090), run `bun run dev` without `VITE_MOCK` and repeat the manual checks
   of steps 3–5 against real data; record the observation in Progress.

8. Run the full gate and commit at each milestone boundary with the trailers:

    ```bash
    bun run check && bun run test
    git add -A && git commit -m "feat(console): queues section with live metrics and message browsing" \
      -m "MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md" \
      -m "ExecPlan: docs/plans/14-build-the-queues-and-processors-screens.md"
    ```


## Validation and Acceptance

**Unit and component tests (vitest, MSW node handlers from `@keiro-ui/testing`).**
`sort.test.ts`: oldest-descending puts a queue with `oldest_msg_age_sec: 900` before one
with `120`, and a queue with `null` last regardless of direction. `queue-table.test.tsx`:
renders Visible and Total from `queue_visible_length` and `queue_length` under those labels
and never renders the word "depth" alone; a partitioned queue with
`default_partition_length: null` shows "unknown". `queue-messages-tab.test.tsx`: a fixture
row with `msg_id` 9007199254740993 renders the text `9007199254740993`; clicking it sets the
`sheet` search param to `queue-message:orders/9007199254740993`; "Next page" sets `from` to
the fixture's `next_cursor` as a decimal string. `dead-letter-panel.test.tsx`: a payload
carrying the four adapter fields renders the Reason code and the sentence beginning
"Redrive is not available"; a payload without them renders no panel. `histogram.test.ts`:
cumulative `[{le:0.1,count:2},{le:1,count:5}]` with `count: 6` yields per-bucket counts
`[2,3]` and overflow `1`; p50 of that histogram interpolates to 0.4 (3 of 6 reached inside
the second bucket, 1/3 of the way from 0.1 to 1). `processor-table.test.tsx`: a `terminal`
frame with `status: "failed"` moves the row under "Terminal" with its error; after two
scripted seconds the oldest-in-flight age shows `ageSeconds + 2`. `control-status.test.tsx`:
renders "Control enabled: no" and no button element for `{enabled: false}`.

**End-to-end (Playwright against MSW browser mode).** (1) Visiting `/queues` shows the
queues ordered by oldest age; clicking the "Visible" header navigates to
`/queues?sort=visible&dir=desc` and reorders. (2) Visiting
`/queues/orders?tab=messages&sheet=queue-message:orders/9007199254740993` opens the sheet
with that id; pressing Escape closes it and removes the `sheet` param; "Open full page"
lands on `/queues/orders/messages/9007199254740993` with the Dead letter panel visible
for the dead-letter fixture. (3) On `/queues/orders`, the scripted feed emits an `update`
with `queue_visible_length: 7`; the header shows 7 without navigation and the indicator
reads "notify". (4) On `/processors`, the scripted feed emits `terminal {processor:
"orders", status: "stopped"}`; the row appears under "Terminal". (5) ⌘K, type
`processor orders`, Enter; the URL is `/processors/orders` and the Control card reads
"Control enabled: no".

**Live-stack check (when EP-9's stack is up).** `bun run dev`, `/queues` lists the seeded
queues with real ages; `/queues/<seeded>` shows the header changing after a message is sent
with `psql` (`SELECT pgmq.send('<queue>', '{"hello": 1}')`); `/processors` shows the running
example consumer; pausing liveness in the bottom bar stops both polling (no new requests in
the network panel) and the feed subscription.

**Required acceptance** is the five milestones' acceptance plus the tests above. Proposals
beyond scope (not required): a queue-level sparkline of visible length over time; grouping
processors by their adapter; any action button.


## Idempotence and Recovery

Every step is additive and repeatable: route files, feature modules, fixtures, and tests
can be rewritten freely until a milestone commit. `bunx shadcn@latest add` overwrites
an existing component file only with `--overwrite`; without it, re-running is a no-op. The
TanStack Router plugin regenerates `apps/console/src/routeTree.gen.ts` on every dev or
build run; if the generated tree is stale after renaming a route file, delete it and run
`bun run --filter @keiro-ui/console generate-routes`. Nothing in this plan writes to any
server: all pgmq reads are non-destructive peeks and no shibuya control route is called.
If a fixture is wrong, correct it in `packages/testing/fixtures/` and re-run the tests;
if a recorded fixture disagrees with the live surface, the live surface wins and the
discrepancy is noted in Surprises & Discoveries.


## Interfaces and Dependencies

**Prerequisites (parent-declared).** Hard: EP-8
(`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`) Complete —
the shell, route tree, `shell/navigation.ts`, `shell/commands.ts`, `shell/right-sheet.tsx`,
`lib/links.ts`, `lib/format.ts`; and EP-11
(`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`) Complete — which
itself requires EP-10's client core. Soft: EP-9
(`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`) for recorded
fixtures and the live stack; without it, this plan adds fixtures by hand from the owning
repositories' goldens.

**Libraries whose choice matters.** `@tanstack/react-router` (file routes,
`validateSearch` with zod 4 schemas), `@tanstack/react-query` (through the client core's
hooks), `zod` 4, `@keiro-ui/ui` (shadcn React Aria base: `table`, `tabs`, `badge`, `card`,
`input`, `button`, `tooltip`, `skeleton`, `empty`, `separator`, `kbd`, and the JSON viewer
`apps/console/src/components/JsonViewer.tsx` that
docs/plans/13-build-the-streams-and-subscriptions-screens.md provides — if that plan has
not landed, this plan ships a minimal local copy at the same path and EP-13 replaces it), `msw` through `@keiro-ui/testing`, `vitest`,
`@playwright/test`. No charting library.

**Client interfaces consumed** (copied from EP-10's and EP-11's declared interfaces, which
own them; a change there is cascaded here, and `queries.ts` is the one file that would
move):

```typescript
// @keiro-ui/client-core (plan 10's declared interface)
useSurfaceQuery<T>(opts: UseQueryOptions<T, ApiError> & { surface: "pgmq" | "shibuya"; poll?: number | false }): UseQueryResult<T, ApiError>
useLiveness(): { paused: boolean; pausedSince: Date | null; pause(): void; resume(): void; refreshAll(): Promise<void> }
class ApiError extends Error { surface: Surface; status: number; code: string; details?: unknown; raw: unknown; headers: Headers }
// useCursorPages (the "load more" adapter) is not used in this section

// @keiro-ui/client-pgmq (plan 11's declared interface; int64 fields are bigint)
createPgmqClient(opts: { baseUrl: string; fetch?: typeof fetch }): PgmqClient
interface PgmqClient {
  service(): Promise<ServiceDescriptor>
  queues:   { list(): Promise<Queue[]>; get(name: string): Promise<Queue>; metrics(name: string): Promise<QueueMetrics> }
  metrics:  { all(): Promise<QueueMetrics[]> }
  messages: { page(queue: string, p: { from?: PgmqMessageCursor; limit?: number }): Promise<Page<Message, PgmqMessageCursor>>;
              get(queue: string, msgId: bigint): Promise<Message> }
  archive:  { page(queue: string, p: { from?: PgmqMessageCursor; limit?: number }): Promise<Page<ArchivedMessage, PgmqMessageCursor>>;
              get(queue: string, msgId: bigint): Promise<ArchivedMessage> }
  bindings: { forQueue(queue: string): Promise<TopicBinding[]>; all(): Promise<TopicBinding[]> }
  routing:  { test(routingKey: string): Promise<RoutingMatch[]> }
  notify:   { throttles(): Promise<NotifyInsertThrottle[]> }
  health:   { live(): Promise<{ status: number; body: Liveness }>; ready(): Promise<{ status: number; body: Readiness }> }
}
usePgmqQueueMetrics(queue: string): UseQueryResult<QueueMetrics, ApiError>   // the poll; the feed writes into this entry
usePgmqQueueMetricsFeed(queue: string): { status: FeedStatus; source?: "poll" | "notify"; push?: boolean }

// @keiro-ui/client-shibuya (plan 11's declared interface; fields keep their camelCase wire names)
createShibuyaClient(opts: { baseUrl: string; fetch?: typeof fetch }): ShibuyaClient
interface ShibuyaClient {
  metrics: { all(): Promise<ProcessorMap>; processor(id: string): Promise<ProcessorMetrics> }
  health:  { live(): Promise<{ status: number; body: Liveness }>; ready(): Promise<{ status: number; body: ReadinessStatus }>;
             combined(): Promise<{ status: number; body: CombinedHealth }> }
  control: { status(): Promise<ControlStatus> }   // { enabled: boolean; operations: string[] }
}
useShibuyaProcessors(): UseQueryResult<ProcessorMap, ApiError>               // the poll; the feed writes into this entry
useShibuyaProcessorsFeed(): { status: FeedStatus;
  terminal: Record<string, { status: "stopped" | "failed"; error?: string; messageId: string | null }>;
  receivedAt: Record<string, number> }
extrapolateAge(oldest: { ageSeconds: number }, receivedAt: Date, now: Date): number
```

**Fixtures this plan expects in `packages/testing/fixtures/`** (owner EP-9; added here if
absent, sourced from `pgmq-inspect/test/golden/*.json` in the pgmq-hs repository and
`shibuya-metrics/test/golden/processor-metrics.json.golden` in the shibuya repository):
`pgmq/queues.json` (at least three queues, one partitioned with `default_partition_length`
null, one empty), `pgmq/metrics.json`, `pgmq/queues-orders-metrics.json`,
`pgmq/queues-orders-messages.json` (two pages; one `msg_id` of 9007199254740993),
`pgmq/queues-orders-messages-9007199254740993.json` (an adapter dead-letter payload with
`read_count`), `pgmq/queues-orders-archive.json`, `pgmq/queues-orders-bindings.json`,
`pgmq/routing-test.json`, `pgmq/notify-throttles.json`, `pgmq/health-ready.json`;
`shibuya/metrics.json` (one processor with `latency`, `oldestInFlight`, `progress`; one
without), `shibuya/metrics-orders.json`, `shibuya/health-ready.json`, `shibuya/control.json`
(`enabled: false`); and feed scripts `packages/testing/src/feeds/pgmq.ts` (snapshot then an
update with `source: "notify"`) and `packages/testing/src/feeds/shibuya.ts` (snapshot, an
update, a terminal frame).

**Artifacts this plan produces for later plans.** `apps/console/src/features/queues/dead-letter.ts`
and `dead-letter-panel.tsx` (reused by EP-19 when redrive becomes available upstream);
`apps/console/src/features/processors/control-status.tsx` (EP-19 replaces its caption with
the pause/resume actions); `apps/console/src/features/processors/latency-histogram.tsx` and
`state-badge.tsx` (reusable by EP-17's Overview); and the sheet kind `queue-message`.
