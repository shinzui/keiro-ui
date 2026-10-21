---
id: 2
slug: build-the-keiro-runtime-console
title: "Build the keiro runtime console"
kind: master-plan
created_at: 2026-10-21T14:52:33Z
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
      note: "Round 2 corrections: endpoint inventory, origin/port rules, shell and client-core contracts, light theme default, interface-ownership decision"
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-10-21T20:30:00Z
      mode: "update"
      note: "kiroku mock review: testing API gains useScenario recorded, feedScript append options, pins, kirokuLog, and a /ws/metrics script; cascaded to EP-9, EP-11, EP-13"
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-10-21T19:24:29Z
      mode: "implement"
      note: "Coordinating child plan implementation in dependency order, starting with EP-7"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2: upstream wire facts (kiroku overflow, keiro health/mutations/origin), toolchain errors (data-table, preset, devtools), and cross-plan interface drift; all applied in the same pass"
---

# Build the keiro runtime console

This MasterPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Vision & Scope

The keiro runtime is a composable Haskell stack for event-sourced systems: **keiro** (the
framework: commands, aggregates, projections, process managers, timers, durable workflows,
outbox/inbox) on **kiroku** (the append-only PostgreSQL event store), **shibuya** (supervised
queue processing), and **pgmq-hs** (PostgreSQL-native work queues). The foundations
initiative (`docs/masterplans/1-keiro-runtime-ui-foundations.md`) wrote the cross-project
wire conventions (`docs/architecture/inspection-api-conventions.md`), filed 21 endpoint
improvement requests across the four runtime repositories, and set the UI's general
direction (`docs/architecture/ui-direction.md`). As of 2026-10-21 the owning repositories
have shipped almost all of those endpoints (see "Endpoint inventory" below). This
initiative builds the console itself.

When this MasterPlan is complete, this repository contains a bun workspace with a
React + TypeScript + Vite application, `apps/console`, that an operator starts with
`bun run dev` against a local runtime stack or deploys as static assets beside a running
application. In the browser they get:

- An **application shell** with a left **rail** (one icon per top-level section), a
  **collapsible sidebar** that navigates the section's many pages and recent entities, a
  **bottom bar** showing the active connection profile, per-surface health, the live/paused
  state and the visible store head, and an optional **right sheet** that opens inspectors
  (an event, a queue message, a journal entry) without leaving the page.
- A **command palette** on ⌘K / Ctrl+K that jumps to any page, any recent entity, or an
  entity by identifier ("workflow order-fulfillment/ord-42"), and toggles theme, liveness,
  and connection profile.
- **Read-only screens for every section of the direction document's information
  architecture**: Overview; Aggregates; Workflows; Process Managers & Timers; Projections &
  Read Models; Streams & Subscriptions; Queues & Processors — each consuming the owning
  project's shipped endpoints directly through a typed client package, with filter state in
  the URL, cursor pagination, live updates layered over authoritative polling, and a
  visible pause/refresh control.
- A **connection profile switcher** that points the console at one composed origin (the
  default) or at four separate origins.
- A **production build** that can be served at a sub-path behind a reverse proxy composing
  the four surfaces on one origin, with a documented separate-origins alternative.
- After the read-only release, a bounded set of **gated operator actions** (processor
  pause/resume; keiro preview-then-confirm mutations for timers and queue dead letters)
  rendered exactly as honestly as the owning endpoints gate them.

The user's directives fixing the technology are: **shadcn/ui on the React Aria base**
(shadcn's official `aria` base, built on `react-aria-components`), **TanStack Router**
(file-based routes, typed search params), **Paper Mono** as the typeface, and the shell
layout described above.

Explicitly excluded: any backend-for-frontend (ADR-5); authentication or authorization
(the conventions' recorded posture stands); projection rebuild, replay, or any destructive
bulk operation (deferred until they can be first-class jobs, ADR-7); the dead-letter
"morgue" with redrive over shibuya-pgmq-adapter (its requests IR-2 and IR-3 are still
`proposed` upstream — the console shows pgmq dead-letter queues through pgmq-inspect
instead); the SQL escape hatch; a charting library decision beyond what the Overview needs;
and implementing or changing any endpoint in another repository (gaps become improvement
requests filed from a child plan, never workarounds).


## Decomposition Strategy

The decomposition groups work by functional concern and follows the dependency shape the
direction document already fixed: a design system and shell that every screen uses, a data
layer per endpoint surface, screens per navigation section, then packaging and actions.

**Phase 1 — foundation (EP-7, EP-8, EP-9, EP-10).** The workspace, the owned component
package, and the shell are prerequisites for every screen and are built once. The client
core (HTTP, error envelopes, cursors, lossless int64, the one WebSocket core of ADR-2, and
the poll-first live-query hooks of ADR-3) is the single place where the cross-project
conventions become code. The local runtime stack and recorded fixtures are a separate plan
because they are mostly operational (running four Haskell servers against one database)
and because the fixtures they record are a shared artifact every later test suite consumes.

**Phase 2 — typed clients (EP-11, EP-12).** One package per surface, per ADR-5. The three
lower-layer clients (kiroku, pgmq, shibuya) are one plan: each is a thin typed wrapper over
a dozen routes, pgmq's is generated from its served OpenAPI document, and they share the
same shape. The keiro client is its own plan because its surface is several times larger
(workflows, aggregates, process managers, timers, projections, shards, streams, outbox,
inbox, mutations with preview/confirm, three WebSocket feeds) and has its own protocol
rules (opaque cursors bound to read kinds, schema-drift refusals, mutation gating).

**Phase 3 — read-only screens and packaging (EP-13 to EP-18).** Screens are grouped by
navigation section rather than by endpoint surface, so a plan's acceptance is "an operator
can answer these questions in this section" instead of "these routes are called". Two
sections pair naturally: Streams & Subscriptions (all kiroku) and Queues & Processors
(pgmq plus shibuya). The keiro-owned sections split into Workflows (the durable-execution
centerpiece), Aggregates + Process Managers & Timers (the differentiation surface, which
also reads kiroku for raw events), and Projections + Overview (the Overview composes
headline numbers from every client, so it is the natural integration gate). Packaging is a
separate plan with its own observable acceptance (the built console serves from a sub-path
behind a reverse proxy composing the surfaces). Completing Phase 3 is the **read-only
release gate** required by ADR-7.

**Phase 4 — gated actions (EP-19).** Mutations arrive only after the read-only release and
only over owning-repository gates. Keeping them in one plan keeps the honesty rules of
ADR-7 in one place.

Alternatives considered and rejected: one plan per surface spanning client and screens
together (couples data-layer and UI work, prevents screens from being built against
fixtures while a client is still in progress, and splits the shell's cross-surface
concerns across four plans); a single data-layer plan for all four clients (too large, and
the keiro client's protocol rules deserve their own acceptance); one plan per screen (nine
or more small plans whose boundaries would be the direction document's screen inventory,
not independently verifiable operator outcomes); and keeping the design-system adapter of
ADR-6 as a layer over shadcn (rejected — shadcn's copy-owned component source in
`packages/ui` *is* the single import boundary the adapter existed to provide, so a second
abstraction would be ceremony; recorded as ADR-8, which supersedes ADR-6).

**ADRs consulted.** Local, all under `docs/adr/`: [ADR-2](../adr/0002-websocket-inspection-protocol-convention.md)
(one WebSocket client core parameterized per dialect), [ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md)
(every live view is poll-first; pushes update the cache), [ADR-5](../adr/0005-no-backend-for-frontend.md)
(one typed client package per surface, no aggregation server), [ADR-6](../adr/0006-design-system-adapter-defers-the-component-library-choice.md)
(superseded by this initiative's ADR-8), [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md)
(read-only first; gates rendered honestly; payload visibility is a separate axis), and
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
(the component library decision made by this initiative). ADR-1 and ADR-4 govern the
runtime repositories and are context only. Cross-repository, cited by Mori handle:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` (inspection surfaces are a bounded
exception to keiro's no-UI stance; condition 1 is "no bundled browser application", which is
why static asset serving is this repository's problem), `mori://shinzui/keiro/okf/adrs/concepts/ADR-53`
(the HTTP surface is a transport over the ops command tree: paths are command words,
query keys are flags, GET for reads and POST for mutations), `mori://shinzui/keiro/okf/adrs/concepts/ADR-56`
(feeds own bounded shared drivers; no replay cursors — gaps mean re-subscribe or re-poll),
`mori://shinzui/keiro/okf/adrs/concepts/ADR-57` (compose mounts allocated applications
under prefixes without changing their routes), `mori://shinzui/keiro/okf/adrs/concepts/ADR-28`
and `ADR-35` (position vocabulary and the frozen projection-status contract),
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-9` (published HTTP/WebSocket shapes are
frozen), `mori://shinzui/kiroku/okf/adrs/concepts/ADR-16` (browser access is explicit and
default off), `mori://shinzui/kiroku/okf/adrs/concepts/ADR-18` (the surface is composable
and self-describing via `/capabilities`), and `mori://shinzui/pgmq-hs/okf/capabilities/concepts/CAP-12`
(the shipped pgmq-inspect HTTP surface). shibuya's decisions live in `docs/adr/` of
`mori://shinzui/shibuya` but that directory is not a registered OKF bundle, so they are
cited as project URI plus path with the artifact-level URI pending:
`0007-evolve-the-metrics-wire-contract-additively-and-keep-browser-access-and-control-opt-in.md`,
`0008-deliver-websocket-frames-through-one-bounded-outbound-queue-per-connection.md`, and
`0011-gate-control-endpoints-off-by-default-and-refuse-with-a-structured-error.md`.


### Endpoint inventory (audited 2026-10-21)

Every child plan builds against these working trees, not against the improvement-request
prose. Where a package is unreleased, the child plan pins the commit it was audited at and
records the release when it happens.

**kiroku — `kiroku-metrics` 0.3.0.1 (released 2026-10-20; store 0.11.0.1).** Requests
IR-8..IR-13 are all `completed`. HTTP routes (all GET/HEAD, relative to the mount):
`/capabilities` (self-description of which routes are mounted and whether CORS is on),
`/metrics`, `/metrics/<subscription>`, `/metrics/prometheus`, `/health`, `/health/live`,
`/health/ready`, `/subscriptions` and `/subscriptions/<name>` (live, process-local),
`/subscription-checkpoints` (durable truth, with `store_position`),
`/subscriptions/<name>/dead-letters?member&from&limit`, `/streams?category&prefix&from&limit`,
`/streams/<name>`, `/streams/<name>/events?from&limit&direction`, `/categories?from&limit`,
`/categories/<name>/events?from&limit`, `/events?from&limit&direction` (the `$all` log),
`/events/<uuid>`. Pages are `{items, next_cursor?}`; browse `limit` defaults to 100 and caps
at 1000; dead-letter `limit` defaults to 100 and caps at 1000. New routes use the nested
error envelope; `/metrics`, `/subscriptions`, and the WebSocket-over-HTTP probe keep the
legacy `{"error": "<string>"}` shape. Event JSON keeps its published camelCase payload keys
(`eventId`, `globalPosition`, ...) plus the newer snake_case `original_stream_name`. Two
WebSocket paths: `/ws/metrics` (snapshot on connect, then periodic) and `/ws/events`
(`subscribe_events {from_position?, category?}` → `event_stream_started`, `event` frames;
`error {code, message}` — or the older uncoded `error {message}` — with
`event_stream_overflowed` whose message text names a dropped *batch* count but carries no
structured field, so no client parses it; `unsubscribe_events`, `unsubscribe_metrics`,
`ping`/`pong`, `goodbye`). Streams and the prefix filter are byte-ordered; category
enumeration keeps the database collation. `truncate_before` is always present (`0` means
nothing truncated). The standalone `kiroku-inspect` mounts the live registry, so
`/subscriptions` answers `200 []` there; the legacy 404 appears only on embedded hosts
without a provider. CORS is explicit
origins only, default off. No OpenAPI document exists; the contract is
`docs/guides/building-an-inspection-ui.md` and `docs/user/metrics.md` in the kiroku
repository, whose wire rules the client must follow (parse int64 losslessly; ignore unknown
fields and frames). Local runner: the `kiroku-inspect` executable
(`DATABASE_URL=... kiroku-inspect --port 9091 --cors-origin ...`).

**pgmq-hs — `pgmq-inspect` 0.1.0.0 (in tree at `d6750a6`, unreleased).** Requests
IR-1..IR-3 are all `completed`. HTTP routes (GET only; HEAD is 405): `/` (service
descriptor with `websocket_path` and `openapi_path`), `/openapi.json`, `/queues`,
`/queues/{queue}`, `/queues/{queue}/metrics`, `/metrics`, `/queues/{queue}/messages?from&limit`,
`/queues/{queue}/messages/{msg_id}`, `/queues/{queue}/archive?from&limit`,
`/queues/{queue}/archive/{msg_id}`, `/queues/{queue}/bindings`, `/bindings`,
`/routing/test?routing_key`, `/notify/throttles`, `/health/live`, `/health/ready`. `limit`
defaults to 50 and is silently capped at 500. The **OpenAPI 3.0 document is served and
checked in** at `pgmq-inspect/test/golden/openapi.json`, with component schemas for every
record and the error envelope; the WebSocket feed is not in it. Metrics vocabulary:
`queue_length` (total rows), `queue_visible_length` (readable now), `total_messages`
(sequence high-water mark, not size), `oldest_msg_age_sec`/`newest_msg_age_sec` (nullable),
`scrape_time`, `default_partition_length` (nullable; null means unknown). Message IDs are
int64 and may exceed 2^53. WebSocket `/ws`: `subscribe {queue}`/`unsubscribe {queue}`/`ping`
→ `snapshot {queue, metrics, push}`, `update {queue, metrics, source: poll|notify}`, `pong`,
`error {code, message, queue|null}`, `goodbye`; metrics only, never messages; overflow sends
`error.code = overflow`. CORS: `CorsDisabled` by default, explicit origins only. Local runner:
`pgmq-inspect --port 9095 --cors-origin ...` with `PGMQ_INSPECT_DATABASE_URL`.

**shibuya — `shibuya-metrics` 0.10.0.1 plus an Unreleased changelog (tree at `0967f45`).**
Requests IR-3, IR-4, IR-5 are `completed`; the "pipeline stage graph" the direction document
hoped for was never part of IR-3 and does not exist. HTTP: `/metrics` (map keyed by processor
id), `/metrics/<id>`, `/metrics/prometheus`, `/health`, `/health/live`, `/health/ready`,
`GET /control` (`{enabled, operations}`), `POST /control/processors/<id>/pause|resume`.
Processor records are **camelCase and frozen** (`state{status: idle|processing|paused|failed|stopped}`,
`stats{received, processed, failed}`, `batch{...}`, optional `latency{count, sumSeconds, buckets}`,
`oldestInFlight{messageId, startedAt, ageSeconds}`, `progress{latest?, partitions, truncated}`);
the optional detail fields appear only when the host configures `MetricsDetailed`. The error
envelope is **flat**: `{"error": "<text>", "code": "<snake_case>", ...context}`. Control is
gated by `enableControl` (default off → 403 `control_disabled`), and a POST carrying an
`Origin` header must match the configured CORS origins even when CORS is otherwise off.
WebSocket `/ws`: `subscribe_all`/`subscribe {processors}`/`unsubscribe {processors}`/`ping`
→ `snapshot {metrics}`, `update {processor, metrics}`, new `terminal {processor, status}`
for `stopped` and `terminal {processor, status, error, messageId}` for `failed` (`messageId`
a string or `null`), `pong`, `error {code, message}` (`invalid_message`,
`subscription_limit_exceeded`, `queue_overflow` followed by a replacement snapshot),
`goodbye`; updates omit age-only changes, so clients extrapolate `ageSeconds` locally; no
replay cursor. No OpenAPI. Local runners are weak: there is no standalone server
executable (the `bench/` executables are bounded load fixtures), `shibuya-example` exits
after about five seconds, and the shibuya-pgmq-adapter example consumer builds against the
Hackage 0.10.0.x release (`^>=0.10.0.0`), which predates every Unreleased feature. **shibuya-pgmq-adapter IR-2 and IR-3 are still `proposed`**: there is
no queue-context or dead-letter browse/redrive surface; dead-letter payloads written by the
adapter carry `dead_letter_reason_code`, `dead_letter_reason_detail`, and (opt-in)
`read_count`, which the console renders when it sees them in a pgmq message.

**keiro — `keiro-ops-http` 0.21.0.0 in tree, Unreleased (MasterPlan 45 in the keiro
repository records all six functional surfaces implemented at `5893c7eb` and its release
plan publishes the cohort as 0.22.0.0; keiro's MasterPlan 46, created 2026-10-21 with its
child plans 317–319 Not Started, changes the unreleased HTTP contract before publication —
403 `origin_not_allowed` for cross-origin HTTP mutations, 415 `unsupported_media_type`, a
30 s delivery deadline, `/health` allowed to answer 503 `inspection_busy`, a replacement
default-order list cursor kind whose old tokens fail closed as `invalid_cursor`, and
`provenance_status: "unavailable"` as the norm — so the keiro-facing plans re-audit when
those land).**
IR-32 is `completed`; IR-27, IR-28, IR-29, IR-31 are `accepted` and IR-26, IR-30
`in-progress` even though their code is merged — frontmatter lags the tree. Routes are
generated from the `keiro-ops` command grammar (ADR-53): path segments are command words,
query keys are `snake_case` flags, reads are GET and mutations POST, a successful read
returns the command's JSON unwrapped. Read families: `GET /health`
(`{status, schema_drift, mutations_enabled}`, answering **503** with `status: schema_drift`
under the host's default refuse-on-drift policy and 503 `status: unavailable` without a
database); workflows `/wf/inspect/list`
(`status_class[]`, `workflow_name`, time windows, `ordering`, `limit` ≤ 500, `after`),
`/wf/inspect/header|journal|steps|children|awakeables/{NAME}/{ID}` with pages
`{observed_at, items, next_cursor?}`; aggregates `/aggregate/types|list|show|snapshot`
and process managers `/pm/list|show` — **only when the host mounts the matching hooks**
(the standalone executable and the compose example use `emptyAppHooks`, so these routes do
not exist there); timers `/timer/pending/list`, `/timer/stuck/list`; projections
`/projection/status` (`visible_store_head`, lifecycle and serving fields) and
`/projection/position?subscription` (`store_position`, `visible_store_head`,
`maximum_global_position_distance`); shards `/shard/list`, `/shard/status`; streams,
snapshots, outbox, inbox reads. Cursors are opaque base64url strings bound to one read
kind (`cursor_generation_mismatch` on misuse). Mutations are 403 `mutations_disabled` by
default; when enabled, `POST <path>` with an empty body returns `{"outcome":"preview", ...}`
and `POST <path>` with exactly `{"confirm":"execute"}` executes (a mutation's exit code is
reported only in the body's `exit_code`; the `Keiro-Ops-Exit-Code` header is for reads);
schema drift returns 409 `schema_drift` for reads too. Two mutation facts the actions plan
depends on: a timer requeue or cancel preview of an unknown or ineligible timer is a 200
with a `disposition` (`not_found`, `not_firing`, `already_terminal`, `would_requeue`,
`would_cancel`), not a 422, and its execution reports `outcome: transitioned | not_transitioned`;
and `/pgmq/dlq/redrive?queue=&limit=` takes the **logical** job queue name — keiro derives
`<queue>_dlq` itself and rejects a name already ending in `_dlq` — returning
`{available, would_affect_at_most}` on preview and `{affected}` on execution. Errors use the
nested envelope with a documented code table.
WebSocket `/ws` (`/keiro/ws` when composed): feeds `workflows`, `timers`,
`projection_groups`; `subscribe {feed, ...filters}` → `snapshot {feed, sequence, trigger, observed_at, items}`
then `update {..., changed, removed}` keyed by `{workflow_name, workflow_id}`, `{timer_id}`,
`{group_id}`; first page only; `queue_overflow` or a sequence gap means re-subscribe.
Composition: `composeSurfaces` mounts surfaces under `/keiro`, `/kiroku`, `/shibuya`,
`/pgmq`, with `GET /` listing mounted prefixes and 404 `surface_not_mounted` for an absent
one (the shipped compose example mounts only `/keiro` and `/kiroku`); **static asset
serving is not implemented and by ADR-40 will not be**. CORS is explicit origins, default
off, but the WebSocket upgrade admits an `Origin` only when it is allow-listed or equals
the request's own `scheme://Host`, so any proxy that rewrites `Host` (the Vite dev proxy
does) needs `--allow-origin` for the console's origin. No OpenAPI. Local runners:
`keiro-ops-http --database-url ... --port 9093 --allow-origin http://localhost:5173`
(`--port` is mandatory because the executable's own default is 9092, which is also
pgmq-inspect's upstream default) and the
`keiro-ops-http-compose-example` (behind the `compose-example` cabal flag), both without
aggregate or process-manager hooks; sample data via `just jitsurei-all` in the keiro
repository.


## Exec-Plan Registry

| # | Title | Path | Hard Deps | Soft Deps | Status |
|---|-------|------|-----------|-----------|--------|
| 7 | Scaffold the console workspace and design system | docs/plans/7-scaffold-the-console-workspace-and-design-system.md | None | None | Complete |
| 8 | Build the console app shell, navigation, and command palette | docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md | EP-7 | EP-10 | Complete |
| 9 | Provision the local runtime stack and recorded fixtures | docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md | None | EP-7 | Complete |
| 10 | Implement the client core for HTTP, cursors, int64, WebSocket, and live queries | docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md | EP-7 | EP-9 | Complete |
| 11 | Implement the kiroku, pgmq, and shibuya typed clients | docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md | EP-10 | EP-9 | Complete |
| 12 | Implement the keiro typed client | docs/plans/12-implement-the-keiro-typed-client.md | EP-10 | EP-9 | Not Started |
| 13 | Build the Streams and Subscriptions screens | docs/plans/13-build-the-streams-and-subscriptions-screens.md | EP-8, EP-11 | EP-9 | Not Started |
| 14 | Build the Queues and Processors screens | docs/plans/14-build-the-queues-and-processors-screens.md | EP-8, EP-11 | EP-9 | Not Started |
| 15 | Build the Workflows screens | docs/plans/15-build-the-workflows-screens.md | EP-8, EP-12 | EP-9, EP-13 | Not Started |
| 16 | Build the Aggregates, Process Managers, and Timers screens | docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md | EP-8, EP-11, EP-12 | EP-9, EP-13 | Not Started |
| 17 | Build the Projections and Overview screens | docs/plans/17-build-the-projections-and-overview-screens.md | EP-8, EP-11, EP-12 | EP-13, EP-14, EP-15, EP-16 | Not Started |
| 18 | Package the console for deployment | docs/plans/18-package-the-console-for-deployment.md | EP-8 | EP-9, EP-17 | Not Started |
| 19 | Add gated operator actions | docs/plans/19-add-gated-operator-actions.md | EP-14, EP-16, EP-17, EP-18 | None | Not Started |

Status values: Not Started, In Progress, Complete, Cancelled.
Hard Deps and Soft Deps reference other rows by their # prefix (e.g., EP-7, EP-10).
A whole-child hard dependency requires that child to be Complete.


## Dependency Graph

EP-7 (workspace and design system) has no dependencies and runs first; it creates the bun workspace, `apps/console`, `packages/ui`, the toolchain, and the Vite dev proxy that every
other plan assumes exists. EP-9 (local runtime stack and fixtures) also has no hard
dependency: its Haskell-side work (bringing up Postgres with keiro's seeded `jitsurei`
database — which holds the kiroku store and keiro's tables, and may or may not provision a
pgmq schema, in which case pgmq-inspect points at pgmq-hs's own dev database — and the four
inspection servers on the ports fixed below) can start on day one; only its fixture
recorder and MSW handlers need the workspace, so it softly depends on EP-7. **EP-7 and EP-9
may run in parallel.**

EP-10 (client core) hard-depends on EP-7 because it is a workspace package built with the
workspace's TypeScript, test, and lint configuration. It softly depends on EP-9: its
contract tests run against recorded fixtures and, when the stack is up, against the live
servers; until fixtures exist it uses hand-written samples copied from the owning
repositories' golden files.

EP-8 (shell) hard-depends on EP-7 for the component package and the route tree skeleton.
It softly depends on EP-10 because the bottom bar's liveness toggle and per-surface health
dots consume the client core's `LivenessController` and the `/health/live` probes; EP-8
ships those controls against a local stub interface first and wires them to EP-10's
exports when both exist. **EP-8 and EP-10 may run in parallel after EP-7.**

EP-11 and EP-12 (clients) hard-depend on EP-10 for the HTTP client, error normalization,
cursor-page helpers, int64 handling, the WebSocket core, and the query hooks they build on.
They softly depend on EP-9 for fixtures. **EP-11 and EP-12 may run in parallel.**

The screen plans EP-13 through EP-17 hard-depend on EP-8 (shell contracts: routes, sidebar
and command registration, right sheet, link builders, formatting helpers) and on the
client(s) for their surfaces: EP-13 and EP-14 on EP-11; EP-15 on EP-12; EP-16 on EP-12 and
EP-11 (the aggregate browser renders raw kiroku events beside folded state, and process
managers link to their journal streams); EP-17 on both because the Overview composes
headline numbers from every client. They softly depend on EP-9 (end-to-end tests run
against MSW by default and against the live stack when present) and, where noted, on an
earlier screen plan that introduced a reusable component (EP-13's event-detail sheet and
JSON viewer are reused by EP-15 and EP-16; EP-17 links into every other section). **EP-13,
EP-14, EP-15, and EP-16 may run in parallel once their clients are complete**; EP-17
follows them because its acceptance is that every headline number links to a working
section.

EP-18 (packaging) hard-depends on EP-8 so that there is a real shell to serve under a
sub-path; it softly depends on EP-17 so the production smoke test exercises real screens
and on EP-9 for the composed-stack configuration it documents. It may start as soon as
EP-8 is complete and finish after EP-17.

EP-19 (gated actions) hard-depends on the screens its actions attach to — EP-14
(processor pause/resume), EP-16 (timer requeue/cancel), EP-17 (the `mutations_enabled`
health signal in the bottom bar and the projection screens) — and on EP-18, because ADR-7
requires a read-only release before any mutation ships. The **read-only release gate** in
Progress must be checked before EP-19 starts.

No plan here depends on another repository accepting or implementing anything. Where a
plan discovers that an upstream capability is missing (today: aggregate and process-manager
hooks in a runnable keiro host; a long-running shibuya example with detailed metrics; queue
context and dead-letter redrive in shibuya-pgmq-adapter), it records the gap, files an
improvement request from this repository if none exists, and verifies against recorded or
hand-derived fixtures in the meantime.


## Integration Points

**Workspace layout and package names** (owner EP-7; consumers: all). The bun workspace
(root `package.json` `workspaces`, `bun.lock`) has `apps/*` and `packages/*`. Packages and their published names: `apps/console`
(`@keiro-ui/console`), `packages/ui` (`@keiro-ui/ui`: the shadcn-generated React Aria
components, Paper Mono, theme tokens, `globals.css`), `packages/client-core`
(`@keiro-ui/client-core`), `packages/client-kiroku`, `packages/client-pgmq`,
`packages/client-shibuya`, `packages/client-keiro` (`@keiro-ui/client-<surface>`), and
`packages/testing` (`@keiro-ui/testing`: recorded fixtures and MSW handlers, owner EP-9).
EP-7 creates `apps/console`, `packages/ui`, and the empty-but-wired `packages/testing`
and `packages/client-core` directories with package manifests so later plans add code, not
configuration. Root scripts are `bun run dev`, `bun run build`, `bun run check` (typecheck + lint +
format check), `bun run test` (vitest — always through `bun run`, since a bare `bun test`
starts bun's own runner), `bun run test:e2e` (Playwright); the `justfile` mirrors them. Tooling mirrors `mori://shinzui/keiro-runtime-kenshou-insights` (TypeScript 7,
oxlint, oxfmt, Vite 8, React 19, Tailwind 4, Playwright, bun as package manager, workspace
manager, and script runner); vitest and Playwright execute on Node 22, which the Nix dev
shell provides beside bun.

**The UI import boundary** (owner EP-7; consumers: EP-8, EP-13..EP-19). Screens and the
shell import UI primitives only from `@keiro-ui/ui/components/<name>`; `react-aria-components`
is a dependency of `packages/ui` alone. A screen that needs a primitive not yet present runs
`bunx shadcn@latest add <name>` inside `packages/ui` (the `components.json` there
selects the `aria-nova` style) and commits the generated source. This is the discipline
ADR-8 records. Package facts EP-7 fixed: shadcn 4.x components import `cn` from the `cn`
package, a runtime dependency of `packages/ui`; the stylesheet imports `shadcn/tailwind.css`
and `tw-animate-css`, both dev dependencies as the registry's `aria` manifest declares
them; the registry has no `data-table` item, so `@tanstack/react-table` is installed by
hand and lists are composed per shadcn's data-table recipe; and the generated `sonner`
wrapper is edited to take a `theme` prop (default `"light"`) instead of depending on
`next-themes`. The theme provider itself lives in `apps/console/src/shell/theme.tsx`,
created by EP-7 and reused unchanged by EP-8: light by default, dark behind the toggle,
and following the operating system only as an explicit `system` choice.

**Local ports and the composed-prefix convention** (fixed here; implemented by EP-7's Vite
proxy, EP-9's stack recipes, and EP-8's default connection profile). The four surfaces are
reached under the same path prefixes keiro's `composeSurfaces` uses, so one connection
profile ("same origin") works in development, in the composed deployment, and behind a
reverse proxy:

```text
surface   dev server                 dev port   prefix     WebSocket path(s)
shibuya   shibuya-metrics            9090       /shibuya   /shibuya/ws
kiroku    kiroku-inspect             9091       /kiroku    /kiroku/ws/metrics, /kiroku/ws/events
pgmq      pgmq-inspect               9095       /pgmq      /pgmq/ws
keiro     keiro-ops-http             9093       /keiro     /keiro/ws
console   vite dev server            5173       /          (application routes)
(opt.)    keiro-ops-http --enable-mutations  9094   none   used only by EP-9 to record a mutation
                                                           preview fixture and by EP-19's opt-in live
                                                           test; never proxied, never a profile default
```

The Vite dev server proxies each prefix to its port with the prefix stripped and `ws: true`,
so no CORS configuration is needed in development and application routes must never start
with one of the four prefixes. Two exceptions, both because the proxy forwards the
browser's `Origin` header while rewriting `Host`: shibuya requires that origin in
`corsAllowedOrigins` for control POSTs even when CORS is otherwise off, so a local shibuya
host with `enableControl = True` must list `http://localhost:5173` (EP-9 recipe, EP-19
tests); and keiro-ops-http admits a WebSocket upgrade (and, once keiro's MasterPlan 46
lands, an HTTP mutation) only when the `Origin` is allow-listed or equals the request's
`scheme://Host`, so the local keiro host is always started with
`--allow-origin http://localhost:5173` (EP-9 recipe). Behind a reverse proxy that preserves
`Host` — Caddy by default, nginx with `proxy_set_header Host $host` — no keiro allow-list
is needed (EP-18). In the composed deployment the host mounts the surfaces at
the same prefixes and serves the console's static bundle (EP-18); in the separate-origins
deployment the connection profile holds four absolute origins and each server's CORS
allowlist includes the console's origin.

**Shell contracts** (owner EP-8; consumers: EP-13..EP-19). EP-8 owns, under
`apps/console/src/`: the route tree conventions (`routes/__root.tsx` providers,
`routes/_shell.tsx` pathless layout with every page as a placeholder file under
`routes/_shell/<section>/`, one directory per section; the section paths are `/`,
`/aggregates`, `/workflows`, `/process-managers` and `/timers`, `/projections` and `/shards`,
`/streams`, `/categories`, `/events`, `/subscriptions`, `/queues`, `/processors`,
`/settings`); `shell/navigation.ts` (the rail sections and each section's sidebar entries,
which screen plans extend); `shell/commands.ts` (`useRegisterCommands` for static page and
preset commands, and the `jumpParsers` table that owns every parsed "go to entity" command
— one parser per entity kind, built on `lib/links.ts`, so screen plans verify rather than
register them); `shell/recent.ts` (the recent-entities store that screens feed with
`useRecordVisit({kind, label, href})`); `shell/theme.tsx` (created by EP-7, light by
default, reused unchanged); `shell/right-sheet.tsx` (`registerSheet(kind, Component)` and
`useRightSheet().open({kind, ref})`, mirrored to the `sheet` search parameter so sheets are
URL-addressable); `shell/status-bar.tsx` (slots for connection, per-surface health,
liveness, visible store head, version); `shell/features.ts` (`registerFeature` and
`registerAllFeatures`, the one-line-per-section aggregator through which screen plans
register their sheets, commands, and sidebar entries from `apps/console/src/features/index.ts`);
`settings/connection-profiles.ts` (the
`ConnectionProfile` type — `{id, name, mode: "same-origin" | "separate", origins}` plus the
optional `processManagerNames` (EP-16) and `deadLetterQueueSuffix` (EP-19) fields — the
`useSurfaceBaseUrl(surface)` hook, and localStorage persistence); `lib/links.ts` (typed route
builders used for every cross-entity hyperlink, including `processManager(name)` versus
`processManagerInstance(name, correlation)`, `streamEvents`, `categoryEvents`,
`archivedMessage`, `shards({subscription?})`, and `timers({manager?, correlation?, tab?})`;
entity builders take positional strings, `links.workflow(name, id)`); and `lib/format.ts`
(`formatRelativeTime`, `formatDuration`, `formatTimestamp`, `formatInt`, and
`formatPositionDistance`; every screen plan uses exactly these spellings). EP-8 also fixes the keyboard
contract: ⌘K/Ctrl+K opens the palette, `[` toggles the sidebar, `?` shows shortcuts, Escape
closes the right sheet. The bottom bar's version slot reads the `__APP_VERSION__` and `__GIT_COMMIT__` globals,
declared as placeholders by EP-8 and given their real values by EP-18's build. Five
conventions EP-8 sets that screen plans must follow: the per-surface health probe is
`/health/live` for kiroku, pgmq, and shibuya but `/health` for keiro (keiro-ops-http has no
`/health/live`), and a keiro 503 whose body says `schema_drift` is `degraded` (amber), not
down; tabbed detail pages carry the active tab in a `tab` search parameter; EP-8 creates
placeholder route files for every route in the link map (including
`/queues/$name/archive/$id`, which pgmq-inspect's separate archive lookup needs) so
`lib/links.ts` is typed from day one — screen plans replace placeholder components and
never create or rename route files, and regenerate the tree with
`bun run --filter @keiro-ui/console generate-routes` (EP-7's script); list screens keep
their page cursor in the URL and fetch one page per query through `useSurfaceQuery`, while
"load more" views (the workflow detail tabs, the projections table) use `useCursorPages`;
and Playwright specs live under `apps/console/e2e/<section>/` (the production smoke under
`apps/console/e2e/production/`).

**Shared screen components** (owner EP-13; consumers EP-14, EP-15, EP-16, EP-17, EP-19).
EP-13 introduces, under `apps/console/src/components/`: `JsonViewer`, `CursorPager`,
`PositionBadge`, and `LiveTailControls`, and under `apps/console/src/features/streams/`
the `EventDetailSheet` (sheet kind `event`). Later screen plans import them from those
paths; a plan that runs before EP-13 lands ships a minimal
local copy at the same path, which EP-13 replaces. EP-16 adds
`apps/console/src/features/shared/{SplitPane,HydrationBadge,NotMountedState}.tsx` for the
hook-gated sections and EP-17's Overview reuses `NotMountedState`.

**Cross-entity link map** (owner EP-8 for the builders; each screen plan wires its side).
Workflow instance → its journal entries' `global_position` into the `$all` log
(`/events?from=`); keiro exposes no journal stream name on the header or journal entries
(verified against `keiro/src/Keiro/Workflow/Inspection.hs`), so the `/streams/<name>` link
is omitted and EP-15 records a candidate improvement request;
kiroku dead letter → `/events/<event_id>` and `/subscriptions/<name>`; aggregate →
`/streams/<stream_name>` (from `/aggregate/show`) and `/categories/<category>`; process
manager → `/streams/<journal_stream_name>` and its pending timers; timer →
`/process-managers/<process_manager_name>/<correlation_id>`; projection group → its
subscription's checkpoint row in `/subscriptions` only when the subscription name is known
(`/projection/status` rows carry no subscription name; EP-17 takes it from a
`?subscription=` parameter and records a candidate improvement request); process-manager
names are not discoverable from keiro (`/pm/list` requires a name), so EP-16 reads them from
the connection profile's `processManagerNames` and recents and records a candidate request; queue message carrying adapter
dead-letter fields → rendered reason code and detail (no processor link until
shibuya-pgmq-adapter IR-2 ships); processor → no queue link for the same reason, stated
in the UI as "queue context unavailable".

**Client-core contracts** (owner EP-10; consumers: EP-11, EP-12, every screen). Under
`packages/client-core/src/`: `http.ts` (`createHttpClient({baseUrl, fetch?})` with
`get`/`post`, query encoding that repeats array keys, and lossless JSON parsing);
`errors.ts` (`ApiError {surface, status, code, message, details}` normalizing the nested
envelope, shibuya's flat envelope, and kiroku's legacy string envelope, with
`legacy_error` as the code for the last); `int64.ts` (the rule: JSON integers outside the
safe range are revived as `bigint`; schema fields declared `int64()` always normalize to
`bigint`; everything else stays `number`); `pages.ts` (`Page<T, Cursor>` as
`{items, nextCursor?}` and `useCursorPages`, the `useInfiniteQuery` adapter that echoes
cursors back untouched); `feed.ts` (the ADR-2 WebSocket core: a `Dialect` descriptor naming the
subscribe/unsubscribe builders and the `snapshot`/`update`/`event`/`error`/`goodbye`/`pong`
frame types, reconnect with backoff, `goodbye` handling, and an `onResync` callback fired on
overflow codes so the owning query refetches); `live.ts` (`LivenessProvider`,
`useLiveness()` with `paused`, `pausedSince`, `pause`, `resume`, `refreshAll`; `useSurfaceQuery` applying
per-surface polling defaults and the adaptive clamp `clamp(10s, 10 × last fetch, 60s)`;
`useFeedSubscription(dialect, applyToCache)` layering a feed onto the query cache); and
`query-keys.ts` (key factories per surface). Validation uses zod 4 schemas exported by each
client package so screens get runtime-checked types. Refinements fixed by EP-10's draft
and binding on EP-11 and EP-12: `createHttpClient` takes a required `surface` so every
`ApiError` is tagged; `get`/`post` accept `okStatuses` so health routes can return their
503 readiness body instead of throwing; `ApiError` also carries `raw` and `headers`, non-JSON bodies map to
`http_<status>`, and network failures to `network_error` with status 0; the TypeScript
`Page` type names its cursor `nextCursor` while the wire field stays `next_cursor`, and
`pageSchema` accepts an extra schema for page-level fields such as keiro's `observed_at`,
`generation`, and `visible_store_head`; a `Dialect.subscribe` may return `null` for feeds
that push on connect (kiroku `/ws/metrics`); `useFeedSubscription` takes the query-key
prefix it invalidates on resync, and a reconnect always counts as a resync. EP-10's
Interfaces and Dependencies section is the binding spelling of every signature named here;
EP-11, EP-12, and the screen plans restate it verbatim, and any change is made in EP-10
first and cascaded to them in the same commit, never absorbed silently at an import site.

**Client packaging convention** (owner EP-11 for the pattern; EP-12 follows it). Every
client package exports `create<Surface>Client({baseUrl, fetch?})`, a
`<Surface>ClientProvider` with `use<Surface>Client()`, its zod schemas and types, its feed
dialect(s) and hooks, and `useSurfaceQuery` wrappers; packages never import from
`apps/console`, and `apps/console/src/routes/__root.tsx` composes the four clients from the
active connection profile. The keiro package additionally exports `keiroKeys` (its query-key
factory built on the client core's `surfaceKey`) and `mergeFeedFrame`.

**Fixtures and mock handlers** (owner EP-9; consumers: EP-10..EP-19 tests and the
`VITE_MOCK=1` development mode). Recorded responses live at
`packages/testing/fixtures/<surface>/<route-slug>.json` with a `_meta.json` naming the
source commit and database seed; `packages/testing/src/handlers/<surface>.ts` serves them
through MSW; `packages/testing/src/node.ts` exposes `startMockServer()` for vitest (serving every
fixture at its real path under `http://localhost/<surface>`) and
`packages/testing/src/browser.ts` exposes `startMockWorker()` for Playwright and the mock dev
mode; `packages/testing/src/scenario.ts` exposes
`useScenario({ fail?: { [surface]: slug[] }, recorded?: { [surface]: slug[] } })` (swap
routes for their recorded error fixtures, or a derived default for its recorded original),
`feedScript(surface, { overflowAfter?, append?, dropped?, intervalMs? })` (drive the
scripted feeds), `pins(surface)` (the entity names the manifests pinned; tests never
hard-code seeded names), and `kirokuLog` (a stateful mock of kiroku's `$all` log that the
`/ws/events` script appends to and the `/events` and category-events handlers page over,
so a pushed event is also polled, per ADR-3). Fixture slugs name a route's role, with
`.page2`, `.error`, and `.recorded` suffixes, and EP-9 owns them. WebSocket feeds are mocked with scripted frame sequences in
`packages/testing/src/feeds/<surface>.ts` (kiroku has two: `/ws/events` and `/ws/metrics`). EP-7 owns the opt-in bootstrap in
`apps/console/src/main.tsx` that starts the mock worker when `VITE_MOCK=1`, and the root
`justfile` into which EP-9 merges its `stack-*` and `fixtures-*` recipes; EP-9 owns the
worker, handlers, feeds, and recorder.

**keiro client specifics** (owner EP-12; consumers: EP-15, EP-16, EP-17, EP-19). The
`workflows` feed accepts only `status_class`, `workflow_name`, and `limit` as filters, so a
workflow list with a time window or non-default ordering is poll-only; `timers.stuck`
returns a bare array rather than the `{observed_at, items}` envelope. The keiro
client exposes read families as namespaces (`workflows`, `aggregates`, `processManagers`,
`timers`, `projections`, `shards`, `streams`, `outbox`, `inbox`, `health`), typed cursors
branded per read kind, the feed hooks `useWorkflowsFeed`, `useTimersFeed`, and
`useProjectionGroupsFeed` (each `(filters, {enabled?, onResync?})`, doing the cache merge
with `mergeFeedFrame` themselves so screens only decide `enabled`), and a `./mutations`
entry point whose three typed wrappers — `timers.requeue(id)`, `timers.cancel(id)`, and
`pgmq.dlqRedrive({queue, limit?})` with `queue` the logical job queue name — encode the
empty-body and `{"confirm":"execute"}` protocol, decode the timer `disposition`/`outcome`
and redrive `available`/`affected` results, and surface `mutations_disabled`,
`schema_drift`, `origin_not_allowed`, and the other codes as typed refusals; EP-19 renders
those results and refusals, it never re-implements the protocol or builds command paths.

**Vocabulary and display rules** (owner EP-8 for helpers; enforced by EP-16 and EP-17).
keiro-facing screens label position differences "global position distance" and pass
`store_position` and `visible_store_head` through untranslated (ADR-28); shibuya fields are
shown under their published camelCase names; pgmq's `queue_length` and
`queue_visible_length` are labelled "total" and "visible", never "depth" alone, and
`total_messages` is labelled as a lifetime counter.

**Early producer/consumer checks** (scheduled before dependent work expands): (1) EP-10
with EP-9 — the client core fetches kiroku `/capabilities` and a pgmq message page whose
`msg_id` exceeds 2^53 through the Vite proxy and round-trips the id exactly; this is the
int64 rule's proof and must pass before EP-11 generates the pgmq client. (2) EP-8 with
EP-10 — once `shell/liveness.tsx` re-exports the client core's `LivenessProvider` and
`useLiveness` (the `{paused, pausedSince, pause, resume, refreshAll}` shape both plans
declare; the shell's health probe stays shell-owned), the bottom bar's pause toggle stops a
real `useSurfaceQuery` poll and resume triggers an immediate refetch, proving the liveness
contract before screens adopt it. (3) EP-12 with
EP-15 — the `workflows` feed's `snapshot`/`update`/`removed` reconcile against
`/wf/inspect/list` on the live stack before the `timers` and `projection_groups` feeds are
wired. (4) EP-18 with EP-9 — the built console served at `/console/` behind a reverse
proxy that composes the four surfaces renders the Overview with no CORS headers involved.

**Candidate ADRs.** Written now: ADR-8 (shadcn/ui on the React Aria base; `packages/ui`
as the import boundary; Paper Mono; supersedes ADR-6). Expected later: the int64-as-bigint
wire rule and the three-envelope error normalization (after EP-10); the poll-first live
query contract as the application of ADR-3 (after EP-10); the composed-prefix deployment
convention and the console-at-a-sub-path packaging (after EP-18); the honest-gate rendering
rules as the application of ADR-7 (after EP-19). Deliberate exclusions worth recording when
they bite: no rebuild/replay UI; no adapter dead-letter redrive until upstream ships it.


## Progress

Phase 1 is Complete (EP-7, EP-8, EP-9, EP-10 on 2026-10-21), and early checks 1 (int64
through the dev proxy) and 2 (shell liveness drives a real poll) pass. EP-11 is Complete
(2026-10-21); EP-12 is next, after which EP-13 and EP-14 (which need only EP-11 and EP-8)
can start. The local stack has two profiles (`just stack-up`
for jitsurei, `just stack-up mori` for a live mori daemon); fixtures come from jitsurei only.
The EP-8/EP-10 liveness integration check (Integration Points, early check 2) runs when
EP-10 lands.

Cross-plan gates with their own acceptance:

- [ ] Live-stack integration gate: the console at `bun run dev` renders every section's list
  screen against the EP-9 stack (kiroku-inspect, pgmq-inspect, keiro-ops-http, and a
  shibuya-metrics server) through the Vite proxy with liveness on, and the int64 round-trip
  check of Integration Points passes. (Owner: EP-17, verified with EP-9 running.)
- [ ] Read-only release gate: EP-13 through EP-18 are Complete, the production build is
  served behind a composing reverse proxy, a release tag `v0.1.0` is cut, and no mutation
  control exists anywhere in the UI. EP-19 may not start before this is checked.


## Surprises & Discoveries

- Audit (2026-10-21): the owning repositories shipped faster than their request
  frontmatter says. keiro's `docs/improvement-requests/` still marks IR-26 and IR-30
  `in-progress` and IR-27/28/29/31 `accepted`, while keiro MasterPlan 45 records all six
  surfaces implemented at commit `5893c7eb` with only the release plan open. Child plans
  therefore pin the audited commits, not the request statuses.
- Audit (2026-10-21): keiro's runnable hosts (`keiro-ops-http` and
  `keiro-ops-http-compose-example`) use `emptyAppHooks`, so `/aggregate/*` and `/pm/*` do
  not exist in any process an operator can start today, even though the jitsurei example
  defines the inspectors. EP-9 must either obtain a host that mounts them (an improvement
  request to keiro) or hand-derive fixtures from keiro's encoders and test seed; EP-16 is
  verified against fixtures until a host exists.
- Audit (2026-10-21): keiro will not serve static assets (ADR-40 condition 1); the
  direction document's "served beside the composed mount" deployment therefore means a
  reverse proxy or a host-chosen static server in front of the composed origin. EP-18 owns
  this; a request to keiro for an optional static mount is a candidate, not a dependency.
- Audit (2026-10-21): shibuya-pgmq-adapter IR-2 and IR-3 (queue context behind a processor;
  dead-letter browse and gated redrive) are still `proposed`. The direction document's
  "DLQ morgue with gated redrive" screen has no endpoint; EP-14 shows adapter-written
  dead-letter fields inside pgmq messages instead, and the processor→queue link is omitted.
- Audit (2026-10-21): shibuya's "pipeline stage graph with per-stage workload" never made it
  into IR-3; the Processors screen renders per-processor state, counters, latency
  histogram, cursor progress, and oldest in-flight instead.
- Audit (2026-10-21): three error envelopes coexist on the wire (nested object; shibuya's
  flat `{error, code}`; kiroku's legacy `{error: "<string>"}` on `/metrics` and
  `/subscriptions`), and two casing conventions (snake_case everywhere new; frozen camelCase
  in shibuya records and inside kiroku event payloads). The client core normalizes errors
  and never renames fields.
- Audit (2026-10-21): pgmq-hs ships a served OpenAPI 3.0 document with a checked-in golden
  (`pgmq-inspect/test/golden/openapi.json`) and a dependency-free Node test fixture
  generated from it (under `test/client/`, not a published client); the others publish
  prose contracts and golden JSON only. EP-11 generates the pgmq types with
  `openapi-typescript` and hand-writes the rest.
- Review round 2 (2026-10-21), verified against the four upstream working trees: kiroku's
  `event_stream_overflowed` frame carries no structured count (its message text names a
  dropped batch count and is documented as not a contract), `/categories` keeps the
  database collation while `/streams` is byte-ordered, `truncate_before` is never null, and
  the standalone `kiroku-inspect` mounts the live registry; pgmq's overflow error frame has
  `queue: null` and its OpenAPI types `read_ct` as `int64`; shibuya's `terminal` frame
  carries `error` and `messageId` (nullable) only on the `failed` variant; keiro's
  `/health` answers 503 for `schema_drift` under the default policy, a timer requeue or
  cancel preview answers 200 with a `disposition` rather than 422, `pgmq dlq redrive`
  takes the logical queue name and derives `_dlq` itself, the exit-code header is for
  reads only, the WebSocket upgrade checks `Origin` against the allow-list or the request's
  `Host` (so the Vite proxy needs `--allow-origin`), the compose example mounts only
  `/keiro` and `/kiroku`, `keiro-ops-http` defaults to port 9092, and keiro's MasterPlan 46
  will change the unreleased contract before it ships as 0.22.0.0. All of these were
  corrected in the affected child plans in the same pass.
- Review round 2 (2026-10-21), toolchain: shadcn's registry has no `data-table` item (the
  recipe composes `table` with `@tanstack/react-table`), the init preset is `nova` (the
  CLI derives `aria-nova`), `@tanstack/router-devtools` is deprecated in favour of
  `@tanstack/react-router-devtools`, TanStack Router's `head` needs `<HeadContent />`,
  `tw-animate-css` and `shadcn` are dev dependencies of `packages/ui`, and the
  `generate-routes` script (`tsr generate` from `@tanstack/router-cli`) the screen plans
  call had not been created by EP-7. Corrected in EP-7 and EP-8.
- Review round 2 (2026-10-21): the mori registrations of keiro, pgmq-hs, and shibuya are
  stale (many changed inputs), so `mori registry concepts --id` does not yet resolve
  keiro ADR-53 through ADR-57 even though the files exist with the cited titles; the
  handles in this document are correct in shape and will resolve after a registry refresh.
- Drafting (2026-10-21): keiro's `jitsurei` example starts no shibuya-metrics server and its
  dev PostgreSQL is socket-only, so the shibuya baseline for the local stack is the
  shibuya-pgmq-adapter example consumer on its own database, and EP-9's recipes must pass
  socket-style connection settings; detailed shibuya metrics come from golden-derived
  fixtures until a long-running example with `MetricsDetailed` exists upstream.
- Drafting (2026-10-21): three keiro reads lack a field the direction document's link map
  assumed — workflow headers and journal entries carry no journal stream name,
  `/projection/status` rows carry no subscription name, and no route lists process-manager
  names (`/pm/list` requires one) — and `/timer/stuck/list` returns a bare array unlike the
  pending page. EP-15, EP-16, and EP-17 record candidate improvement requests to keiro and
  degrade honestly (omitted link, `?subscription=` parameter, profile-configured names).
- Planning review (2026-10-21), kiroku mocks: the standalone `kiroku-inspect` runs no
  subscriptions, so recordings of `/subscriptions` (`200 []`), `/metrics`, and `/ws/metrics`
  carry no subscription data, and the jitsurei seed parks no kiroku dead letters (its
  `useDeadLetter` is a pgmq job policy); EP-9 now derives populated fixtures named after the
  recorded checkpoints. EP-9's first handler sketch would have served kiroku's `from=0`
  first pages as empty pages and could not tell `direction`/`category` variants apart; its
  `/ws/events` script ignored `from_position` and `category`; static fixtures could not
  make pushed events appear in the next poll (ADR-3) or give the overflow re-read anything
  to recover, so EP-9 adds the stateful `kirokuLog`; no `/ws/metrics` script existed; and
  EP-9's and EP-13's fixture names disagreed. All corrected in EP-9, EP-11, and EP-13 in the
  same pass.
- EP-7 (2026-10-21): the user's global bun configuration enforces a seven-day
  `minimumReleaseAge`, so every child plan's dependency floors that are younger than a week
  cannot be installed; pin the newest release older than seven days instead (EP-7 records
  the substitutions) and call the shadcn CLI as `bunx shadcn@4.21.5`, since `@latest` is
  blocked too. `msw` 3.0.3 (EP-9) is old enough.
- EP-7 (2026-10-21): a `redpanda-0` container on this machine listens on 127.0.0.1:9092,
  the original pgmq dev port. Resolved during EP-9 by the user's directive to use a
  different port: pgmq's dev port is now 9095 (Decision Log); EP-9's `stack-up` still
  checks every port before starting.
- EP-7 (2026-10-21): the React Aria Sheet composes as `<SheetTrigger>` wrapping its trigger
  and `<Sheet side>` content; the right-sheet host of EP-8 should drive it with
  `isOpen`/`onOpenChange` rather than a Radix-style controlled `open` prop.
- EP-9 (2026-10-21): the jitsurei seed is thin after a re-seed (30 events, 2 workflows, no
  kiroku subscriptions, checkpoints, causation links, or dead letters, no pending timers), so
  many kiroku and keiro fixtures are derived (`packages/testing/scripts/derive.ts`, flagged
  `derived: true`). Two findings for later plans: keiro's aggregate and process-manager
  routes take the type, id, and correlation as **query flags**
  (`/aggregate/show?name=order&id=...`, `/pm/show?name=...&correlation=...`), not path
  segments, and an unknown correlation answers `200 null`; and the local shibuya baseline
  (Hackage 0.10.0.x) has no `/control`, no detailed fields, and no CORS. The user chose a mori
  stack profile (EP-9 M6) as the source of real subscription, dead-letter, and job-queue
  data; rei and mori both pin keiro `e6ef560`, which has no keiro-ops-http and no aggregate
  hooks, so the aggregate gap stays derived. Filed upstream:
  `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55` (a runnable host mounting
  jitsurei's aggregate and process-manager hooks) and
  `mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-9` (a long-running example
  with detailed metrics and configurable control and CORS); neither is a dependency.
- EP-8 (2026-10-21): the router uses a custom search serializer
  (`apps/console/src/lib/search.ts`) — scalar search values stay exact strings and only
  JSON arrays/objects are parsed — because TanStack's default would turn int64 positions in
  `?from=` into lossy numbers. Screen plans' search schemas declare positions and ids as
  `z.string()`; array filters such as `status_class` travel as JSON arrays.
- EP-8 (2026-10-21): registered sheet components receive `{ entityRef, close }` (React 19
  reserves `ref`); `links.timer(id)` was added for the timer inspector sheet; React Aria
  links navigate through a `RouterProvider` re-exported from
  `@keiro-ui/ui/components/router-provider`.
- Audit (2026-10-21): kiroku's guide says known query parameters reject duplicates, but
  only the dead-letters route does; the browse routes take the first value. The client
  never sends duplicate keys, so this is a documentation note for EP-11, not a bug to
  work around.


## Decision Log

- Decision: The component library is shadcn/ui on its official React Aria base (`aria`
  base, `nova` style, `components.json` style `aria-nova`), generated into the
  repository-owned `packages/ui`; screens import only from `@keiro-ui/ui`. The design-system
  adapter of ADR-6 is retired because shadcn's copy-owned component source is the import
  boundary that adapter was meant to provide. Recorded as ADR-8, superseding ADR-6.
  Rationale: user directive ("shadcn-ui with react aria"); shadcn 4.21+ ships the `aria`
  base with every primitive the direction document needs (sidebar, sheet, command palette on
  React Aria `Autocomplete`, data table, tabs, dialog, toast via sonner, resizable panels,
  kbd); a second abstraction over copy-owned code would be ceremony. The sibling console
  `mori://shinzui/keiro-runtime-kenshou-insights` already uses the `aria-vega` style, so the
  toolchain is proven in this family; `nova` is chosen here for its reduced padding, which
  suits a dense operations console.
  Date: 2026-10-21

- Decision: Paper Mono (`https://github.com/paper-design/paper-mono`, SIL OFL 1.1, no
  Reserved Font Name) is the console's only typeface; the variable `PaperMono[wght].woff2`
  (weights 100–800) is vendored into `packages/ui/src/fonts/` with `OFL.txt` beside it and
  declared once via `@font-face`; both `--font-sans` and `--font-mono` resolve to it.
  Rationale: user directive; OFL permits bundling unmodified; a single monospaced family
  makes identifiers, positions, and JSON align everywhere.
  Date: 2026-10-21

- Decision: Routing is TanStack Router with file-based routes via `@tanstack/router-plugin`
  for Vite, `autoCodeSplitting`, and zod 4 schemas as `validateSearch` (no adapter needed
  for zod 4); server state is TanStack Query 5. Filter, cursor, selected-entity, and
  right-sheet state live in search parameters so every view is shareable.
  Rationale: user directive for the router; the direction document's URL-state rule; typed
  search params are the mechanism that makes cross-entity links and bookmarkable filters
  cheap.
  Date: 2026-10-21

- Decision: The workspace is bun (package manager, `workspaces`, script runner, `bun.lock`),
  with TypeScript 7, Vite 8, React 19, Tailwind 4, oxlint, oxfmt, vitest, and Playwright,
  and a Nix flake providing the toolchain, mirroring `mori://shinzui/keiro-runtime-kenshou-insights`
  in full; vitest and Playwright execute on Node 22, which the dev shell provides beside bun.
  `docs/architecture/ui-direction.md`'s original "bun workspace" wording is updated to match.
  Rationale: user directive on 2026-10-21, given after the plans were first drafted with pnpm
  per the direction document, so the keiro family's frontends share one toolchain; the user
  chose to keep vitest rather than adopt `bun test`.
  Date: 2026-10-21

- Decision: Screens are decomposed by navigation section (Streams & Subscriptions; Queues &
  Processors; Workflows; Aggregates + Process Managers & Timers; Projections + Overview),
  not by endpoint surface, and the clients are decomposed by surface (lower three in one
  plan, keiro alone).
  Rationale: a screen plan's acceptance is an operator outcome; a client plan's acceptance
  is a contract test against one owner's wire format. The two cut differently and should.
  Date: 2026-10-21

- Decision: Development, composed deployment, and reverse-proxied deployment all expose the
  surfaces under the prefixes `/kiroku`, `/shibuya`, `/pgmq`, `/keiro` on the console's
  origin; the dev ports are fixed at 9090/9091/9095/9093 and the Vite proxy strips the
  prefixes.
  Rationale: one "same origin" connection profile then works everywhere and CORS never
  enters development; the prefixes are the ones keiro's `composeSurfaces` already uses.
  Date: 2026-10-21

- Decision: JSON integers outside JavaScript's safe range are revived as `bigint`, and every
  identifier or position field declared `int64()` in a client schema is normalized to
  `bigint`; the pgmq client's types are generated from the checked-in OpenAPI golden with
  `openapi-typescript`, the other three are hand-written against the owners' guides and
  golden files.
  Rationale: kiroku's and pgmq's guides both require lossless int64 handling and pgmq's
  message ids can exceed 2^53; only pgmq publishes a machine-readable spec today (ADR-5
  foresaw regenerating hand-written clients when specs appear).
  Date: 2026-10-21

- Decision: The initiative ships a read-only release (tag `v0.1.0`) before any mutation;
  EP-19 is the only plan that adds actions and is limited to shibuya processor pause/resume,
  keiro timer requeue/cancel, and keiro pgmq dead-letter redrive through the preview/confirm
  protocol. Projection rebuild, replay, stream deletion, outbox/inbox maintenance, and
  anything bulk are excluded from this initiative.
  Rationale: ADR-7; the excluded operations are replay-shaped or destructive and need the
  guardrail sequence and job-style progress the owning surfaces do not yet provide.
  Date: 2026-10-21

- Decision: pgmq-inspect's local dev port is 9095, not 9092; the Vite proxy maps `/pgmq` to
  127.0.0.1:9095 and every child plan's port table says so. 9092 stays the upstream default
  of both pgmq-inspect and keiro-ops-http, which is why every recipe passes `--port`
  explicitly.
  Rationale: user directive on 2026-10-21 ("can you use a different port?") when EP-9 found
  9092 held by a local Kafka-compatible (redpanda) container; 9094 is already reserved for
  the optional mutations-enabled keiro host, so 9095 is the next free port.
  Date: 2026-10-21

- Decision: No intention is linked to this MasterPlan; commits carry `MasterPlan:` and
  `ExecPlan:` trailers only.
  Rationale: the user selected Skip when asked.
  Date: 2026-10-21

- Decision: The console's theme is light by default; dark stays available behind the
  theme toggle and following the operating-system preference is an explicit `system`
  choice, never the default. One provider, `apps/console/src/shell/theme.tsx`, is created
  by EP-7 and reused unchanged by EP-8 (storage key `keiro-ui.theme.v1`).
  Rationale: user directive on 2026-10-21 ("I don't want dark mode by default; let's
  prioritize a light theme"); the first draft had two providers with two storage keys and a
  `system` default, which this decision collapses.
  Date: 2026-10-21

- Decision: Shared interface spellings are owned by the earliest plan in dependency order
  and restated verbatim downstream: the client core's signatures (EP-10) in the client and
  screen plans, the shell's module paths, link builders, formatter names, and `jumpParsers`
  (EP-8) in every screen plan, and the client packages' method and hook names (EP-11,
  EP-12) in the screens that consume them. A change is made in the owning plan first and
  cascaded in the same commit; "adapt at the import site if names differ" is no longer an
  acceptable instruction in a child plan.
  Rationale: the review round found four spellings of the format helpers, three of
  `useSurfaceQuery`, two theme providers, two Playwright directories, and five plans
  re-registering parsers the shell already owns; every one was a drift between a plan
  written against the MasterPlan's prose and the owning plan's later detail.
  Date: 2026-10-21

- Decision: Static asset serving stays outside keiro; the console is packaged as a static
  bundle with reverse-proxy recipes (Caddy and nginx) for the single-origin deployment and a
  documented CORS allowlist recipe for separate origins. A request to keiro for an optional
  static mount under `composeSurfaces` is a candidate improvement request, not a
  dependency.
  Rationale: `mori://shinzui/keiro/okf/adrs/concepts/ADR-40` condition 1 ("no bundled
  browser application"); serving a directory is the host's or a proxy's job.
  Date: 2026-10-21


Revision note (2026-10-21): after creation, the workspace tooling was switched from pnpm to
bun on the user's directive; every child plan's commands, manifests, and Nix notes were
updated in the same change, vitest and Playwright were kept, and the component library was
reconfirmed as shadcn/ui on the React Aria base (ADR-8), so no other section changed.

Revision note (2026-10-21, review round 2): before implementation started, every child
plan was re-audited against the four upstream working trees and the frontend toolchain,
and the cross-plan interfaces were reconciled. The MasterPlan's endpoint inventory, port
and origin rules, shell and client-core contracts, and keiro client specifics were
corrected as recorded in Surprises & Discoveries; the light-theme default was fixed by
decision; and every child plan now restates the owning plan's spellings (EP-10 for the
client core, EP-8 for shell paths, links, formatters, and parsers, EP-11 and EP-12 for
client methods and hooks), uses `apps/console/e2e/<section>/` for Playwright specs, and
fills the route files EP-8 creates. The decomposition, registry, and dependency graph are
unchanged.


## Outcomes & Retrospective

(To be filled during and after the initiative.)
