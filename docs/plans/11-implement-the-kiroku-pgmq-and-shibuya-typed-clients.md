---
id: 11
slug: implement-the-kiroku-pgmq-and-shibuya-typed-clients
title: "Implement the kiroku, pgmq, and shibuya typed clients"
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
---

# Implement the kiroku, pgmq, and shibuya typed clients

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (the React application this repository is building under
`docs/masterplans/2-build-the-keiro-runtime-console.md`) reads from four independently
owned HTTP and WebSocket surfaces. This plan delivers the typed TypeScript clients for the
three lower-layer surfaces: **kiroku** (the PostgreSQL event store: streams, categories, the
`$all` event log, durable subscription checkpoints, store dead letters, live event tails),
**pgmq** (PostgreSQL-native work queues: queues, metrics, non-destructive message peeks,
archives, topic bindings), and **shibuya** (supervised queue processing: per-processor state,
counters, latency, in-flight work, control gate status). Each client is a workspace package
that a screen can import, point at a base URL, and call with full types, runtime-validated
responses, lossless 64-bit integers, cursor pagination that echoes cursors untouched, and
one WebSocket feed hook per live surface.

After this plan, a developer can run the three contract test suites against recorded
fixtures and, with the local runtime stack up, against the real servers, and can run a
one-file smoke script per package that prints a live response — for example kiroku's
`/capabilities` document, the first page of a pgmq queue's messages with a message id above
2^53 printed exactly, and shibuya's processor map. Screens built later
(`docs/plans/13-build-the-streams-and-subscriptions-screens.md`,
`docs/plans/14-build-the-queues-and-processors-screens.md`, and the keiro-section plans
that read raw events) consume these packages and never touch `fetch` or frame parsing.


## Progress

- [ ] M1 — `@keiro-ui/client-kiroku` covers every kiroku-metrics route with zod schemas and
  passes its contract tests against fixtures (`bun run --filter @keiro-ui/client-kiroku test`)
  and, with `KEIRO_UI_LIVE=1`, against `kiroku-inspect` on port 9091; the smoke script
  prints the live `/capabilities` document.
- [ ] M2 — `@keiro-ui/client-pgmq` is generated from the checked-in OpenAPI golden, its zod
  schemas mirror the OpenAPI components (key-set parity test), every fixture validates, a
  message id above 2^53 round-trips as an exact `bigint`, and the live suite confirms the
  surface is GET-only (HEAD returns 405).
- [ ] M3 — `@keiro-ui/client-shibuya` decodes the camelCase processor records (basic and
  detailed), health, and the control gate status, with the flat error envelope normalized;
  tests pass against fixtures and against the live server, noting which detail fields the
  live baseline omits.
- [ ] M4 — The four feed dialects (kiroku events, kiroku metrics, pgmq queue metrics,
  shibuya processors) and their hooks reconcile snapshot-then-delta into the TanStack Query
  cache, recover from overflow by re-reading the poll path, and are proven against scripted
  sockets and against the live stack.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: pgmq types are generated from the OpenAPI document checked into this
  repository (copied from pgmq-hs), while the kiroku and shibuya clients are hand-written
  against their owners' prose contracts and golden files; all three expose zod 4 schemas as
  the runtime contract, and the generated pgmq types are an additional compile-time check,
  not a replacement for validation.
  Rationale: only pgmq publishes a machine-readable spec (`ADR-5` foresaw regenerating
  hand-written clients when specs appear); runtime validation is what protects screens from
  drift the compiler cannot see.
  Date: 2026-10-21

- Decision: Hooks obtain their client from a per-package React context provider
  (`KirokuClientProvider`, `PgmqClientProvider`, `ShibuyaClientProvider`) rather than from
  the application's connection profile directly, so the packages depend only on
  `@keiro-ui/client-core`, React, and TanStack Query, never on `apps/console`.
  Rationale: keeps the dependency arrow pointing from the application to the clients, which
  is what makes the packages testable in isolation and reusable outside the console.
  Date: 2026-10-21

- Decision: Health endpoints return their body for both 200 and 503 instead of throwing,
  because every surface answers "not ready" with a 503 that carries the diagnostic body.
  Rationale: a readiness probe whose failure case is an exception hides the very
  information the bottom bar and Overview must display.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

**Where this plan sits.** The parent MasterPlan
(`docs/masterplans/2-build-the-keiro-runtime-console.md`) decomposes the console into a
workspace and design system (plan 7), the application shell (plan 8), a local runtime stack
with recorded fixtures (plan 9), a client core (plan 10), the clients (this plan and plan
12 for keiro), the screens (plans 13–17), packaging (18), and gated actions (19). This
plan hard-depends on plan 10 being Complete and softly depends on plan 9 for recorded
fixtures. Read the MasterPlan's "Endpoint inventory (audited 2026-10-21)" and
"Integration Points" sections first; this plan restates what it needs from them so it stands
alone, but the MasterPlan is the coordination source if the two ever disagree.

**The workspace.** After plan 7 the repository is a bun workspace with `apps/*` and
`packages/*`. Packages are consumed as TypeScript source inside the workspace (their
`package.json` `exports` point at `src/`), there is no build step, and the root scripts are
`bun run check` (typecheck, lint, format check), `bun run test` (vitest), and
`bun run test:e2e` (Playwright). TypeScript is version 7 with `strict`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and `moduleResolution: "bundler"`.
Linting is oxlint and formatting is oxfmt. Runtime dependencies that matter here: `zod`
4 (schemas; zod 4 is the version where `.int()` and `bigint` helpers behave as used below),
`@tanstack/react-query` 5 (server-state cache), and React 19.

**The client core you build on** (`packages/client-core`, published as
`@keiro-ui/client-core`, owned by `docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`).
This plan uses these exports and nothing else from it; if plan 10 shipped them under other
names, adapt at the import site and record the mapping in this plan's Decision Log rather
than duplicating the functionality:

- `createHttpClient({ baseUrl, fetch? })` from `packages/client-core/src/http.ts`:
  `get(path, { query?, okStatuses? })` and `post(...)`, encoding query values (repeating a
  key for arrays, serializing `bigint` as a decimal string) and parsing JSON losslessly.
- `ApiError` and `normalizeError(surface, response, body)` from
  `packages/client-core/src/errors.ts`: one error class with `surface`, `status`, `code`,
  `message`, `details`, built from the three envelopes on the wire — the nested
  `{"error": {"code", "message", "details"?}}` (kiroku's new routes, pgmq), shibuya's flat
  `{"error": "<text>", "code": "<snake_case>", ...context}`, and kiroku's legacy
  `{"error": "<string>", ...context}` (mapped to code `legacy_error` with the string as the
  message and any sibling keys as `details`).
- `int64()` from `packages/client-core/src/int64.ts`: a zod schema accepting a JSON number
  or the `bigint` the lossless parser produced for out-of-range integers and always
  producing a `bigint`.
- `pageSchema(itemSchema, cursorSchema)` and `useCursorPages(...)` from
  `packages/client-core/src/pages.ts`: `Page<T, Cursor>` is `{ items: T[]; nextCursor?: Cursor }`
  decoded from the wire's `{ "items": [...], "next_cursor"?: ... }` (absence of
  `next_cursor` is the end-of-data signal, never `null`), and the `useInfiniteQuery` adapter
  echoes `nextCursor` back as the next request's `from` without touching it.
- `Dialect` and `openFeed(dialect, { url, onFrame, onResync })` from
  `packages/client-core/src/feed.ts`: the ADR-2 WebSocket core. A dialect names the
  subscribe and unsubscribe frame builders, the `snapshot`, delta (`update` or `event`),
  `error`, `goodbye`, and `pong` frame types, and the error codes that mean "you missed
  frames"; the core reconnects with backoff, pings, treats `goodbye` as a deliberate close,
  and calls `onResync` on overflow codes so the owner can re-read the poll path.
- `useSurfaceQuery(key, fetcher, options)`, `useFeedSubscription(dialect, applyToCache)`,
  and `useLiveness()` from `packages/client-core/src/live.ts`: queries poll at the
  surface's default interval, obey the global pause, and use the adaptive clamp; feed
  subscriptions apply frames to the query cache and are torn down when liveness is paused.
- `queryKeys` helpers from `packages/client-core/src/query-keys.ts`: a factory that
  prefixes every key with the surface name so cache invalidation can be scoped per surface
  (for example `queryKeys("kiroku").scope("streams", params)`).

**Terms.** A *surface* is one project's HTTP+WebSocket inspection API. A *cursor* is the
opaque value a page returns as `next_cursor` and the client sends back as `from`; its
representation differs per route (a string for kiroku stream and dead-letter pages, a
64-bit integer for kiroku event pages and pgmq message pages) and the client never does
arithmetic on it. *Lossless int64* means a JSON integer that may exceed JavaScript's
`Number.MAX_SAFE_INTEGER` (2^53 − 1) is represented as a `bigint`, never rounded. A *feed*
is a WebSocket subscription that delivers a `snapshot` and then deltas; by ADR-3 it only
shortens the latency of learning that the authoritative poll read would return something
new. A *dialect* is one surface's concrete frame vocabulary for the shared feed core.

**Fixtures and mocks** (`packages/testing`, published as `@keiro-ui/testing`, owned by plan
9). Recorded responses live at `packages/testing/fixtures/<surface>/<route-slug>.json`
with a `_meta.json` naming the source commit; `startMockServer()` from
`packages/testing/src/node.ts` starts MSW (Mock Service Worker, an HTTP interceptor for
Node and browsers) serving every fixture at its real path under
`http://localhost/<surface>`, and `packages/testing/src/feeds/<surface>.ts` holds MSW
WebSocket handlers that play a scripted snapshot-then-delta sequence per dialect, driven by
`feedScript(surface, { overflowAfter })` from `@keiro-ui/testing/scenario`.
This plan's tests go through those entry points and never name fixture files, so plan 9
owns the naming. If plan 9 has not landed when this plan runs, seed
`packages/testing/fixtures/<surface>/` with the samples named under each milestone,
following plan 9's `_meta.json` convention, and let plan 9 replace them with recordings.

**The three surfaces, as audited on 2026-10-21.** The MasterPlan's inventory is binding;
the parts this plan implements are restated here.

*kiroku* — package `kiroku-metrics` 0.3.0.1 (released 2026-10-20), in the kiroku
repository (`mori://shinzui/kiroku`). Prose contracts: `docs/guides/building-an-inspection-ui.md`
and `docs/user/metrics.md` in that repository (project URI plus path; artifact-level URI
pending). Routes, all `GET` (and `HEAD`), relative to the mount: `/capabilities`; `/metrics`
and `/metrics/<subscription>`; `/health`, `/health/live`, `/health/ready`; `/subscriptions`
and `/subscriptions/<name>` (live, process-local registry); `/subscription-checkpoints`
(durable truth: `{store_position, checkpoints: [{subscription, member, checkpoint_position, updated_at}]}`);
`/subscriptions/<name>/dead-letters?member&from&limit` (page of
`{dead_letter_id, subscription, member, global_position, event_id, reason, reason_summary, attempt_count, created_at}`;
cursor is an opaque string of the form `pos:id`; `limit` default 100, range 1–1000; this
route rejects duplicate query keys); `/streams?category&prefix&from&limit` (page of
`StreamInfo {stream_id, name, category, version, created_at, deleted_at, truncate_before}`;
cursor is a stream name string); `/streams/<name>`; `/streams/<name>/events?from&limit&direction`
(cursor is a stream version; `from=0` means the start when `direction=forward` and the
newest event when `backward`); `/categories?from&limit` (page of `{name}`);
`/categories/<name>/events?from&limit` (cursor is a global position; `direction=backward`
is a 400); `/events?from&limit&direction` (the `$all` log, global-position cursor);
`/events/<uuid>`. Browse `limit` defaults to 100 and caps at 1000; text parameters are at
most 512 bytes; bad input is 400 `invalid_query_parameter` with
`details {parameter, value, reason}`; transient store failures are 503 with a
`*_unavailable` code; wrong methods are 405 `method_not_allowed` with an `Allow` header.
Event JSON keeps its published camelCase keys (`eventId`, `eventType`, `streamVersion`,
`globalPosition`, `originalStreamId`, `originalVersion`, `payload`, `metadata`,
`causationId`, `correlationId`, `createdAt`) plus the newer snake_case `original_stream_name`
(nullable) — frozen by `mori://shinzui/kiroku/okf/adrs/concepts/ADR-9`, so the client never
renames them. `/metrics`, `/metrics/<name>` (404 `{"error":"subscription not found","subscription":"<name>"}`),
`/subscriptions` (404 `{"error":"subscription status not configured"}` when the host
mounts no provider), and the `/ws` probe over plain HTTP use the legacy string envelope.
WebSocket paths: `/ws/metrics` (a `snapshot {metrics}` on connect and then periodically;
`subscribe_metrics` and `unsubscribe_metrics` exist) and `/ws/events` (idle until
`subscribe_events {from_position?, category?}`; replies `event_stream_started {from_position}`
then `event {event}` frames; `unsubscribe_events`; `error {message}` or `error {code, message}`
with codes `replay_failed`, `category_read_failed`, `live_decode_failed`, and
`event_stream_overflowed`, the last sent before surviving events with the exact dropped
count; `ping` → `pong`; `goodbye` before a server-initiated close). Frames the server does
not understand are silently ignored. Browser access is explicit and off by default
(`mori://shinzui/kiroku/okf/adrs/concepts/ADR-16`) — irrelevant through the Vite proxy, which
is same-origin, but it is why the live test suite talks to the port directly. The surface
is self-describing through `/capabilities` (`mori://shinzui/kiroku/okf/adrs/concepts/ADR-18`):
`{package, version, routes: {metrics, prometheus, health, subscriptions_live, subscriptions_checkpoints, dead_letters, browse, websocket_metrics, websocket_events}, cors: {enabled}, process_local: [...]}`,
where each `routes` value says whether that family is mounted.

*pgmq* — package `pgmq-inspect` 0.1.0.0, unreleased, in the pgmq-hs repository
(`mori://shinzui/pgmq-hs`) at commit `d6750a6`; shipped capability
`mori://shinzui/pgmq-hs/okf/capabilities/concepts/CAP-12`. Prose contracts:
`docs/user/queue-inspection.md` and `docs/design/021-inspection-surface-wire-contract.md`
(project URI plus path). The **OpenAPI 3.0 document** is served at `/openapi.json` and
checked in at `pgmq-inspect/test/golden/openapi.json` in that repository, with
operationIds (`listQueues`, `peekMessages`, …) and component schemas `Queue`, `Message`,
`ArchivedMessage`, `QueueMetrics`, `TopicBinding`, `RoutingMatch`,
`NotifyInsertThrottle`, `MessagePage`, `ArchivedMessagePage`, `ErrorBody`, `ErrorEnvelope`,
`ServiceDescriptor`, `Liveness`, `Readiness`, `DependencyCheck`; the WebSocket feed is not
in it. Routes, **GET only** (anything else, including HEAD, is 405 `method_not_allowed`):
`/` (`{service, version, websocket_path, openapi_path}`), `/openapi.json`, `/queues`,
`/queues/{queue}`, `/queues/{queue}/metrics`, `/metrics` (every queue; expensive on the
server), `/queues/{queue}/messages?from&limit`, `/queues/{queue}/messages/{msg_id}`,
`/queues/{queue}/archive?from&limit`, `/queues/{queue}/archive/{msg_id}`,
`/queues/{queue}/bindings`, `/bindings`, `/routing/test?routing_key`, `/notify/throttles`,
`/health/live`, `/health/ready` (503 with the same body shape when not ready). Pages are
`{items, next_cursor?}` with `from` an exclusive `msg_id` cursor; `limit` defaults to 50
and is silently capped at 500. Records: `Queue {queue_name, created_at, is_partitioned, is_unlogged}`;
`Message {msg_id, read_ct, enqueued_at, last_read_at, vt, message, headers}`;
`ArchivedMessage` adds `archived_at`; `QueueMetrics {queue_length, queue_visible_length, total_messages, oldest_msg_age_sec, newest_msg_age_sec, scrape_time, default_partition_length}`
(`queue_length` is total rows, `queue_visible_length` is readable now, `total_messages` is
a lifetime sequence counter, ages are nullable int32 seconds, `default_partition_length` is
nullable and null means unknown); `TopicBinding {pattern, queue_name, bound_at, compiled_regex}`;
`RoutingMatch {pattern, queue_name, compiled_regex}`; `NotifyInsertThrottle {queue_name, throttle_interval_ms, last_notified_at}`.
Optional fields are explicit `null`; `message` and `headers` are arbitrary JSON; ids are
int64 that can exceed 2^53. Error envelope is nested; codes: 400 `invalid_cursor`,
`invalid_limit`, `invalid_message_id`, `invalid_routing_key`; 404 `not_found`,
`queue_not_found` (details `queue_name`), `message_not_found` (details `queue_name`,
`msg_id`); 405 `method_not_allowed`; 426 `websocket_upgrade_required`; 500
`database_error`; 503 `inspection_busy`, `inspection_timeout`, `database_unavailable`,
`websocket_unavailable`. WebSocket `/ws`: `subscribe {queue}`, `unsubscribe {queue}`,
`ping` → `snapshot {queue, metrics, push}` (`push: true` only means notify interest was
registered), `update {queue, metrics, source: "poll" | "notify"}`, `pong`,
`error {code, message, queue}` (`queue` is `null` for connection-level errors; codes
include `invalid_frame`, `too_many_subscriptions`, `too_many_queues`, `frame_too_large`,
`overflow`, `queue_not_found`, `inspection_busy`, `inspection_timeout`,
`database_unavailable`, `database_error`), `goodbye`; metrics only, never messages; a full
outbox drops the oldest frame and sends `overflow` first. Over the connection cap the
upgrade itself is refused with HTTP 429 and the `inspection_busy` envelope.

*shibuya* — package `shibuya-metrics` 0.10.0.1 plus an Unreleased changelog, in the shibuya
repository (`mori://shinzui/shibuya`) at commit `0967f45`. Prose contract:
`docs/architecture/METRICS.md`; wire-stability decision
`docs/adr/0007-evolve-the-metrics-wire-contract-additively-and-keep-browser-access-and-control-opt-in.md`
(both project URI plus path; artifact-level URIs pending because shibuya's `docs/adr` is not
a registered OKF bundle). Routes: `/metrics` (an object keyed by processor id), `/metrics/<id>`
(404 `processor_not_found` with `processor`; note `/metrics/prometheus` is matched first, so
a processor literally named `prometheus` is unreachable by id), `/health`
(`{status: ReadinessStatus, processors: <map>}`), `/health/live` (`{alive}`),
`/health/ready` (`ReadinessStatus`), each health route answering 200 or 503 with the same
body shape; `GET /control` → `{enabled, operations: ["pause", "resume"]}` (works even when
control is disabled). The `POST /control/processors/<id>/pause|resume` routes exist but are
**out of scope here**; `docs/plans/19-add-gated-operator-actions.md` adds them. Records are
**camelCase and frozen**, and absent optional fields are omitted rather than `null`:
`ProcessorMetrics {state, stats, batch, startedAt, latency?, oldestInFlight?, progress?}`;
`state` is tagged by `status`: `idle`, `processing {inFlight, maxConcurrency, lastActivity, lastProgress}`,
`paused {inFlight, maxConcurrency, pausedAt, lastProgress}`, `failed {error, timestamp}`,
`stopped`; `stats {received, processed, failed}`; `batch {batchesEmitted, batchedMessages, partialFailures, sizeTriggered, timeoutTriggered, flushTriggered}`;
`latency {count, sumSeconds, buckets: [{le, count}]}` (18 cumulative buckets from 0.0001 to
60 seconds); `oldestInFlight {messageId, startedAt, ageSeconds}`;
`progress {latest?, partitions: {<key>: Cursor}, truncated}` with `Cursor {kind: "integer" | "text", value: string}`.
The three optional fields appear only when the host runs with `MetricsDetailed`; the
reference fixture is `shibuya-metrics/test/golden/processor-metrics.json.golden` in the
shibuya repository. `ReadinessStatus {ready, application, processors: {total, healthy, failed, stuck, paused}, dependencies: [{name, healthy, latencyMs, error}]}`
where `application` is one of `configured_empty`, `starting`, `running`, `draining`,
`stopped`, `failed`. The error envelope is **flat**: `{"error": "<text>", "code": "<code>", ...context}`.
WebSocket `/ws` (the server accepts an upgrade on any path, but the client always uses
`/ws`): `subscribe_all`, `subscribe {processors}`, `unsubscribe {processors}`, `ping` →
`snapshot {metrics}` (also re-sent after every subscribe or unsubscribe),
`update {processor, metrics}`, `terminal {processor, status: "stopped"}` or
`terminal {processor, status: "failed", error, messageId}` when a processor leaves the live
registry, `pong`, `error {code, message}` with `invalid_message` (connection stays open),
`subscription_limit_exceeded` (then close 1008), `queue_overflow` (immediately followed by
a replacement `snapshot`), and `goodbye` before a normal close. Pushes run every 100 ms by
default, but an `update` is sent only when something other than age changes, so
`oldestInFlight.ageSeconds` must be extrapolated locally between updates. There is no
replay cursor: a reconnect starts from a fresh snapshot.

**Local ports.** In development the surfaces run on fixed ports: shibuya-metrics 9090,
kiroku-inspect 9091, pgmq-inspect 9092 (keiro-ops-http 9093 is plan 12's concern). The
console's Vite dev server proxies `/kiroku`, `/pgmq`, `/shibuya` to those ports with the
prefix stripped; the Node test suites in this plan bypass the proxy and use
`http://127.0.0.1:<port>` directly, which is why CORS never matters here.

**Vocabulary rules the clients must enable.** From the MasterPlan's "Vocabulary and
display rules": pgmq's `queue_length` and `queue_visible_length` are shown as "total" and
"visible", `total_messages` as a lifetime counter; shibuya fields keep their camelCase
names; kiroku's metrics snapshot carries a published field literally named `lag` per
subscription, which the client keeps on the wire type but documents (in the schema's JSDoc
and the README) as *not* to be labelled "lag" on keiro-facing screens, where the mandated
term is "global position distance". Clients never rename wire fields; screens map words.

**Relevant ADRs.** Local: [ADR-2](../adr/0002-websocket-inspection-protocol-convention.md)
(one WebSocket core, dialects as parameters — this plan writes four dialects),
[ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md) (every feed hook here resolves
overflow and reconnect by re-reading the HTTP path), [ADR-5](../adr/0005-no-backend-for-frontend.md)
(one typed client per surface, mirroring repository ownership; the pgmq client is
regenerated from the owner's spec rather than hand-maintained), and
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
is context only (no UI code in this plan). Cross-repository, cited above: kiroku ADR-9,
ADR-16, ADR-18; pgmq-hs CAP-12; shibuya ADR-7 by path.


## Plan of Work

The three packages share one shape so that a reader who understands one understands all:
`src/schemas.ts` (zod schemas and the exported TypeScript types inferred from them),
`src/client.ts` (`create<Surface>Client({ baseUrl, fetch? })` returning namespaced methods
that call `createHttpClient` and parse with the schemas), `src/query-keys.ts` (the surface's
key factory), `src/feeds.ts` (dialect descriptors and frame schemas), `src/hooks.ts`
(`<Surface>ClientProvider`, `use<Surface>Client()`, one `useSurfaceQuery` wrapper per read,
one `useCursorPages` wrapper per page route, and the feed hooks), `src/index.ts`
(re-exports), `scripts/smoke.ts` (prints one live response), `test/*.test.ts` (vitest), and a
`README.md` that lists every method with the route it calls and the vocabulary notes.

### Milestone 1 — the kiroku client

Scope: `packages/client-kiroku` (`@keiro-ui/client-kiroku`). At the end, every route in the
kiroku inventory has a typed method, every response is validated, cursors are typed per
route, and the contract tests pass against fixtures and the live server.

Schemas (`packages/client-kiroku/src/schemas.ts`): `StreamInfo` (`stream_id: int64()`,
`name`, `category`, `version: int64()`, `created_at`, `deleted_at: nullable`,
`truncate_before: nullable int64()`), `KirokuEvent` (the camelCase keys above with
`streamVersion`, `globalPosition`, `originalVersion` as `int64()` and `original_stream_name`
nullable; `payload` and `metadata` as `z.unknown()`; `.passthrough()` so unknown fields
survive, per kiroku's "ignore unknown fields" rule), `DeadLetter` (`dead_letter_id: int64()`,
`global_position: int64()`, `attempt_count: number`, the rest strings/timestamps),
`CheckpointInventory` (`store_position: int64()`, `checkpoints` with `checkpoint_position: int64()`
and `member: number`), `LiveSubscription` (`subscription`, `member`, `phase`,
`global_position: int64()`), `MetricsSnapshot` (`store {global_position: int64(), active_subscribers, pool_connecting, pool_ready, pool_in_use, pool_established_total, pool_terminated_total}`,
`counters: z.record(z.string(), int64())`, `subscriptions: z.record(name, {last_known_position: int64(), lag: int64(), db_error_count, last_stop_reason: nullable})`
with the JSDoc note on `lag`), `Capabilities`, `Liveness {alive}`, `Readiness {ready, lag_ok, no_overflow, dependencies[]}`,
`CombinedHealth {status, metrics}`, and `Category {name}`. Cursor types: `KirokuNameCursor`
(a branded `string`, for streams, categories, and dead letters) and `KirokuPositionCursor`
(a branded `bigint`, for all event pages); both are produced only by decoding a page and
accepted only by the matching page method.

Client (`packages/client-kiroku/src/client.ts`): `createKirokuClient({ baseUrl, fetch? })`
returning `capabilities()`, `metrics.all()`, `metrics.subscription(name)`, `health.live()`,
`health.ready()`, `health.combined()` (all three health methods pass `okStatuses: [200, 503]`
and return `{ status, body }`), `subscriptions.live()`, `subscriptions.liveOne(name)`,
`checkpoints.inventory()`, `deadLetters.page(subscription, { member?, from?, limit? })`,
`streams.page({ category?, prefix?, from?, limit? })`, `streams.get(name)`,
`streams.events(name, { from?, limit?, direction? })`, `categories.page({ from?, limit? })`,
`categories.events(name, { from?, limit? })` (no `direction` parameter is exposed, because
the server rejects `backward`), `events.all({ from?, limit?, direction? })`,
`events.get(uuid)`. Stream and category names are placed in the path with
`encodeURIComponent`; `limit` is clamped client-side to 1–1000 with a thrown `RangeError`
rather than silently sending an out-of-range value, so a screen bug surfaces as a test
failure. The legacy envelopes need no code here: `normalizeError` already maps them.

Tests (`packages/client-kiroku/test/client.test.ts`): start the mock server, create a
client at `http://localhost/kiroku`, and for each method assert the decoded shape, that
`bigint` fields are `typeof "bigint"`, that a page with `next_cursor` yields a typed cursor
and a last page yields `nextCursor === undefined`, and that the three envelope styles
produce `ApiError` with the expected `code` (`invalid_query_parameter` from a 400,
`legacy_error` from `/metrics/unknown`, `method_not_allowed` from a mocked 405). A second
file, `test/live.test.ts`, is skipped unless `KEIRO_UI_LIVE=1`; it hits
`http://127.0.0.1:9091`, calls `capabilities()`, pages `/events` forward with `limit: 5`
until the cursor is absent, and reads one event by id. `scripts/smoke.ts` prints the
`/capabilities` document and the store head from `/subscription-checkpoints`.

If plan 9's fixtures are absent, seed `packages/testing/fixtures/kiroku/` with the payload
examples from kiroku's `docs/user/metrics.md` (one per route) and a hand-written
`_meta.json` naming that document and the kiroku-metrics version.

### Milestone 2 — the pgmq client, generated from OpenAPI

Scope: `packages/client-pgmq` (`@keiro-ui/client-pgmq`). At the end, the package carries
the owner's OpenAPI document with its provenance, a generated type file, hand-written zod
schemas proven to mirror the OpenAPI components, a client over every route, and tests.

Copy `pgmq-inspect/test/golden/openapi.json` from the pgmq-hs checkout into
`packages/client-pgmq/openapi/pgmq-inspect.openapi.json` and write
`packages/client-pgmq/openapi/SOURCE.md` stating the origin path, the pgmq-hs commit
(`d6750a6`), the package version (`pgmq-inspect` 0.1.0.0), the date copied, and the
refresh procedure (copy again, re-run `generate`, re-run tests, record the new commit).
Add `openapi-typescript` as a dev dependency and the script
`"generate": "openapi-typescript openapi/pgmq-inspect.openapi.json -o src/generated/schema.d.ts"`;
commit the generated file so consumers never need the generator installed. The generated
types give compile-time path and operation shapes (`paths["/queues/{queue}/messages"]["get"]`),
which `src/client.ts` uses to type its request parameters and raw responses.

Schemas (`packages/client-pgmq/src/schemas.ts`): `Queue`, `Message` (`msg_id: int64()`,
`read_ct: number`, `enqueued_at`, `last_read_at: nullable`, `vt`, `message: unknown`,
`headers: unknown`), `ArchivedMessage` (plus `archived_at`), `QueueMetrics`
(`queue_length`, `queue_visible_length`, `total_messages` as `int64()`; the two ages as
nullable `number`; `scrape_time`; `default_partition_length` nullable `int64()`),
`TopicBinding`, `RoutingMatch`, `NotifyInsertThrottle`, `ServiceDescriptor`, `Liveness`,
`Readiness {ready, checks: [{name, healthy, latency_ms, error}]}`, and
`PgmqMessageCursor` (branded `bigint`). A parity test
(`packages/client-pgmq/test/openapi-parity.test.ts`) loads the OpenAPI document, and for
each component schema with a zod counterpart asserts that the set of `required` property
names is a subset of the zod object's keys and that every zod key exists in the component's
`properties`; this is what keeps the hand-written mirror honest without a second validator
dependency.

Client (`packages/client-pgmq/src/client.ts`): `createPgmqClient({ baseUrl, fetch? })` with
`service()`, `openapi()` (returns the raw document), `queues.list()`, `queues.get(name)`,
`queues.metrics(name)`, `metrics.all()`, `messages.page(queue, { from?, limit? })`,
`messages.get(queue, msgId)` (`msgId: bigint`, serialized as a decimal string in the path),
`archive.page(queue, { from?, limit? })`, `archive.get(queue, msgId)`,
`bindings.forQueue(queue)`, `bindings.all()`, `routing.test(routingKey)`,
`notify.throttles()`, `health.live()`, `health.ready()` (503 tolerated). `limit` is clamped
to 1–500 client-side with a `RangeError`, mirroring the server's cap so a screen never
believes it received more than it asked for.

Tests: `test/client.test.ts` as for kiroku, plus the int64 round-trip assertion — a fixture
message with `msg_id` `9007199254740993` (2^53 + 1) decodes to `9007199254740993n` and
`messages.get(queue, 9007199254740993n)` requests exactly
`/queues/<q>/messages/9007199254740993`. `test/live.test.ts` (under `KEIRO_UI_LIVE=1`)
hits `http://127.0.0.1:9092`, lists queues, pages the first queue's messages, and asserts
that `fetch(baseUrl + "/queues", { method: "HEAD" })` returns 405 with code
`method_not_allowed`, which documents that the surface is GET-only. `scripts/smoke.ts`
prints the service descriptor and the first page of the first queue with ids rendered via
`String(bigint)`.

If plan 9's fixtures are absent, seed `packages/testing/fixtures/pgmq/` from
`pgmq-inspect/test/golden/page-more.json`, `page-last.json`, and the OpenAPI examples.

### Milestone 3 — the shibuya client

Scope: `packages/client-shibuya` (`@keiro-ui/client-shibuya`). At the end, the camelCase
processor records decode in both basic and detailed forms, health and the control gate
status are readable, and the flat error envelope is normalized.

Schemas (`packages/client-shibuya/src/schemas.ts`): `ProcessorState` as a discriminated
union on `status` with the five variants above; `ProcessorStats` (`received`, `processed`,
`failed` as `int64()`), `BatchStats`, `LatencyHistogram` (`count: int64()`,
`sumSeconds: number`, `buckets: [{le: number, count: int64()}]`), `OldestInFlight`
(`messageId: string`, `startedAt`, `ageSeconds: number`), `Cursor {kind, value}`,
`Progress {latest?: Cursor, partitions: record, truncated: boolean}`, `ProcessorMetrics`
with the three optionals as `.optional()` (absent, not null) and `.passthrough()`,
`ProcessorMap = z.record(z.string(), ProcessorMetrics)`, `ReadinessStatus`,
`CombinedHealth {status: ReadinessStatus, processors: ProcessorMap}`, `Liveness {alive}`,
`ControlStatus {enabled: boolean, operations: string[]}`. Also export
`extrapolateAge(oldestInFlight, receivedAt: Date, now: Date): number`, which returns
`ageSeconds + (now − receivedAt) / 1000`, so screens show a ticking age between updates.

Client (`packages/client-shibuya/src/client.ts`): `createShibuyaClient({ baseUrl, fetch? })`
with `metrics.all()`, `metrics.processor(id)` (encode the id; document the `prometheus`
name collision), `health.live()`, `health.ready()`, `health.combined()` (503 tolerated),
`control.status()`. No `pause` or `resume` method exists in this package after this plan;
plan 19 adds them and the honesty rules around them.

Tests: `test/client.test.ts` decodes the golden-derived detailed record and a basic record
(no `latency`, `oldestInFlight`, `progress`), asserts the state union narrows on `status`,
asserts a 404 from `/metrics/missing` becomes `ApiError { code: "processor_not_found", details: { processor: "missing" } }`,
and asserts `control.status()` returns `{ enabled: false, operations: [...] }` from the
fixture. `test/live.test.ts` hits `http://127.0.0.1:9090`, reads the map, and records in its
output which optional fields were present — the MasterPlan notes that the available
long-running shibuya servers run with basic detail, so the live run is expected to show the
three optionals absent while the fixture-backed run shows them present. `scripts/smoke.ts`
prints the processor map with each processor's `state.status` and `stats`.

If plan 9's fixtures are absent, seed `packages/testing/fixtures/shibuya/` from
`shibuya-metrics/test/golden/processor-metrics.json.golden` (detailed) and a basic record
derived from it by deleting the three optional fields.

### Milestone 4 — feed dialects and hooks

Scope: `src/feeds.ts` and the feed hooks in `src/hooks.ts` of all three packages, plus the
hooks for every read. At the end, a screen can subscribe to live updates with one hook,
the query cache is the only state, and overflow or reconnect never leaves stale data
believed fresh.

Dialects: `kirokuEventsDialect` (path `/ws/events`; subscribe builds
`{type: "subscribe_events", from_position?: string(bigint), category?}`; unsubscribe
`{type: "unsubscribe_events"}`; acknowledgement frame `event_stream_started`; delta
`event`; overflow code `event_stream_overflowed`; other error codes surface as a feed error
state), `kirokuMetricsDialect` (path `/ws/metrics`; no subscribe needed for the initial
snapshot, but the dialect sends `subscribe_metrics` for explicitness and `unsubscribe_metrics`
on teardown; delta is a full `snapshot`), `pgmqMetricsDialect` (path `/ws`;
`subscribe {queue}` / `unsubscribe {queue}`; `snapshot` and `update` carry the queue name;
overflow code `overflow`; errors with `queue: null` are connection-level), and
`shibuyaDialect` (path `/ws`; `subscribe_all` by default or `subscribe {processors}`;
`snapshot {metrics}` and `update {processor, metrics}`; `terminal` is a delta kind of its
own; overflow code `queue_overflow`, after which the server itself sends a replacement
snapshot — the dialect still calls `onResync` so the owning query refetches `/metrics`;
`subscription_limit_exceeded` is terminal and reported as a feed error). Each dialect
exports zod schemas for its server frames and parses before dispatch; unknown frame types
are ignored, per the convention.

Hooks: `useKirokuEventTail({ fromPosition, category?, limit = 500 })` keeps a bounded
ring of events in the cache under `queryKeys("kiroku").scope("tail", {category, fromPosition})`,
appending each `event` frame, and on overflow re-reads `/events?from=<last seen globalPosition>`
(or `/categories/<c>/events`) forward until the cursor is absent, then re-subscribes from the
new head; `useKirokuMetricsFeed()` writes each snapshot into the key behind
`useKirokuMetrics()`; `usePgmqQueueMetricsFeed(queue)` writes `snapshot` and `update`
metrics into the key behind `usePgmqQueueMetrics(queue)` and refetches on `overflow`;
`useShibuyaProcessorsFeed()` writes `snapshot` into the key behind `useShibuyaProcessors()`,
merges each `update` by processor id, and applies `terminal` by setting that processor's
`state` to `{status: "stopped"}` or `{status: "failed", error, timestamp: now}`. Every feed
hook is built on `useFeedSubscription`, so it is torn down when liveness is paused and
re-established on resume with a fresh snapshot.

Read hooks (one per method, named `useKiroku…`, `usePgmq…`, `useShibuya…`; page routes use
`useCursorPages`) are thin: they read the client from context, build the key, and pass the
surface's default polling interval (kiroku browse 10 s, kiroku checkpoints and health 5 s,
pgmq metrics 5 s, pgmq pages 10 s, shibuya metrics 2 s, health 5 s) to `useSurfaceQuery`.

Tests: `test/feeds.test.ts` in each package plays the scripted frame sequences from
`packages/testing/src/feeds/<surface>.ts` through `feedScript` and asserts the cache
after each frame; one sequence per dialect includes the overflow code and asserts that the
poll fetcher was invoked and the cache matches the re-read. `test/live.test.ts` gains one
feed case per surface: connect to the live port, receive the first snapshot within 5 s, and
disconnect cleanly (the kiroku events case subscribes from the current store head and
expects `event_stream_started`).


## Concrete Steps

All commands run from the repository root unless stated.

Create the three packages after confirming plan 10's exports:

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro-ui
grep -n "^export" packages/client-core/src/index.ts
mkdir -p packages/client-kiroku/{src,test,scripts} packages/client-pgmq/{src/generated,openapi,test,scripts} packages/client-shibuya/{src,test,scripts}
```

Each `package.json` follows this shape (shown for kiroku; the others differ in name and
in pgmq's extra `generate` script and dev dependency):

```json
{
  "name": "@keiro-ui/client-kiroku",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas.ts",
    "./hooks": "./src/hooks.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "smoke": "node --experimental-strip-types scripts/smoke.ts"
  },
  "dependencies": {
    "@keiro-ui/client-core": "workspace:*",
    "zod": "^4"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5",
    "react": "^19"
  }
}
```

Bring in the pgmq OpenAPI document and generate types:

```bash
cp /Users/shinzui/Keikaku/bokuno/libraries/pgmq-hs-project/pgmq-hs/pgmq-inspect/test/golden/openapi.json \
   packages/client-pgmq/openapi/pgmq-inspect.openapi.json
git -C /Users/shinzui/Keikaku/bokuno/libraries/pgmq-hs-project/pgmq-hs rev-parse --short HEAD   # record in openapi/SOURCE.md
(cd packages/client-pgmq && bun add --dev openapi-typescript)
bun run --filter @keiro-ui/client-pgmq generate
```

Expected tail of the generate step:

```text
✨ openapi-typescript 7.x
🚀 openapi/pgmq-inspect.openapi.json → src/generated/schema.d.ts [NNms]
```

Install and run the suites against fixtures:

```bash
bun install
bun run --filter '@keiro-ui/client-*' test
```

Expected shape of each package's vitest summary (counts will differ):

```text
 ✓ test/client.test.ts (NN tests)
 ✓ test/feeds.test.ts (NN tests)
 ↓ test/live.test.ts (skipped: KEIRO_UI_LIVE not set)
 Test Files  2 passed | 1 skipped
```

Run against the live stack (plan 9's recipes bring it up; the ports are fixed by the
MasterPlan):

```bash
just stack-up        # from docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md
KEIRO_UI_LIVE=1 bun run --filter '@keiro-ui/client-*' test
bun run --filter @keiro-ui/client-kiroku smoke
bun run --filter @keiro-ui/client-pgmq smoke
bun run --filter @keiro-ui/client-shibuya smoke
```

Expected first lines of the kiroku smoke script:

```text
kiroku-metrics 0.3.0.1 at http://127.0.0.1:9091
routes: metrics=true prometheus=true health=true subscriptions_live=false subscriptions_checkpoints=true dead_letters=true browse=true websocket_metrics=true websocket_events=true
store head: 4211
```

Finish with the workspace checks:

```bash
bun run check
```


## Validation and Acceptance

Acceptance is behavioral and per milestone.

M1 is accepted when `bun run --filter @keiro-ui/client-kiroku test` passes with every route
covered by at least one assertion on decoded shape and cursor typing; when
`KEIRO_UI_LIVE=1` against `kiroku-inspect` on 9091 the live suite pages `/events` to the
end and the smoke script prints the capabilities document and the store head; and when
calling `streams.page({ limit: 5000 })` throws a `RangeError` before any request is sent.

M2 is accepted when `bun run --filter @keiro-ui/client-pgmq generate` is idempotent (a second
run changes nothing in `git status`), the parity test passes for every component schema
with a zod mirror, the fixture message with id `9007199254740993` decodes to that exact
`bigint` and is re-serialized exactly in the path of `messages.get`, and the live suite
reports HEAD → 405 `method_not_allowed`.

M3 is accepted when both the detailed and the basic processor fixtures decode, the state
union narrows correctly in a type-level test (`expectTypeOf`), the 404 and 403-style flat
envelopes become `ApiError` with the surface's code, and the live smoke prints every
processor with its `status`.

M4 is accepted when each `test/feeds.test.ts` demonstrates snapshot-then-delta reconciling
into the cache, the overflow sequence triggers a poll re-read whose result replaces the
cache, shibuya's `terminal` frame changes the processor's state, pausing liveness closes
the socket and resuming reopens it with a new snapshot, and each live feed case receives
its first snapshot within 5 seconds.

The early producer/consumer check named by the MasterPlan — fetching kiroku
`/capabilities` and a pgmq message page with an id above 2^53 through the console's Vite
proxy and round-tripping the id — is owned by plan 10 and must have passed before M2
begins; this plan's M2 tests are the package-level restatement of it.

Proposals beyond this scope, not required for acceptance: a generated client for kiroku if
kiroku later publishes OpenAPI; Prometheus text parsing (the console does not read
`/metrics/prometheus`).


## Idempotence and Recovery

Every step is safe to repeat. Package scaffolding is additive; re-running `generate`
rewrites `src/generated/schema.d.ts` deterministically; `bun install` is idempotent. The
live suites are read-only against the servers (every route they call is a GET; the
WebSocket cases only subscribe) and leave no state behind. If a live test fails because a
server is down, the failure names the port; bring the stack up with plan 9's recipe and
re-run. If plan 10's exports differ from the names used here, change the import sites and
add a Decision Log entry naming the mapping — do not fork the functionality into these
packages. If the pgmq OpenAPI document in pgmq-hs changes, repeat the copy and generate
steps, update `openapi/SOURCE.md`, and let the parity and fixture tests report what moved.
Fixture seeds written by this plan are replaced wholesale by plan 9's recordings; nothing
in this plan depends on a fixture file's name.


## Interfaces and Dependencies

Prerequisite (hard): `docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
Complete, providing `createHttpClient` (with `okStatuses`), `ApiError`/`normalizeError`,
`int64()`, `pageSchema`/`useCursorPages`, `Dialect`/`openFeed`, `useSurfaceQuery`,
`useFeedSubscription`, `useLiveness`, and `queryKeys` from `packages/client-core/src/`. If
`okStatuses` (or an equivalent way to accept a 503 body without throwing) is missing, add it
to `packages/client-core/src/http.ts` as part of this plan and note it in plan 10's
Surprises & Discoveries. Prerequisite (soft): `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
for `startMockServer()`, `feedScript`, the fixture directory, and the `just stack-up`
recipe; this plan seeds fixtures itself when plan 9 has not landed.

Provided to later plans (public interface, from each package's `src/index.ts`):

- `@keiro-ui/client-kiroku`: `createKirokuClient`, `KirokuClientProvider`, `useKirokuClient`,
  the schemas and inferred types (`StreamInfo`, `KirokuEvent`, `DeadLetter`,
  `CheckpointInventory`, `LiveSubscription`, `MetricsSnapshot`, `Capabilities`, health
  types), `KirokuNameCursor`, `KirokuPositionCursor`, the read hooks (`useKirokuCapabilities`,
  `useKirokuMetrics`, `useKirokuHealth`, `useKirokuLiveSubscriptions`, `useKirokuCheckpoints`,
  `useKirokuDeadLetters`, `useKirokuStreams`, `useKirokuStream`, `useKirokuStreamEvents`,
  `useKirokuCategories`, `useKirokuCategoryEvents`, `useKirokuAllEvents`, `useKirokuEvent`),
  the feed hooks (`useKirokuEventTail`, `useKirokuMetricsFeed`), and the dialects
  (`kirokuEventsDialect`, `kirokuMetricsDialect`).
- `@keiro-ui/client-pgmq`: `createPgmqClient`, `PgmqClientProvider`, `usePgmqClient`, the
  schemas and types (`Queue`, `Message`, `ArchivedMessage`, `QueueMetrics`, `TopicBinding`,
  `RoutingMatch`, `NotifyInsertThrottle`, `ServiceDescriptor`, health types),
  `PgmqMessageCursor`, the generated `paths`/`components` types from `src/generated/schema.d.ts`,
  the read hooks (`usePgmqService`, `usePgmqQueues`, `usePgmqQueue`, `usePgmqQueueMetrics`,
  `usePgmqAllMetrics`, `usePgmqMessages`, `usePgmqMessage`, `usePgmqArchive`,
  `usePgmqArchivedMessage`, `usePgmqBindings`, `usePgmqAllBindings`, `usePgmqRoutingTest`,
  `usePgmqNotifyThrottles`, `usePgmqHealth`), `usePgmqQueueMetricsFeed`, and
  `pgmqMetricsDialect`.
- `@keiro-ui/client-shibuya`: `createShibuyaClient`, `ShibuyaClientProvider`,
  `useShibuyaClient`, the schemas and types (`ProcessorMetrics`, `ProcessorState`,
  `ProcessorMap`, `ReadinessStatus`, `ControlStatus`, health types), `extrapolateAge`, the
  read hooks (`useShibuyaProcessors`, `useShibuyaProcessor`, `useShibuyaHealth`,
  `useShibuyaControlStatus`), `useShibuyaProcessorsFeed`, and `shibuyaDialect`.

Consumers and the contracts they rely on: plan 13 (Streams & Subscriptions) uses the whole
kiroku package including `useKirokuEventTail`; plan 14 (Queues & Processors) uses pgmq and
shibuya including both feeds and `extrapolateAge`; plan 16 (Aggregates, Process Managers,
Timers) uses `useKirokuStreamEvents` and `useKirokuEvent` to render raw events beside keiro
state; plan 17 (Overview) uses `useKirokuCheckpoints`, `usePgmqAllMetrics`,
`useShibuyaHealth`, and the health hooks of all three; plan 19 extends the shibuya client
with `control.pause` and `control.resume` and must not change any read method's shape.

External dependencies whose choice matters: `zod` 4 (schemas), `@tanstack/react-query` 5
(cache, peer), `openapi-typescript` (pgmq type generation, dev only), vitest (tests), and
the three servers at their fixed development ports.
