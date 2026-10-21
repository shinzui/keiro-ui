---
id: 12
slug: implement-the-keiro-typed-client
title: "Implement the keiro typed client"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
---

# Implement the keiro typed client

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

keiro is the event-sourcing framework and workflow engine at the top of the runtime stack
this console inspects. Its sister package `keiro-ops-http` (in the keiro repository,
`mori://shinzui/keiro`) serves the framework-level inspection surface over HTTP and
WebSocket: durable workflow instances and their journals, aggregates and their folded
state, process-manager instances and what they are waiting on, pending and stuck timers,
projection-group status against the visible store head, subscription shards, and the
operational reads over streams, snapshots, outbox, and inbox. It also exposes operator
mutations behind a preview-then-confirm protocol that is disabled by default.

This plan delivers `packages/client-keiro`, published inside the workspace as
`@keiro-ui/client-keiro`: a typed TypeScript client that every keiro-facing screen of the
console uses instead of calling `fetch` itself. After this plan, a developer can write

```typescript
import { createKeiroClient } from "@keiro-ui/client-keiro"

const keiro = createKeiroClient({ baseUrl: "/keiro" })
const page = await keiro.workflows.list({ status_class: ["running"], limit: 50 })
page.items[0]?.workflow_id // typed string
page.next_cursor           // branded WorkflowListCursor | undefined
```

and get runtime-validated, correctly typed results, with keiro's cursors, int64 positions,
error codes, schema-drift refusals, hook-gated routes, the three WebSocket feeds, and the
mutation protocol all handled once in this package. You can see it working by running the
package's contract tests against recorded fixtures (`pnpm --filter @keiro-ui/client-keiro test`)
and, with the local runtime stack up, against a live `keiro-ops-http` process
(`KEIRO_UI_LIVE=1 pnpm --filter @keiro-ui/client-keiro test`), where the workflows feed is
shown to reconcile exactly with the paged list read.

No screen is built here. The mutation wrappers are implemented and unit-tested but remain
unused by any screen until `docs/plans/19-add-gated-operator-actions.md`, because the
console's first release is read-only.


## Progress

- [ ] M1 — Package skeleton, `health`, and the `workflows` namespace: `createKeiroClient`
  builds routes per the command-tree rule, `health.get()` and all six `workflows` reads
  return zod-validated values against `packages/testing/fixtures/keiro/*`, cursors are
  branded per read kind, and `cursor_generation_mismatch`, `schema_drift`, `inspection_busy`,
  and the too-large codes are exposed as typed helpers. Acceptance: `pnpm --filter @keiro-ui/client-keiro test`
  passes the M1 suite.
- [ ] M2 — `timers`, `projections`, `shards`, `streams`, `outbox`, `inbox` namespaces with
  schemas validated against fixtures; `projections.position` and `projections.status`
  carry `store_position`, `visible_store_head`, and `maximum_global_position_distance`
  as `bigint` under their wire names. Acceptance: M2 suite passes; with `KEIRO_UI_LIVE=1`,
  `timers.pending()` and `projections.status()` return non-empty pages from the jitsurei
  database.
- [ ] M3 — `aggregates` and `processManagers` namespaces including hook-gated behavior:
  against a host without hooks, `aggregates.types()` rejects with `RouteUnavailable`, and
  against hand-derived fixtures every read validates. Acceptance: M3 suite passes
  including the `RouteUnavailable` test against the live hook-less host.
- [ ] M4 — Feeds: `keiroFeedDialect`, the `mergeFeedFrame` cache-merge function, and the
  hooks `useWorkflowsFeed`, `useTimersFeed`, `useProjectionGroupsFeed`; the early
  producer/consumer check (3) of the MasterPlan passes: on the live stack the `workflows`
  feed's snapshot and subsequent updates reconcile to exactly the result of
  `workflows.list` with the same filters. Acceptance: scripted-frame tests pass and the live
  reconcile test prints `reconciled: true`.
- [ ] M5 — `mutations` namespace: `preview`/`execute` implement the empty-body and
  `{"confirm":"execute"}` protocol; refusals are typed; `timers.requeue`, `timers.cancel`,
  and `pgmq.dlqRedrive` expose `.preview()`/`.execute()`; MSW tests cover the disabled gate,
  drift, invalid confirmation, and unknown outcome. Acceptance: M5 suite passes and a grep
  of `apps/console/src` finds no import of the mutations namespace.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Routes are not hand-listed as a table of URL strings; the client encodes
  keiro's command-tree rule (`mori://shinzui/keiro/okf/adrs/concepts/ADR-53`) once in
  `src/route.ts` and every namespace method is declared as command words plus a typed
  flag object. Each method still has an explicit, reviewable test asserting the exact
  request line it produces.
  Rationale: the server derives its routes from the same grammar, so a grammar-based
  encoder stays correct when keiro adds commands, and the per-method request-line tests
  keep the encoding auditable without a parallel route table that would drift.
  Date: 2026-10-21

- Decision: Hook-gated families (`aggregates`, `processManagers`) reject with a dedicated
  `RouteUnavailable` error when the server answers 400 `invalid_request` for an unknown
  command path, rather than passing through a generic `ApiError`.
  Rationale: today's runnable keiro hosts mount no hooks, so screens must distinguish "not
  mounted on this host" from a genuine bad request and say so to the operator.
  Date: 2026-10-21

- Decision: The feeds' cache-merge function (`mergeFeedFrame`) lives in this package, not
  in the screens, and is keyed by the server's documented keys.
  Rationale: three screen plans apply the same snapshot/upsert/remove rule; one tested
  implementation prevents three divergent ones.
  Date: 2026-10-21

- Decision: Mutation wrappers are limited to the three actions EP-19 will ship (`timers.requeue`,
  `timers.cancel`, `pgmq.dlqRedrive`); every other POST route is reachable only through the
  generic `mutations.preview`/`mutations.execute` and is not wrapped.
  Rationale: ADR-7 bounds the first mutations to a short, explicitly gated list; unwrapped
  routes make accidental UI exposure harder.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

### What exists in this repository

This repository is `keiro-ui`, the browser console for applications built on the keiro
runtime. The parent coordination document is
`docs/masterplans/2-build-the-keiro-runtime-console.md`; read its "Endpoint inventory",
"Client-core contracts", and "keiro client specifics" sections — this plan implements the
last of those and consumes the second. The direction for the whole console is in
`docs/architecture/ui-direction.md`, and the cross-project wire conventions every surface
follows (snake_case fields, cursor pagination with `items` plus an omitted `next_cursor` at
the end, the nested error envelope, the WebSocket frame shape) are in
`docs/architecture/inspection-api-conventions.md`.

By the time this plan starts, `docs/plans/7-scaffold-the-console-workspace-and-design-system.md`
has created the pnpm workspace (`pnpm-workspace.yaml` listing `apps/*` and `packages/*`,
TypeScript 7, vitest, oxlint, oxfmt), and `docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
has delivered `packages/client-core` (`@keiro-ui/client-core`), the hard prerequisite.
Verify both before starting:

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro-ui
ls packages/client-core/src
pnpm --filter @keiro-ui/client-core test
```

The client core exports, under `packages/client-core/src/`:

- `http.ts` — `createHttpClient({ baseUrl, fetch? })` returning `{ get, post }`; query
  objects are encoded with array values repeated as separate keys; bodies are JSON; the
  response text is parsed losslessly (see `int64.ts`).
- `errors.ts` — `ApiError { surface, status, code, message, details }`, built from the
  nested envelope `{"error": {"code", "message", "details"?}}` that keiro uses.
- `int64.ts` — the rule that JSON integers outside JavaScript's safe range are revived as
  `bigint`, and the zod helper `int64()` which normalizes a declared field to `bigint` whether
  it arrived as `number` or `bigint`.
- `pages.ts` — `Page<T, Cursor>` as `{ items: T[]; next_cursor?: Cursor }` and the
  `useInfiniteQuery` adapter that echoes cursors back untouched.
- `feed.ts` — the WebSocket core of ADR-2: `createFeedConnection({ url, dialect, onFrame, onResync })`,
  where a `Dialect` names the subscribe/unsubscribe frame builders and the frame types it
  treats as snapshot, delta, error, goodbye, and pong; it reconnects with backoff and calls
  `onResync` whenever the dialect reports overflow.
- `live.ts` — `useSurfaceQuery` (polling with the adaptive clamp and the global pause
  switch) and `useFeedSubscription(dialect, applyToCache)`, which layers a feed onto a
  TanStack Query cache entry.
- `query-keys.ts` — key factories; this plan adds the `keiro` factory.

If any of those names differ in the working tree, the client core's exports win: adapt the
imports in this package and record the difference in Surprises & Discoveries rather than
changing `packages/client-core`.

`packages/testing` (`@keiro-ui/testing`, owned by
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`, a soft
dependency) holds recorded fixtures under `packages/testing/fixtures/keiro/` and MSW
handlers. If EP-9 has not yet recorded keiro fixtures when this plan starts, create them by
hand from the encoders named below and from `docs/guides/serve-keiro-ops-over-http.md` in
the keiro repository, place them in the same directory, and mark each file's `_meta.json`
entry as `"source": "hand-derived"` so EP-9 can replace them with recordings.

### The keiro surface this client wraps

All keiro paths below are relative to the keiro repository checkout, which Mori registers
as `mori://shinzui/keiro` (on this machine `/Users/shinzui/Keikaku/bokuno/keiro`; confirm
with `mori registry show shinzui/keiro --full`). The package is `keiro-ops-http`
(`keiro-ops-http/keiro-ops-http.cabal`, version 0.21.0.0, unreleased; the keiro MasterPlan
45 records all six surfaces implemented at commit `5893c7eb`). Pin the audited commit in
this plan's Surprises & Discoveries when you start, and re-run the live tests if keiro moves.

The authoritative prose contracts are three guides in the keiro repository, cited as
project URI plus path because their artifact-level Mori URIs are pending:
`mori://shinzui/keiro` — `docs/guides/serve-keiro-ops-over-http.md` (DOC-30; route rule,
error codes, mutation protocol, position vocabulary), `docs/guides/stream-keiro-inspection-views.md`
(the WebSocket feeds), and `docs/guides/compose-runtime-inspection-surfaces.md` (prefix
mounting and CORS placement). The JSON encoders, which are the ground truth for field names,
are `keiro/src/Keiro/Workflow/Inspection.hs`, `keiro/src/Keiro/Inspection/Aggregate.hs`,
`keiro/src/Keiro/ProcessManager/Inspect.hs`, `keiro/src/Keiro/Timer/Schema.hs`, and the
command modules `keiro-ops/src/Keiro/Ops/Workflow.hs`, `Aggregate.hs`, `ProcessManager.hs`,
`Timer.hs`, `Projection.hs`, `Shard.hs`, `Stream.hs`, `Outbox.hs`, `Inbox.hs`, `Pgmq.hs`
under the same directory. The HTTP layer is `keiro-ops-http/src/Keiro/Ops/Http/Application.hs`
(dispatch, error envelope, confirmation), `keiro-ops-http/src/Keiro/Ops/Protocol.hs`
(WebSocket frames), `keiro-ops-http/src/Keiro/Ops/Views.hs` (the three feed views and
their filters), `keiro-ops-http/src/Keiro/Ops/Compose.hs` (prefix mounting), and
`keiro-ops-http/src/Keiro/Ops/Cors.hs`.

**The route rule.** keiro has no hand-written route table. `mori://shinzui/keiro/okf/adrs/concepts/ADR-53`
makes the HTTP surface a transport over the `keiro-ops` command tree: the path segments are
the command words followed by positional arguments (`/wf/inspect/journal/{NAME}/{ID}` is the
command `wf inspect journal NAME ID`), and each `snake_case` query key becomes the
`--kebab-case` flag of the same name (`?status_class=running` is `--status-class=running`).
Boolean flags accept only the literal `true` or `false`. Five query keys are reserved and
rejected with 400: `json`, `force`, `database_url`, `allow_schema_drift`, `help`. Reads are
`GET`, mutations are `POST` (the server classifies with its `isMutation` function), and the
wrong method returns 405 with an `Allow` header. A successful read returns the command's
JSON value as-is — no wrapper object. Two response headers may appear: `Keiro-Ops-Schema-Drift`
when drift was admitted by host policy, and `Keiro-Ops-Exit-Code` when the underlying
command exited non-zero. An unknown command path is a 400 `invalid_request`, not a 404; the
only 404 is the root path.

**Pagination and cursors.** Paged reads return `{ "observed_at": ..., "items": [...], "next_cursor"?: "..." }`
and take `limit` (default 100 for workflows and timers, 50 for aggregates and process
managers, maximum 500 everywhere; an out-of-range value is 400 `invalid_page_size`) and
`after`, the cursor from the previous page. Cursors are opaque unpadded base64url strings of
at most 4096 bytes, bound to one read kind and, for journals and steps, to one generation;
echoing a cursor into the wrong read returns 409 `cursor_generation_mismatch` and the client
must restart paging from the beginning. The console never inspects or constructs a cursor.

**Positions and vocabulary.** Global positions, stream versions, and the projection fields
`store_position`, `visible_store_head`, `serving_applied_position`, `candidate_rebuild_position`,
`candidate_rebuild_head`, `minimum_checkpoint_position`, and `maximum_global_position_distance`
are int64 on the wire. keiro's ADR-28 (`mori://shinzui/keiro/okf/adrs/concepts/ADR-28`)
mandates the words `store_position` and `visible_store_head`, and "global position
distance" for their difference — never "lag" or "backlog". The client passes these names
through untranslated; ADR-35 (`mori://shinzui/keiro/okf/adrs/concepts/ADR-35`) freezes the
`projection_group_status_v1` contract behind `/projection/status`.

**Errors.** Every error is the nested envelope `{"error": {"code", "message", "details"?}}`
with these codes: 400 `invalid_request` (details hold `arguments`), `invalid_confirmation`,
`invalid_page_size`, `invalid_cursor`, `invalid_aggregate_id`, `invalid_correlation_id`;
403 `mutations_disabled`; 404 `not_found` (root path only); 405 `method_not_allowed`;
409 `schema_drift` (details hold `drift`) and `cursor_generation_mismatch`; 413
`inspection_request_too_large` and `inspection_result_too_large`; 422 `command_failed`
(for example an unknown aggregate kind or a workflow that does not exist); 500
`schema_verification_failed`, `internal_error`; 503 `inspection_busy`; 504
`inspection_timeout`, `mutation_outcome_unknown`. Schema drift applies to reads too: when the
host's policy is `RefuseOnDrift` (the default), every admitted request verifies the live
schema first.

**Hook-gated families.** The `/aggregate/*`, `/pm/*`, `/rebuild/*`, `/replay-audit`,
`/wf/resume-once`, and `/timer/drain-once` command groups exist only when the host process
mounts the matching application hooks (`keiro-ops/src/Keiro/Ops.hs`, lines 146–167 at the
audited commit). The two runnable executables, `keiro-ops-http` and
`keiro-ops-http-compose-example`, use `emptyAppHooks`, so against them `/aggregate/types` is
a 400 `invalid_request`. This client maps that specific case to `RouteUnavailable`.

**Mutations.** `OpsHttpConfig.mutations` defaults to `MutationsDisabled`; the standalone
executable enables it with `--enable-mutations`. When disabled, any `POST` returns 403
`mutations_disabled` before touching the schema. When enabled, `POST <path>` with an empty
body is a **preview**: it returns 200 `{"outcome":"preview","result":...,"cli_reinvocation":"keiro-ops ... --json --force"}`
and changes nothing. `POST <path>` with a body of exactly `{"confirm":"execute"}` (at most
1 KiB) **executes** and returns `{"outcome":"executed","result":...,"exit_code"?:N}`. Any
other body is 400 `invalid_confirmation`. A mutation that hits its deadline returns 504
`mutation_outcome_unknown`, which means the caller must re-read state before retrying.
This is the server-side gate that `docs/adr/0007-read-only-first-with-owning-repository-gates.md`
requires the console to render honestly and never bypass.

**Feeds.** The WebSocket endpoint is `/ws` on the keiro surface — `/keiro/ws` on the
console's origin, because the development proxy and keiro's `composeSurfaces`
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`) both mount the surface under `/keiro`.
Three feeds exist: `workflows`, `timers`, `projection_groups`. A client sends
`{"type":"subscribe","feed":"workflows","status_class":["running"],"workflow_name":"...","limit":100}`;
the workflows feed accepts `status_class`, `workflow_name`, and `limit`; the timers feed
accepts `manager`, `correlation_id`, and `limit`; the projection_groups feed accepts `limit`
only; `limit` ranges 1..500 with default 100, and any unknown filter field is refused with
`invalid_subscription`. The server answers with `snapshot {feed, sequence, trigger, observed_at, items}`
and thereafter `update {feed, sequence, trigger, observed_at, changed, removed}`, where
`trigger` is `subscribe`, `notify`, or `timeout`; projection frames also carry
`visible_store_head`. `changed` holds full items to upsert; `removed` holds key objects —
`{workflow_name, workflow_id}`, `{timer_id}`, `{group_id}` — to delete. A feed covers only
the first page of the matching list read, so a removal means the item left that page, not
that it was deleted. `unsubscribe {feed}` is acknowledged with `unsubscribed {feed}`;
`ping` with `pong`; `goodbye` precedes a server close. Error frames are
`error {code, message, feed?}` with codes `invalid_frame`, `unknown_feed`,
`invalid_subscription`, `queue_overflow`, `read_failed`, `too_many_views`,
`inspection_busy`, `inspection_result_too_large`. There are no replay cursors
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-56`): `sequence` is per shared view and any
gap, or a `queue_overflow`, means the client must re-subscribe or re-poll; `read_failed`
keeps the last view while the server retries. Upgrade refusals arrive as HTTP JSON before
the socket opens: `origin_not_allowed` 403, `schema_drift` 409, `too_many_connections`,
`inspection_busy`, and `feed_closed` 503. Push is a hint and poll is truth
(`docs/adr/0003-push-is-a-hint-poll-is-truth.md`): the list read remains authoritative and
the feed only updates its cache.

### Relevant decisions

Local: `docs/adr/0005-no-backend-for-frontend.md` is why this is a client package and not a
server (one typed client per surface, consuming keiro's own endpoints);
`docs/adr/0003-push-is-a-hint-poll-is-truth.md` governs the feed hooks;
`docs/adr/0007-read-only-first-with-owning-repository-gates.md` governs the mutations
namespace (implemented, tested, unused until EP-19). Cross-repository:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` (keiro permits this surface as a bounded
exception to its no-UI stance and ships no browser application itself), ADR-53, ADR-56,
ADR-57, ADR-28, and ADR-35 as cited above.

### Terms

A **cursor** is an opaque string that names "the position after the last item you saw";
you echo it back as `after` and never parse it. A **feed** is a WebSocket subscription that
mirrors the first page of one list read. A **hook** is an application-provided inspector the
host process may or may not mount; the routes it backs appear or vanish accordingly.
**Schema drift** means the live database schema differs from the one the running binary
was built for. **zod** is the schema-validation library (`zod` 4) the workspace uses to
check JSON at runtime and derive TypeScript types from the same declaration.


## Plan of Work

The package lives at `packages/client-keiro` with this layout:

```text
packages/client-keiro/
  package.json            name @keiro-ui/client-keiro, exports ".", "./feeds", "./mutations"
  tsconfig.json           extends the workspace base
  src/index.ts            createKeiroClient, types, error helpers
  src/route.ts            command-word path + flag-object → request line (ADR-53)
  src/errors.ts           RouteUnavailable, CursorMismatch, typed code helpers
  src/cursors.ts          branded cursor types
  src/schemas/            one zod module per namespace, exporting schemas and types
  src/namespaces/         one module per namespace, each a factory taking the HttpClient
  src/feeds/dialect.ts    keiroFeedDialect
  src/feeds/merge.ts      mergeFeedFrame
  src/feeds/hooks.ts      useWorkflowsFeed, useTimersFeed, useProjectionGroupsFeed
  src/mutations.ts        preview / execute and the three typed wrappers
  src/query-keys.ts       keiro key factory
  test/                   vitest suites per milestone; test/live/ gated by KEIRO_UI_LIVE
```

### Milestone 1 — skeleton, health, workflows

Create the package manifest, tsconfig, and vitest config by copying the shape used by
`packages/client-core` (same TypeScript settings, `oxlint` and `oxfmt` picked up from the
root). Implement `src/route.ts`: a function `commandRoute(words: string[], positionals: string[], flags: Record<string, Flag>)`
that joins the words and URL-encoded positionals into a path, encodes each flag as a
`snake_case` query key (arrays repeated, booleans as `true`/`false`, `undefined` omitted),
and throws before sending if a key is one of the five reserved names. Implement
`src/errors.ts`: `RouteUnavailable` (constructed when an `ApiError` has status 400, code
`invalid_request`, and `details.arguments` names the first path word as unknown — read the
exact detail shape from `Application.hs` lines 142–164 and record it in a test fixture),
`CursorMismatch` (409 `cursor_generation_mismatch`), and the predicate helpers
`isMutationsDisabled`, `isSchemaDrift`, `isInspectionBusy`, `isTooLarge` (413 either code)
over `ApiError`. Implement `src/cursors.ts` with a branded string per read kind:
`WorkflowListCursor`, `JournalCursor`, `StepsCursor`, `ChildrenCursor`, `AwakeablesCursor`,
`AggregateListCursor`, `ProcessManagerListCursor`, `TimerCursor`, `ProjectionStatusCursor`.

Write `src/schemas/health.ts` and `src/schemas/workflows.ts` with zod 4. Status classes
are the enum `running | retrying | sleeping | awaiting | completed | cancelled | failed`.
The instance schema declares exactly the fields listed in the MasterPlan inventory;
`global_position` and `stream_version` on journal entries use `int64()` from the client
core; timestamps are ISO-8601 strings validated with `z.iso.datetime()`; `payload`,
`result`, and `last_error` are `z.unknown()` (they are application data). Every object
schema uses `.passthrough()` so unknown fields added later by keiro never break validation.

Implement `src/namespaces/health.ts` and `src/namespaces/workflows.ts` as factories taking
the `HttpClient`. `health.get()` must treat 503 bodies `{"status":"schema_drift"|"unavailable",...}`
as a successful typed result (they are the health answer, not a transport failure) while
letting other errors throw. `workflows.list`, `header`, `journal`, `steps`, `children`,
`awakeables` take the parameters named in the MasterPlan; `journal` and `steps` pages carry
`generation`. Assemble `createKeiroClient({ baseUrl, fetch? })` in `src/index.ts`, and add
the `keiro` key factory to `src/query-keys.ts` (keys of the form
`["keiro", "workflows", "list", filters]`).

Acceptance: a vitest suite in `test/workflows.test.ts` that (a) asserts the request line for
each method against an in-memory fetch (for example `GET /keiro/wf/inspect/list?status_class=running&status_class=retrying&limit=50`),
(b) validates every fixture under `packages/testing/fixtures/keiro/wf-*.json` through the
schemas, (c) shows a `>2^53` `global_position` in a journal fixture round-tripping as the
exact `bigint`, and (d) maps a recorded 409 body to `CursorMismatch`.

### Milestone 2 — timers, projections, shards, streams, outbox, inbox

Add schemas and namespaces for `timers.pending({manager?, correlation?, after?, limit?})`,
`timers.stuck({min_age?, min_attempts?})` (which returns a bare JSON array of timer records
with no `observed_at` envelope and no `due_in_seconds`, per `keiro-ops/src/Keiro/Ops/Timer.hs`),
`projections.status({limit?, after?})`,
`projections.position({subscription})`, `shards.list()`, `shards.status({subscription})`,
`streams.show(stream, {from?, limit?})`, `streams.causation(eventId)`,
`streams.subscriptions()`, `outbox.backlog()`, `outbox.list({source?, status?, destination?, limit?})`,
`outbox.show(id)`, `outbox.deadLetters({dispatcher?})`, `inbox.backlog()`, `inbox.list()`,
`inbox.show(source, msg)`. Take the exact field names from the encoders named in Context
and Orientation; where the MasterPlan inventory lists fields (timers, projection status,
projection position, shards) use those names verbatim. Declare every position-like field
with `int64()`. `timers.pending` items carry `due_in_seconds` as a number and `payload` as
unknown. For the outbox, inbox, and stream reads whose field lists the inventory does not
enumerate, read the corresponding `keiro-ops/src/Keiro/Ops/*.hs` module, write the schema
with `.passthrough()`, and record the observed fields in a short note in this plan's
Surprises & Discoveries if they differ from what the guides say.

Acceptance: `test/reads.test.ts` validates each namespace against fixtures and asserts
request lines; with `KEIRO_UI_LIVE=1`, `test/live/reads.live.test.ts` calls
`timers.pending()`, `projections.status()`, and `shards.list()` against
`http://127.0.0.1:9093` (the port the MasterPlan fixes for `keiro-ops-http`) and expects
non-empty `items` from the jitsurei seed.

### Milestone 3 — aggregates and process managers

Add `aggregates.types()`, `aggregates.list({name, limit?, after?})`, `aggregates.show({name, id})`,
`aggregates.snapshot({name, id})`, `processManagers.list({name, limit?, after?})`, and
`processManagers.show({name, correlation, timer_limit?})` with the fields enumerated in the
MasterPlan inventory. `aggregates.show` returns `hydration.source` as the enum
`snapshot | full_replay`; `processManagers.show` resolves to `null` when the server returns
JSON `null`. Both namespaces wrap every call so that the hook-less 400 becomes
`RouteUnavailable`; export `isRouteUnavailable(error)`.

Fixtures for these routes cannot be recorded from a runnable host today (see the
MasterPlan's Surprises & Discoveries). Derive them by hand from
`keiro/src/Keiro/Inspection/Aggregate.hs` lines 335–415 and
`keiro/src/Keiro/ProcessManager/Inspect.hs` lines 275–345 and from the seed in
`keiro-ops-http/test/Main.hs` (`seedInspection`), and mark them `hand-derived` in
`packages/testing/fixtures/keiro/_meta.json`. If EP-9 has meanwhile obtained a host that
mounts the jitsurei inspectors, record real fixtures instead and delete the hand-derived
ones.

Acceptance: `test/aggregates.test.ts` and `test/process-managers.test.ts` validate the
fixtures and request lines, and `test/live/hooks.live.test.ts` (gated by `KEIRO_UI_LIVE=1`)
calls `aggregates.types()` against the hook-less live host and expects
`isRouteUnavailable` to be true.

### Milestone 4 — feeds

Implement `src/feeds/dialect.ts` as a `Dialect` for the client core: subscribe builder
`({feed, ...filters}) => ({type: "subscribe", feed, ...filters})`, unsubscribe builder,
frame types `snapshot`, `update` (delta), `unsubscribed`, `pong`, `error`, `goodbye`, and
`overflowCodes: ["queue_overflow"]`. Validate incoming frames with zod schemas in
`src/schemas/feeds.ts` (items reuse the list schemas from M1 and M2). Implement
`src/feeds/merge.ts`: `mergeFeedFrame(current, frame, keyOf)` where a `snapshot` replaces
the list, an `update` upserts each `changed` item by key and deletes each `removed` key,
and the function also tracks `sequence` and returns `{ items, sequence, resync: boolean }`
with `resync` true when `frame.sequence !== previous + 1`. Keys are
`workflow_name + "/" + workflow_id`, `timer_id`, and `group_id`.

Implement the hooks in `src/feeds/hooks.ts` on top of the client core's
`useFeedSubscription`: `useWorkflowsFeed(filters, options?)` — `options` is
`{enabled?: boolean; onResync?: () => void}` and the same shape applies to the other two
hooks — applies merged items to the cache entry for `keiroKeys.workflows.list(filters)` and triggers a refetch of that query on `resync` or on
the dialect's overflow callback; `useTimersFeed(filters)` and `useProjectionGroupsFeed()`
do the same for `timers.pending` and `projections.status`, the latter also storing
`visible_store_head`. Because a feed mirrors only the first page, the hooks only touch the
first page of an infinite query. `read_failed` is surfaced as a non-fatal status flag the
screens can show, not as an exception.

The early producer/consumer check (3) of the MasterPlan is this milestone's live
acceptance: `test/live/workflows-feed.live.test.ts` connects to `ws://127.0.0.1:9093/ws`,
subscribes to `workflows` with `limit: 100`, waits for the snapshot, fetches
`workflows.list({ limit: 100 })`, and asserts the merged feed state equals the list page
(same ids in the same order); then it triggers change (by running one of keiro's jitsurei
scenarios, `just jitsurei-workflow` in the keiro repository, while the test waits up to
30 seconds), collects updates, and asserts the merged state again equals a fresh list read.
Print `reconciled: true` on success. Only after this passes are the timers and
projection_groups hooks wired to real queries.

Acceptance: scripted-frame tests in `test/feeds.test.ts` using
`packages/testing/src/feeds/keiro.ts` cover snapshot, upsert, removal, sequence gap, and
`queue_overflow`; the live reconcile test passes with `KEIRO_UI_LIVE=1`.

### Milestone 5 — mutations

Implement `src/mutations.ts`: `preview(words, positionals, flags)` sends `POST` with no body
and validates `{outcome: "preview", result, cli_reinvocation}`; `execute(...)` sends the
exact body `{"confirm":"execute"}` with `Content-Type: application/json` and validates
`{outcome: "executed", result, exit_code?}`. Map refusals to typed errors: `MutationsDisabled`
(403), `SchemaDrift` (409, carrying `details.drift`), `InvalidConfirmation` (400),
`MutationOutcomeUnknown` (504, with a message telling the caller to re-read state before
retrying). Add the three wrappers, each returning `{ preview(): Promise<Preview>, execute(): Promise<Executed> }`:
`timers.requeue(timerId)` over `/timer/requeue/{TIMER_ID}`, `timers.cancel(timerId)` over
`/timer/cancel/{TIMER_ID}`, and `pgmq.dlqRedrive({queue})` over `/pgmq/dlq/redrive?queue=`.
Export them from the `./mutations` entry point only, so a screen must opt in explicitly.

Acceptance: `test/mutations.test.ts` with MSW handlers asserts the empty preview body, the
exact confirm body, each refusal mapping, and that `execute` never runs when `preview`
threw; plus a guard test in `apps/console` is not this plan's job, but this plan's
acceptance includes running `grep -r "client-keiro/mutations" apps/console/src` and
seeing no output.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui`.

Scaffold the package:

```bash
mkdir -p packages/client-keiro/src/{schemas,namespaces,feeds} packages/client-keiro/test/live
cp packages/client-core/tsconfig.json packages/client-keiro/tsconfig.json
cp packages/client-core/vitest.config.ts packages/client-keiro/vitest.config.ts
```

Write `packages/client-keiro/package.json`:

```json
{
  "name": "@keiro-ui/client-keiro",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./feeds": "./src/feeds/hooks.ts",
    "./mutations": "./src/mutations.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@keiro-ui/client-core": "workspace:*",
    "@tanstack/react-query": "^5.104.5",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@keiro-ui/testing": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.3.0"
  }
}
```

Install and confirm the empty package type-checks:

```bash
pnpm install
pnpm --filter @keiro-ui/client-keiro typecheck
```

Expected: `pnpm install` reports the new workspace package and `typecheck` exits 0 with no
output.

Run the unit suites as each milestone lands:

```bash
pnpm --filter @keiro-ui/client-keiro test
```

Expected (after M5):

```text
 ✓ test/workflows.test.ts (…)
 ✓ test/reads.test.ts (…)
 ✓ test/aggregates.test.ts (…)
 ✓ test/process-managers.test.ts (…)
 ✓ test/feeds.test.ts (…)
 ✓ test/mutations.test.ts (…)
 Test Files  6 passed (6)
```

Run the live suites with the local stack from EP-9 up (keiro-ops-http on port 9093 against
the jitsurei database; see `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
for `just stack-up`):

```bash
just stack-up
KEIRO_UI_LIVE=1 pnpm --filter @keiro-ui/client-keiro test
```

Expected additional lines:

```text
 ✓ test/live/reads.live.test.ts (…)
 ✓ test/live/hooks.live.test.ts (…)
 ✓ test/live/workflows-feed.live.test.ts (…)
   stdout | reconciled: true
```

Without `KEIRO_UI_LIVE=1` the `test/live/` files must be skipped (use `describe.skipIf`),
not failed.

Request-line tests use an in-memory `fetch` passed through `createKeiroClient({ baseUrl: "/keiro", fetch })`
that records `input` and `init` and replies with a fixture; for example the list call above
must record exactly `GET /keiro/wf/inspect/list?status_class=running&status_class=retrying&limit=50`.


## Validation and Acceptance

The plan is accepted when all of the following hold.

The unit suites pass with `pnpm --filter @keiro-ui/client-keiro test`, and the package
type-checks and lints under the root `pnpm check`.

Every read namespace produces the documented request line, validates the recorded or
hand-derived fixture for its route, and returns `bigint` for every field declared `int64()`,
demonstrated by a journal entry whose `global_position` is `9007199254740993` surviving
parse and validation as `9007199254740993n`.

Against the live hook-less host, `aggregates.types()` rejects with an error for which
`isRouteUnavailable` returns true, and `health.get()` resolves (not rejects) with
`mutations_enabled: false` when the server runs without `--enable-mutations`.

The workflows feed reconcile check prints `reconciled: true` on the live stack, proving the
cache-merge rule matches the server's list read before the other two feeds are relied on.

Mutation tests show that `preview` sends no body, `execute` sends exactly
`{"confirm":"execute"}`, a 403 maps to `MutationsDisabled`, a 409 to `SchemaDrift` with the
drift details attached, a 400 to `InvalidConfirmation`, and a 504 to
`MutationOutcomeUnknown`; and `grep -r "client-keiro/mutations" apps/console/src` prints
nothing.

Proposed, not required: a generated reference page listing every namespace method with
its request line, produced from the request-line tests, for the screen plans to consult.


## Idempotence and Recovery

Every step is additive inside `packages/client-keiro`; re-running scaffolding commands
over an existing package is harmless (`mkdir -p`, `cp` over identical files). `pnpm install`
is idempotent. Live tests only read from the stack except the feed reconcile test, which
invokes a jitsurei scenario that appends to the seed database; re-running it appends more
rows but never breaks subsequent runs. If keiro's working tree moves and a fixture no longer
validates, re-record with EP-9's recorder (`pnpm fixtures:record keiro`) or regenerate the
hand-derived fixture from the encoder, note the new commit in Surprises & Discoveries, and
re-run the suites. Nothing in this plan touches `packages/client-core`; if a core export is
missing, add a note here and request the addition from EP-10 rather than patching the core
from this package.


## Interfaces and Dependencies

Libraries whose choice matters: `zod` 4 (schemas and derived types; `.passthrough()` on every
object), `@tanstack/react-query` 5 (cache entries the feed hooks update),
`@keiro-ui/client-core` (`createHttpClient`, `ApiError`, `int64`, `Page`,
`createFeedConnection`, `Dialect`, `useSurfaceQuery`, `useFeedSubscription`),
`@keiro-ui/testing` (fixtures, MSW node server, scripted feeds) for tests only. No other
runtime dependency is permitted in this package.

Interfaces this package exports, by module path, that other plans depend on:

- `packages/client-keiro/src/index.ts`: `createKeiroClient({ baseUrl: string; fetch?: typeof fetch }): KeiroClient`,
  where `KeiroClient` has the namespaces `health`, `workflows`, `aggregates`,
  `processManagers`, `timers`, `projections`, `shards`, `streams`, `outbox`, `inbox`;
  the branded cursor types; `RouteUnavailable`, `CursorMismatch`; `isRouteUnavailable`,
  `isCursorMismatch`, `isMutationsDisabled`, `isSchemaDrift`, `isInspectionBusy`,
  `isTooLarge`; and every zod schema and inferred type (`WorkflowInstance`,
  `JournalEntry`, `TimerItem`, `ProjectionGroupStatus`, `AggregateSummary`,
  `AggregateDetail`, `ProcessManagerDetail`, and so on). `docs/plans/15-build-the-workflows-screens.md`,
  `docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md`, and
  `docs/plans/17-build-the-projections-and-overview-screens.md` consume these.
- `packages/client-keiro/src/provider.tsx`: `KeiroClientProvider({ client, children })` and
  `useKeiroClient()`, the same per-package context pattern the lower-layer clients use, so
  the package never imports from `apps/console`; the app composes the client from the active
  connection profile in `apps/console/src/routes/__root.tsx`.
- `packages/client-keiro/src/query-keys.ts`: `keiroKeys`, the keiro key factory built on the
  client core's `surfaceKey("keiro", ...)` — `keiroKeys.workflows.list(filters)`,
  `keiroKeys.workflows.journal(name, id, query)`, `keiroKeys.timers.pending(filters)`,
  `keiroKeys.projections.status()`, and so on — so screens and feed hooks address the same
  cache entries.
- `packages/client-keiro/src/feeds/hooks.ts` (`@keiro-ui/client-keiro/feeds`):
  `useWorkflowsFeed(filters, options?)`, `useTimersFeed(filters, options?)`,
  `useProjectionGroupsFeed(options?)` with `options` `{enabled?, onResync?}`, each
  returning `{ status: "live" | "reconnecting" | "read_failed" | "off" }`; and
  `packages/client-keiro/src/feeds/merge.ts`: `mergeFeedFrame`.
- `packages/client-keiro/src/mutations.ts` (`@keiro-ui/client-keiro/mutations`):
  `preview`, `execute`, `timers.requeue`, `timers.cancel`, `pgmq.dlqRedrive`, and the
  refusal classes `MutationsDisabled`, `SchemaDrift`, `InvalidConfirmation`,
  `MutationOutcomeUnknown`. Consumed only by `docs/plans/19-add-gated-operator-actions.md`.

Prerequisites declared by the parent: this plan starts only after
`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
is Complete (hard dependency, whole child). `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
is a soft dependency: its recorded keiro fixtures and the `just stack-up` recipe make the
live suites runnable; without it, use hand-derived fixtures and skip the live suites. The
services involved are `keiro-ops-http` on `127.0.0.1:9093` (HTTP and `/ws`) as fixed in the
MasterPlan's port table, reached in the browser as `/keiro` and `/keiro/ws` through the
Vite proxy or the composed mount.
