---
id: 2
slug: audit-kiroku-and-file-ui-endpoint-improvement-requests
title: "Audit kiroku and file UI endpoint improvement requests"
kind: exec-plan
created_at: 2026-08-20T03:01:41Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Audit kiroku and file UI endpoint improvement requests

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime UI initiative (see docs/masterplans/1-keiro-runtime-ui-foundations.md in this repository) is preparing a React web UI that lets an operator inspect a running event-sourced system: streams, events, subscriptions, queues, workflows, projections, and more. A core principle of that initiative is that **every HTTP or WebSocket endpoint lives in the project that owns the concept it exposes**, because each runtime library is usable without keiro and may grow its own UI.

kiroku is the stack's PostgreSQL event store. It already ships a real HTTP + WebSocket server (the `kiroku-metrics` package), but that server was built for metrics and live tailing, not for browsing: there is no way to list streams, enumerate categories, fetch an event by id, read dead letters, or see durable cross-process subscription checkpoints over HTTP — and a browser on another origin cannot call it at all because the server sends no CORS headers.

After this plan is complete, kiroku's own `docs/improvement-requests/` bundle contains a set of validated OKF Improvement Requests — filed from this initiative, with `origin: mori://shinzui/keiro-ui` — that precisely specify the endpoints and the missing library-level read primitives the UI needs from kiroku. Success is observable: each request file passes kiroku's own `okf validate` run, appears in the bundle's `index.md` and `log.md`, and its allocated `IR-N` handle is recorded back into this plan and the MasterPlan. This plan **files requests only**; implementing them is kiroku's own downstream work, done by kiroku's maintainers under kiroku's plans.


## Progress

- [x] Milestone 1: Audit re-confirmed against the current kiroku working tree; gap list finalized in this plan. (2026-08-19: tree is at exactly the audited commit c2d0328 and clean, so the gap list holds verbatim — no CORS hits, no listStreams/listCategories/eventById in Read.hs or SQL.hs, dead-letter reads still SQL-module-only with no Store-effect read op, bundle still IR-1..IR-7 with `okf id next` reporting IR-8, no new wire-format ADR among 0001–0007.)
- [x] Milestone 2: All six request documents drafted locally and reviewed against the pinned profile's frontmatter contract. (2026-08-19: drafted directly in the bundle, one at a time, each `requestId` filled from `okf id next` immediately before writing; frontmatter imitates IR-7, the newest record, with `generated.by: anthropic/claude-fable-5`.)
- [x] Milestone 3: IDs allocated with `okf id next`, files placed in the bundle, `index.md` and `log.md` updated, `okf validate` and `mori validate` passing, changes committed in the kiroku repository, allocated handles recorded back here and in the MasterPlan. (2026-08-19: kiroku commit `8f03c19`; `okf validate --profile-enforce --log-enforce` reports "OK: 13 concepts"; `okf id list` shows IR-1..IR-13 contiguous.)

Allocated handles (kiroku bundle, all `status: proposed`, `origin: mori://shinzui/keiro-ui`):

- IR-8 — Expose a REST read API for browsing streams, categories, and events (`expose-a-rest-read-api-for-browsing-streams-categories-and-events.md`)
- IR-9 — Expose a public dead-letter read API (`expose-a-public-dead-letter-read-api.md`)
- IR-10 — Serve durable subscription checkpoints over HTTP (`serve-durable-subscription-checkpoints-over-http.md`)
- IR-11 — Add configurable CORS support to kiroku-metrics (`add-configurable-cors-support-to-kiroku-metrics.md`)
- IR-12 — Converge the WebSocket protocol with the cross-project convention (`converge-the-websocket-protocol-with-the-cross-project-convention.md`)
- IR-13 — Record HTTP and WebSocket wire-format stability in an ADR (`record-http-and-websocket-wire-format-stability-in-an-adr.md`)

Canonical handles for cross-repo citation: `mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-8` through `IR-13`.


## Surprises & Discoveries

- Milestone 1 (2026-08-19): kiroku's working tree is at exactly the audit commit `c2d0328` with a clean status, so re-verification confirmed the gap list without corrections. Two useful refinements surfaced: kiroku IR-2 ("Expose a durable subscription checkpoint inventory") is `completed` — `subscriptionCheckpointInventory` shipped in kiroku-store 0.4.0.0 — so the durable-checkpoints-over-HTTP request cites `mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-2` as the shipped library precursor rather than asking for any library work; and the only `Store`-effect touch of dead letters is an internal delete (`deleteDeadLettersForOrphanedEventsStmt` in `Effect.hs`), confirming the read gap precisely.
- EP-1 completed before this plan ran, so the filed requests cite the keiro-ui ADRs by their real handles (`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-1`..`ADR-4`) and the conventions document as `mori://shinzui/keiro-ui` + `docs/architecture/inspection-api-conventions.md` (artifact-level URI pending); the "if EP-1 has not completed" fallback in Context and Orientation was not needed.
- Filing time (2026-08-19): `mori validate` in kiroku passes but emits a pre-existing warning — kiroku's `mori.dhall` records a schema hash (`sha256:d29ca032…`) that differs from the binary's embedded schema hash (`sha256:f33943bf…`); mori ignores it but external Dhall tooling would reject the import. Not caused by, and not fixed under, this plan; kiroku can repair it with `mori schema upgrade`. Also, kiroku runs a `treefmt` pre-commit hook, which passed unchanged on the six new files.


## Decision Log

- Decision: File six focused requests (REST read API; dead-letter read API; durable checkpoint state over HTTP; CORS; additive WebSocket convergence; a wire-format/endpoint-ownership ADR) rather than one omnibus "UI endpoints" request.
  Rationale: kiroku's existing requests are one-capability-per-concept and its maintainers accept, reject, and implement them independently; an omnibus request would force all-or-nothing acceptance.
  Date: 2026-08-19

- Decision: The stream-browsing request references kiroku's existing IR-1 ("Expose bounded fan-in replay windows", still `proposed`) by canonical handle instead of restating its content.
  Rationale: Bounded replay windows are already requested by keiro; duplicating them from keiro-ui would create two competing requests for one capability.
  Date: 2026-08-19

- Decision: Author frontmatter against kiroku's pinned improvement-request profile (okf-profiles v0.5.0 via `mori/improvement-requests-profile.dhall`), imitating the newest existing record, and do not upgrade the pin.
  Rationale: MasterPlan decision — pins are per-repository maintenance with their own blast radius; validation runs against the pinned descriptor, not against the latest okf-profiles release.
  Date: 2026-08-19

- Decision: Every filed request carries `origin: mori://shinzui/keiro-ui`.
  Rationale: The profile requires `origin` to be the Mori URI of the project raising the request; this initiative is raised by keiro-ui, not by keiro.
  Date: 2026-08-19

- Decision: The durable-checkpoints request (IR-10) asks only for the HTTP surface and cites completed kiroku IR-2 as the shipped library precursor, requesting no library work.
  Rationale: Milestone 1 found IR-2 `completed` (`subscriptionCheckpointInventory` public since kiroku-store 0.4.0.0); restating a shipped capability would duplicate a closed request.
  Date: 2026-08-19

- Decision: `generated.by` is `anthropic/claude-fable-5` on all six requests, and drafts were written directly into the bundle (IDs allocated one at a time before each write) rather than staged in a scratch directory.
  Rationale: The actor follows the profile's `<producer>/<version>` form, imitating IR-7's `anthropic/claude-opus-5`; direct placement with sequential allocation is exactly what the allocator (max+1 of on-disk records) is designed for, and validation runs only at the end of filing.
  Date: 2026-08-19


## Outcomes & Retrospective

Completed 2026-08-19, all three milestones in one session. Six improvement requests filed in kiroku's bundle as IR-8..IR-13 (kiroku commit `8f03c19`), all `proposed` with `origin: mori://shinzui/keiro-ui`: the browsing REST read API (IR-8, including the missing kiroku-store primitives and the ADR-1 name-resolution constraint), public dead-letter reads (IR-9), durable checkpoints over HTTP (IR-10, HTTP-only thanks to completed IR-2), configurable CORS (IR-11), additive WebSocket convergence (IR-12), and the wire-format stability ADR (IR-13). Bundle validation (`--profile-enforce --log-enforce`) and `mori validate` pass; index and log are updated; handles are contiguous after IR-7 with no duplicates.

The audit re-confirmation was trivial because kiroku's tree sat at exactly the audited commit — but it still paid for itself: it surfaced IR-2's `completed` status, which reshaped IR-10 from "add an inventory and serve it" to "serve the shipped inventory", a materially smaller and more acceptable request.

Nothing here changed keiro-ui's durable context — the requests are kiroku artifacts and the boundary decisions they cite were already recorded as keiro-ui ADR-1..ADR-4 under EP-1 — so no new ADR was created in this repository. For EP-5's composition/non-duplication work: the kiroku handle set to cite is `mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-8`..`IR-13`.


## Context and Orientation

### The two repositories involved

This plan file lives in **keiro-ui** (`/Users/shinzui/Keikaku/bokuno/keiro-ui`), the coordination repository for the UI initiative. The work it directs happens in **kiroku** (`/Users/shinzui/Keikaku/bokuno/kiroku-project/kiroku`), a separate git repository. You will edit files and run commands in the kiroku checkout, then come back and update this plan.

kiroku (記録, "record") is an experimental append-only event store on PostgreSQL, written in Haskell (GHC 9.12, `hasql` + `effectful`). Events are immutable rows; stream membership is a junction table; a special `$all` stream provides total global ordering. It is a multi-package cabal project; the packages that matter here:

- `kiroku-store/` — the core library (`Kiroku.Store.*`). Deliberately has **no web dependency**.
- `kiroku-metrics/` — **the entire HTTP + WebSocket surface** (`Kiroku.Metrics.*`), a sister package depending on `kiroku-store` and `kiroku-cli`. Warp/WAI + `wai-websockets` + hand-rolled routing (no servant anywhere in the repo). Default port 9091.
- `kiroku-cli/` — embeddable operator CLI; shares the `/subscriptions` wire codec (`SubscriptionStatusRow` in `kiroku-cli/src/Kiroku/Cli/Subscription/Status.hs`).
- `kiroku-store-migrations/` — owns all DDL; tables live in a dedicated `kiroku` schema.
- `kiroku-otel/`, `shibuya-kiroku-adapter/`, `kiroku-jitsurei/`, `kiroku-test-support/` — tracing, Shibuya integration, examples, test harness; not touched by this plan.

The sister-package precedent is stated in `kiroku-metrics/kiroku-metrics.cabal` ("the core library never depends on a web framework") and in `docs/masterplans/5-metrics-and-event-streaming-http-endpoint-package.md` — this is exactly the endpoint-ownership principle of the UI initiative, already in place.

### What kiroku-metrics serves today

HTTP routes (router at `kiroku-metrics/src/Kiroku/Metrics/Server.hs`, roughly lines 174–215; documented in `docs/user/metrics.md`):

- `GET /metrics` — full metrics snapshot as JSON; `GET /metrics/<subscription>` — one subscription; `GET /metrics/prometheus` — Prometheus text.
- `GET /health`, `GET /health/live`, `GET /health/ready` — health with 200/503 verdicts (`readinessMaxLag` default 10000).
- `GET /subscriptions` and `GET /subscriptions/<name>` — the **in-process** live subscription registry of whichever worker you hit; 404 `{"error":"subscription status not configured"}` when no provider is wired.

WebSocket paths (`kiroku-metrics/src/Kiroku/Metrics/WebSocket.hs`, `dispatchPath`):

- `ws://…/ws/metrics` — snapshot on connect, then periodic snapshots (`wsPushIntervalUs`, default 1 s).
- `ws://…/ws/events` — a live, replayable event tail. Client frames: `{"type":"ping"}`, `{"type":"subscribe_metrics"}`, `{"type":"subscribe_events","from_position":N,"category":"orders"}`, `{"type":"unsubscribe_events"}`. Server frames: `pong`, `snapshot`, `event`, `event_stream_started`, `goodbye`, `error`. Backpressure is DropOldest bounded by `wsEventQueueCap` (default 256) with an `error` frame on overflow; transient watchers create **no** durable subscription row.

The event wire shape (`recordedEventToJSON`): envelope keys are snake_case, event fields are camelCase (`eventId`, `eventType`, `streamVersion`, `globalPosition`, `originalStreamId`, `originalVersion`, `payload`, `metadata`, `causationId`, `correlationId`, `createdAt`). `originalStreamId` is a **number** (a surrogate id), not a stream name — see ADR-1 below.

Configuration: `kiroku-metrics/src/Kiroku/Metrics/Config.hs` (`port` 9091, `enableJSON`, `enablePrometheus`, `enableWebSocket`, `wsPushIntervalUs`, `wsMaxConnections` 100, `wsEventQueueCap` 256, `readinessMaxLag`, `livenessTimeoutUs`).

### The library read surface the endpoints would wrap

All in `kiroku-store/src/Kiroku/Store/Read.hs` (effectful operations in the `Store` effect, run via `runStoreIO`): `readStreamForward`, `readStreamForwardStream` (constant-memory Streamly paging), `readStreamBackward`, `readAllForward`, `readAllBackward`, `visibleGlobalHeadPosition`, `readCategory`, `getStream`, `lookupStreamId`, `eventExistsInStream`, `lookupStreamNames` (batch surrogate-id → name resolver), `lookupStreamName`. Causation/correlation graph queries live in `kiroku-store/src/Kiroku/Store/Causation.hs` (`findCausationDescendants`, `findCausationAncestors`, `findByCorrelation`). Subscription state: `subscriptionStates` (live in-process registry, `Kiroku/Store/Subscription.hs`) and `subscriptionCheckpointInventory` (durable, cross-process snapshot including `storePosition`).

Persisted state (schema `kiroku`, column-by-column reference in `docs/user/schema.md`): `streams` (including `$all` at `stream_id = 0`, generated `category` column, `deleted_at`, `truncate_before`), `events` (immutable payloads), `stream_events` (junction; the `$all` row's `stream_version` is the global position), `subscriptions` (durable checkpoints), `dead_letters`, `history_retention_leases`, `history_retention_coordinator`, and the **frozen public view** `kiroku.subscription_checkpoints_v1`.

Live updates: appends fire `pg_notify` on channel `<schema>.events` (trigger `kiroku.notify_events()`); the payload is a wake-up hint only (`stream_name,stream_id,stream_version`), never event data. Architecture in `docs/architecture/notifier.md`. Any live endpoint treats NOTIFY as a hint and keeps a polling fallback — this is a shared constraint across the whole initiative.

### The verified gap list (audited 2026-08-19, kiroku commit c2d0328)

1. **No REST read API.** No `GET /streams`, `GET /streams/<name>/events`, `GET /categories`, `GET /events`, `GET /events/<id>`. Explicitly deferred in `docs/masterplans/5-metrics-and-event-streaming-http-endpoint-package.md` (out-of-scope list): a paginated pull API is "a separable follow-up noted in the Decision Log".
2. **Missing library primitives beneath such an API.** There is no `listStreams` (list/search/page over `kiroku.streams`), no category enumeration (the generated `streams.category` column and its index exist, but no API surfaces distinct categories), and no fetch-event-by-id (`eventExistsInStream` checks existence only). Verified absent from `kiroku-store/src/Kiroku/Store/SQL.hs`.
3. **No public dead-letter read API.** `readDeadLettersStmt` and `DeadLetterRecord` exist in `kiroku-store/src/Kiroku/Store/SQL.hs` (around lines 1303–1357) but are used only from tests; no `Store` effect constructor exports them, and no HTTP route serves them.
4. **Durable subscription state is not served.** `GET /subscriptions` reads the in-process registry only — it cannot see another process's subscriptions, and stopped subscriptions vanish. The durable sources (`subscriptionCheckpointInventory`, the frozen `subscription_checkpoints_v1` view) have no HTTP surface.
5. **No CORS** (and no auth/TLS — out of scope to fix, in scope to note). Zero hits for CORS anywhere in `kiroku-metrics`; a browser app on another origin is blocked today.
6. **No ADR covers the HTTP/WS surface.** kiroku's `docs/adr/` has seven ADRs; none records wire-format stability or endpoint ownership — that rationale lives only in masterplan Decision Logs.

### Relevant ADRs

Local to this repository (keiro-ui): none exist — `docs/adr/` is created by EP-1 (docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md). Cross-repository, cited by canonical Mori handle (verified via `mori registry concepts`):

- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` — stream names are resolved via the on-demand batch lookup (`lookupStreamNames`), never carried on `RecordedEvent`. Any browsing endpoint returning fan-in events must resolve names server-side (or document that clients must) — the requests below must respect this.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-3` — all kiroku objects live in a dedicated schema; the schema name also scopes the LISTEN channel.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-6` — database-native integration surfaces are owner-published, frozen, versioned relations (`subscription_checkpoints_v1` is the precedent). New HTTP surfaces must not bypass this discipline by exposing private tables.

In the kiroku checkout these are `docs/adr/0001-resolve-stream-names-via-lookup-not-recordedevent-field.md`, `docs/adr/0003-dedicated-kiroku-schema.md`, and `docs/adr/0006-versioned-public-sql-relations-are-owner-published-and-frozen.md`.

### OKF, bundles, and the authoring contract

An **OKF bundle** is a directory of Markdown "concept" files with YAML frontmatter, validated by the `okf` CLI against a **profile** (a Dhall descriptor of required fields and formats). kiroku declares its bundles in `mori.dhall` under `okfBundles`; the improvement-requests bundle is at `docs/improvement-requests/` with its profile at `mori/improvement-requests-profile.dhall` (a pinned import of okf-profiles **v0.5.0**, `Profiles.coordination.improvementRequests`).

The bundle currently holds seven requests, IR-1 through IR-7 (six originated from keiro — this bundle is the established channel for "a downstream project needs kiroku to expose X"). File names are kebab-case slugs of the title (never numbered); the `IR-N` handle lives in frontmatter. Each bundle also has `index.md` (catalog), `log.md` (dated update journal), and `profile.dhall`.

Frontmatter must imitate the newest existing record, `docs/improvement-requests/order-multi-stream-append-locks-ahead-of-the-all-row.md`:

```yaml
---
type: Improvement Request
title: <title>
description: >-
  <one- to three-line summary of the requested outcome>
generated:
  by: <producer>/<version>
  at: "2026-08-19T00:00:00Z"
timestamp: "2026-08-19T00:00:00Z"
requestId: IR-<N>
status: proposed
origin: mori://shinzui/keiro-ui
---
```

`generated.by` must be a valid OKF actor: `<producer>/<version>` (for example the authoring model and version), `human:<id>` (for example `human:nadeem`), or `process:<id>`. Body sections, imitating the existing kiroku requests: a `# Improvement Request: <Title>` heading, then `## Status`, `## Context`, `## Requested Change`, `## Acceptance` (numbered, independently testable criteria), `## Requested Deliverables`. Do **not** add structured `dependencies:` or `acceptanceCriteria:` frontmatter — no released profile accepts those keys; dependency and acceptance content stays in prose. IDs are allocated read-only by the CLI (`okf id next`) and written into frontmatter by hand; never derive an ID by counting files (IR-8 is this plan's audit-time estimate only).

### Cross-repository referencing rules

Inside a filed request, refer to other repositories only by canonical Mori URIs: requests as `mori://shinzui/<project>/okf/improvement-requests/concepts/IR-N`, ADRs as `mori://shinzui/<project>/okf/adrs/concepts/ADR-N`, the MasterPlan as `mori://shinzui/keiro-ui/masterplans/1-keiro-runtime-ui-foundations`, this plan as `mori://shinzui/keiro-ui/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests`. The conventions document from EP-1 has no artifact-level URI yet; cite it as the project URI `mori://shinzui/keiro-ui` plus the repository-relative path `docs/architecture/inspection-api-conventions.md`, stating that the artifact-level URI is pending. If EP-1 has not completed when this plan runs, name the dependency in prose ("wire-format details follow the cross-project conventions being defined in …") and revisit the filed requests when EP-1 lands.


## Plan of Work

### Milestone 1 — Re-confirm the audit against the current working tree

The audit above is a snapshot (2026-08-19, commit `c2d0328`). kiroku moves quickly; before filing anything, re-verify in the kiroku checkout that each gap still holds, so no request asks for something that meanwhile shipped. Concretely: grep `kiroku-metrics/src` for CORS handling; check `kiroku-store/src/Kiroku/Store/Read.hs` and `SQL.hs` for `listStreams`/category-enumeration/event-by-id additions; check whether a `Store` effect constructor now exports dead-letter reads; list `docs/improvement-requests/` for new IRs (especially anything overlapping streams browsing or dead letters) and re-read IR-1's status; list `docs/adr/` for a new wire-format ADR. Record the verification result (and any scope change it forces) in this plan's Surprises & Discoveries and adjust the request set before proceeding. This milestone is complete when the gap list in Context and Orientation is either confirmed or corrected in place.

### Milestone 2 — Draft the six requests

Draft each request as a standalone Markdown file (work in a scratch directory or directly in the bundle — placement is finalized in Milestone 3). One request per coherent capability:

1. **Store browsing read API** (suggested slug `expose-a-rest-read-api-for-browsing-streams-categories-and-events`). Requested change: paginated JSON endpoints in `kiroku-metrics` for listing/searching streams, enumerating categories, reading a stream's events forward/backward, paging the `$all` log from a global position, and fetching a single event by id — plus the new `kiroku-store` primitives beneath them (list/search streams, distinct categories, event-by-id), since endpoints must wrap owning-library APIs rather than ad-hoc SQL. Context must state that fan-in reads carry surrogate `originalStreamId` values and that responses must resolve names via `lookupStreamNames` per ADR-1. Reference `mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-1` for bounded replay windows instead of restating that capability. Acceptance phrased as observable HTTP behavior (for example: "`GET /streams?prefix=order-&limit=50` returns a JSON page of stream summaries including name, version, created_at, deleted_at, and a cursor for the next page").
2. **Public dead-letter reads** (suggested slug `expose-a-public-dead-letter-read-api`). Requested change: a `Store`-effect read operation over `kiroku.dead_letters` (the statement and `DeadLetterRecord` already exist in `SQL.hs`, unexported) and a paginated HTTP surface for browsing dead letters by subscription, with the reason JSON intact.
3. **Durable subscription state over HTTP** (suggested slug `serve-durable-subscription-checkpoints-over-http`). Requested change: an endpoint serving `subscriptionCheckpointInventory` (durable, cross-process, includes `storePosition`) alongside the existing in-process `/subscriptions` registry, with the live-versus-durable distinction explicit in the response shape so a UI can render both truthfully. Mention `subscription_checkpoints_v1` (ADR-6) as the SQL-native equivalent the endpoint mirrors.
4. **CORS support** (suggested slug `add-configurable-cors-support-to-kiroku-metrics`). Requested change: configurable allowed origins in `MetricsConfig`, default off, applied to HTTP and WebSocket upgrade paths; without it no browser UI on another origin can consume any of the above.
5. **WebSocket convention convergence** (suggested slug `converge-the-websocket-protocol-with-the-cross-project-convention`). Requested change: additive-only alignment of the `/ws` protocol with the cross-project convention defined by EP-1 (typed frames, subscribe/unsubscribe, snapshot-then-delta, ping/pong, bounded queues with overflow signaling, replay cursors) — explicitly no breaking changes to published frames.
6. **Wire-format and endpoint-ownership ADR** (suggested slug `record-http-and-websocket-wire-format-stability-in-an-adr`). Requested change: kiroku records, in its own `docs/adr/`, the stability contract of the kiroku-metrics wire formats and the sister-package endpoint-ownership boundary, so the UI can depend on frames not changing shape silently.

Each draft carries the frontmatter block from Context and Orientation (with `requestId` left as a placeholder until Milestone 3), the body sections in the house shape, and cross-repo references only as canonical Mori URIs. This milestone is complete when all six drafts read as self-contained requests a kiroku maintainer could accept or reject without consulting this plan.

### Milestone 3 — File, validate, commit, and record handles

In the kiroku checkout: allocate IDs with `okf id next` (one at a time, writing each allocated `IR-N` into a draft's `requestId` before allocating the next — the allocator returns max+1 of what is on disk), move the files into `docs/improvement-requests/`, add each to `index.md`'s catalog list, append a dated `log.md` entry, and run the validation commands until clean. Commit in kiroku with a conventional-commit message and the cross-repo trailers shown in Concrete Steps. Then return to keiro-ui: record the allocated handles in this plan (Progress and a new Surprises & Discoveries or Decision Log entry as appropriate), update the MasterPlan's Progress checklist, and commit the plan updates in keiro-ui with repo-relative trailers.


## Concrete Steps

All kiroku commands run from `/Users/shinzui/Keikaku/bokuno/kiroku-project/kiroku`.

Milestone 1 verification (expect no hits for CORS; expect the read/SQL greps to show the absences described above):

```bash
grep -rn -i "cors" kiroku-metrics/src || echo "no CORS handling"
grep -n "listStreams\|listCategories\|eventById\|readDeadLetters" kiroku-store/src/Kiroku/Store/Read.hs kiroku-store/src/Kiroku/Store/SQL.hs
ls docs/improvement-requests/
grep -l "requestId" docs/improvement-requests/*.md | xargs grep -H "^requestId\|^status\|^title" | sort
ls docs/adr/
```

Milestone 3 filing — allocate an ID (repeat per request, filling each allocation into the draft before the next call):

```bash
okf id next docs/improvement-requests IR --profile mori/improvement-requests-profile.dhall
```

Expected output is a single handle, for example:

```text
IR-8
```

Update the bundle's log (adjust the date to the actual filing date; one entry may cover all requests):

```bash
okf log add docs/improvement-requests -m "Add UI endpoint improvement requests raised by keiro-ui (IR-8..IR-13)" --kind Addition --date 2026-08-19
```

Validate (both must pass; `--strict` is intentionally omitted because machine-authored records carry no `reviews:` provenance and fabricating it is forbidden):

```bash
okf validate docs/improvement-requests --profile mori/improvement-requests-profile.dhall --profile-enforce --log-enforce
mori validate
```

Expected: `okf validate` reports the bundle valid with zero errors (advisory notices about recommended fields are acceptable); `mori validate` exits zero. There is no `just` recipe for this bundle in kiroku's `Justfile` — run the commands directly.

Commit in kiroku (adjust the file list to reality; note the trailers are canonical Mori URIs because the plan lives in a different repository):

```bash
git add docs/improvement-requests/
git commit -m "docs(okf): add UI endpoint improvement requests from keiro-ui

Add improvement requests for a browsing read API, public dead-letter
reads, durable subscription state over HTTP, CORS support, WebSocket
convention convergence, and a wire-format stability ADR.

MasterPlan: mori://shinzui/keiro-ui/masterplans/1-keiro-runtime-ui-foundations
ExecPlan: mori://shinzui/keiro-ui/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests"
```

Back in `/Users/shinzui/Keikaku/bokuno/keiro-ui`, update this plan and the MasterPlan, then:

```bash
git add docs/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests.md docs/masterplans/1-keiro-runtime-ui-foundations.md
git commit -m "docs(plans): record kiroku improvement-request filing for EP-2

MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests.md"
```

No `Intention:` trailer is used anywhere in this initiative (the user declined intention linking).


## Validation and Acceptance

Acceptance is behavioral and lives in the kiroku repository:

1. `okf validate docs/improvement-requests --profile mori/improvement-requests-profile.dhall --profile-enforce --log-enforce` exits zero with every new request present.
2. `mori validate` exits zero in the kiroku checkout.
3. Each new request appears in `docs/improvement-requests/index.md` and in a dated `log.md` entry.
4. `okf id list docs/improvement-requests --profile mori/improvement-requests-profile.dhall` shows the new handles as contiguous allocations after the pre-existing maximum, with no duplicates.
5. Each request's `origin` is `mori://shinzui/keiro-ui`, its `status` is `proposed`, and its Acceptance section states observable behavior (an HTTP transcript a future implementer can reproduce), not internal attributes.
6. In keiro-ui, this plan's Progress section records the allocated handles and the MasterPlan's EP-2 progress items are checked.

A reviewer with no prior context should be able to open any single filed request and understand what is asked, why, and how acceptance would be demonstrated — without reading this plan.


## Idempotence and Recovery

Filing is additive and safe to retry. If validation fails mid-way, fix the reported file and re-run; nothing destructive occurs. If an ID collision is discovered (another request landed between `okf id next` and commit), re-run `okf id next`, renumber the affected drafts' `requestId` fields, and re-validate — never reuse or renumber pre-existing requests. If a request turns out to duplicate a request that already exists (Milestone 1 missed it), withdraw the draft before filing, or — if already filed — mark it `status: superseded` with `supersededBy` pointing at the surviving request, per the profile's rules. Committing in kiroku before validation passes is the one order-of-operations mistake to avoid; validate first, commit second.


## Interfaces and Dependencies

This plan produces documents, not code; the interfaces named here are what the request bodies must cite accurately.

- kiroku library surface: `Kiroku.Store.Read` (`readStreamForward`, `readAllForward`, `readCategory`, `getStream`, `visibleGlobalHeadPosition`, `lookupStreamNames`), `Kiroku.Store.Subscription` (`subscriptionStates`, `subscriptionCheckpointInventory`), `Kiroku.Store.SQL` (`readDeadLettersStmt`, `DeadLetterRecord` — currently unexported reads), all under `kiroku-store/src/`.
- kiroku HTTP/WS surface: `Kiroku.Metrics.Server`, `Kiroku.Metrics.WebSocket`, `Kiroku.Metrics.Config` under `kiroku-metrics/src/`.
- OKF tooling: the `okf` CLI (`okf id next`, `okf id list`, `okf log add`, `okf validate`) and `mori` (`mori validate`, `mori registry concepts`), both available on PATH in this environment.
- Coordination artifacts: docs/masterplans/1-keiro-runtime-ui-foundations.md (this repository) and, as a soft dependency, EP-1's conventions document `docs/architecture/inspection-api-conventions.md` (cite as `mori://shinzui/keiro-ui` + path, artifact-level URI pending).
- Cross-repository handles this plan cites: `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1`, `mori://shinzui/kiroku/okf/adrs/concepts/ADR-3`, `mori://shinzui/kiroku/okf/adrs/concepts/ADR-6`, `mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-1`.
