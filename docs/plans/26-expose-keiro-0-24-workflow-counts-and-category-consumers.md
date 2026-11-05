---
id: 26
slug: expose-keiro-0-24-workflow-counts-and-category-consumers
title: "Expose Keiro 0.24 workflow counts and category consumers"
kind: exec-plan
created_at: 2026-11-05T21:56:15Z
intention: "intention_01m6pvmhf5e0q80x8h7k937q33"
provenance:
  created_by:
    model: "gpt-6.1-sol"
    harness: "codex-cli"
    at: 2026-11-05T21:56:15Z
  revisions:
    - model: "gpt-6.1-sol"
      harness: "codex-cli"
      at: 2026-11-05T21:59:53Z
      mode: "other"
      note: "Ground initial plan in the published 0.24.0.0 contracts and current console gaps"
    - model: "gpt-6.1-sol"
      harness: "codex-cli"
      at: 2026-11-05T22:03:43Z
      mode: "implement"
      note: "Implement released workflow counts and category consumer reads with integrated acceptance evidence"
---

# Expose Keiro 0.24 workflow counts and category consumers

This ExecPlan is a living document. Keep Progress, Surprises & Discoveries, Decision Log,
and Outcomes & Retrospective current during implementation. Record implementation friction
with `agents/skills/exec-plan/record-friction.ts` following that skill's `FRICTION.md`.
Distill durable architectural changes into `docs/adr/` before completion.


## Purpose / Big Picture

Operators should see exact workflow status totals and discover which configured consumers
accept a category's events. Keiro 0.24.0.0 supplies both reads. Today Overview counts only
the newest 500 workflow instances, while a category page shows events without identifying
consumers. After this plan, Overview displays all seven exact totals, Workflows displays a
clearly scoped status summary, and a category page lists the projection groups and declared
durable consumers that match it, with links to existing inspection screens.

An operator can verify the result against the local example host: Overview agrees with
`GET /wf/inspect/counts`, `/categories/order` identifies `jitsurei-order-reporting`, and
`/categories/creditLimit` reports no matching declarations within explicitly partial coverage.
Older hosts, missing metadata, and failed reads remain visible states rather than fabricated
zeroes. This plan adds reads only; it does not release the console or add operator actions.


## Progress

- [x] M1 (2026-11-05): Both public clients decode the rebuilt 0.24.0.0 example host at `ec47c922`; all four live checks pass. Six new fixtures have five HTTP 200 responses and one HTTP 400 invalid cursor. Client/testing suites pass 193 checks, including synthetic pagination, exact integers, validation and availability. Existing entity pins and unrelated surface bytes are preserved.
- [x] M2 (2026-11-05): Overview uses exact counts without a list read; Workflows shows all seven totals with exact-name scope, observation time, stale/error and unavailable states. Focused unit and browser checks pass, including digits above 2^53, list independence and a 16-second pause beyond the count poll interval. The live browser comparison matches all seven endpoint values.
- [x] M3 (2026-11-05): Category details show recorded declarations and partial coverage with independent paging/refresh and useful target-preserving links. Thirteen panel checks cover every consumer/source kind, full/partial/zero coverage, unregistered groups, failures, cursor recovery and late category responses. Mock and live browser checks pass for order, its projection link and creditLimit.
- [x] M4 (2026-11-05): Full checks pass: `bun run check`, 692 unit tests, production build, 60 browser tests, 10 multi-app tests, 4 live client tests and 6 read-only live browser tests (2 mutating cases intentionally skipped). All stack probes pass, including the two default-profile reads. Strict validation passes for 11 capabilities, 5 user documents and 10 friction entries. Operator/client/development documentation is updated; live screenshots were inspected.

Completion (2026-11-05): All four milestones are verified against the default example stack
without reseeding. Fixture source `ec47c922` identifies the rebuilt host; the original seed
description remains unchanged. The running stack and console dev server remain available
for local inspection.


## Surprises & Discoveries

- Observation (2026-11-05): The example seed has exactly two retained completed workflows and one order consumer, with both inline and subscription bindings. A limit-one consumer read has no continuation. Two-page and large-integer cases therefore use explicitly synthetic overrides.
- Observation (2026-11-05): Required strict capability validation exposed missing recommended review metadata on all eleven existing concepts. The catalog now records a bounded metadata review (identifiers, provider, package names and evidence paths), with `commented` outcome; it claims no independent behavioral approval. See FRIC-10 in `docs/friction-log/`.


## Decision Log

- Decision (2026-11-05): Targeted fixture recording preserves the original seed description and untouched surface source commits. Recording the rebuilt host proves its response source, not that the database was reseeded.
- Decision (2026-11-05): Implement the two newly released reads in one standalone plan, following the completed `docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md`. That initiative already delivered process-manager discovery, feeding subscriptions, and stored snapshots. It explicitly deferred workflow counts and category discovery until routes existed; both now ship in 0.24.0.0. Do not reopen its completed children or repeat their UI work.
- Decision (2026-11-05): Replace Overview's workflow sample with exact counts, and add the same summary to Workflows scoped only by the exact workflow name. The endpoint supports no status or time filters. Label that scope and keep list filters independent; do not invent filtered totals or count list pages in the browser. On hosts lacking counts, say exact counts are unavailable and keep the workflow list usable; do not silently fall back to a sample.
- Decision (2026-11-05): Query consumers only for the category currently open. Treat the answer as mounted configuration with explicitly reported coverage, not running workers, checkpoint progress, or proof that a handler will process an event. Refresh this metadata manually rather than polling every category. This keeps request volume bounded and avoids conflating declarations with runtime facts.


## Outcomes & Retrospective

Completed 2026-11-05. Overview and Workflows now display exact, lossless retained status
totals from the released endpoint, with explicit name scope and honest failed/absent reads.
Category details expose only the open category's declared consumers, every matching binding,
coverage and links, with manual refresh and paging isolated from events. Deployment switching
and late responses remain isolated by the existing connection-session layer; no layer change
was needed. The live seed showed two completed workflows, one order projection group and an
empty creditLimit inventory with durable metadata unavailable. Synthetic checks provide the
large-count, multiple-page, coverage, failure and inventory-change cases absent from that seed.

The final validation passed `just stack-check`, `bun run check`, `bun run test` (692 passed,
14 opt-in cases skipped), `bun run build`, `bun run test:e2e` (60 passed),
`bun run test:e2e:multi-app` (10 passed), live client reads (4 passed), and the read-only live
browser gate (6 passed, 2 mutating cases skipped). Strict capability and user bundle checks
passed. The recorder-only provenance follow-up also passed all 143 testing-package checks.
Existing lint warnings and jsdom layout warnings do not fail checks. Screenshots of the live
category and workflow screens were visually reviewed at 1440 × 1000.

FRIC-9 in `docs/friction-log/` is **accepted**: derivation still operates across all surfaces;
its output was reviewed and unrelated bytes restored, and the development guide now names
that constraint. FRIC-10 is **resolved**: the catalog's missing recommended review metadata
was supplied through an actual bounded metadata review, retaining strict enforcement and
making no independent behavioral approval claim.

ADR distillation reviewed the decisions and discoveries against ADR-5, ADR-7, ADR-10,
ADR-11, ADR-12, ADR-13 and ADR-15. Their direct-client ownership, exact-integer, honest-error,
query-liveness and disposable-session rules already cover the implementation. No new
architectural boundary or durable exception was established, so no ADR changed. No release,
upstream edit, migration, new mutation or database reseed was performed.


## Context and Orientation

This repository builds a static React console. Its browser calls each runtime's own HTTP
surface through configurable prefixes. An application target is a deployment selected in the
URL; changing it mounts a disposable connection session with fresh clients and query caches.
Keiro's default local host is `jitsurei-ops-http` on port 9093, proxied as `/keiro` by Vite.
`dev/build.sh` builds that host plus the standalone host used by the separate Mori profile.
`dev/process-compose.yaml`, `dev/.env.example`, `dev/check.sh`, and `dev/README.md` define
startup, probes, and fixture recording. Do not edit another repository as part of this plan.

`packages/client-keiro/src/client.ts` translates command words into GET paths using
`packages/client-keiro/src/route.ts`. Runtime response schemas live in
`packages/client-keiro/src/schemas.ts`, opaque pagination token types in
`packages/client-keiro/src/cursors.ts`, and cache keys in
`packages/client-keiro/src/query-keys.ts`. An opaque cursor is a server-created continuation
string that clients echo unchanged. `packages/client-keiro/src/index.ts` re-exports these
modules. `packages/client-keiro/src/errors.ts` currently classifies unavailable hooks only
for the first command words `aggregate` and `pm`; it cannot classify these two new reads.

`apps/console/src/features/overview/queries.ts` currently reads 500 workflow rows ordered by
creation time. `WorkflowsCard` in `apps/console/src/features/overview/overview.tsx` counts
those rows and adds `+` when another page exists. The workflow list is
`apps/console/src/routes/_shell/workflows/index.tsx`; its queries and URL filter handling are
in `apps/console/src/features/workflows/queries.ts` and
`apps/console/src/features/workflows/search.ts`. It already has independent paged reads and
a WebSocket feed. Preserve that list/feed behavior. Counts have no new WebSocket feed.

The category detail is `apps/console/src/routes/_shell/categories/$name.tsx`. It reads events
from Kiroku through `apps/console/src/features/streams/queries.ts`, with event pagination and
optional live following. Add Keiro metadata beside those events. The two surfaces can be
configured independently. Existing `links.projection`, `links.subscription`, and
`links.processManager` in `apps/console/src/lib/links.ts` build inspection links; shared
navigation retains deployment identity. Use existing UI primitives from `packages/ui`.

`packages/testing/manifests/keiro.json` declares real requests to record. Its fixture files
and `packages/testing/fixtures/_meta.json` drive mock HTTP handlers in
`packages/testing/src/handlers.ts`. That handler chooses fixtures by non-pagination query
parameters, then echoes recorded pages; distinct categories and workflow names therefore
need distinct manifest entries. `packages/testing/scripts/record.ts` preserves raw response
bytes and accepts a surface argument. Targeted recording avoids rewriting other surfaces.
Use explicit test overrides for cases a real seed cannot produce, and never describe them as
recorded upstream evidence.

The dependency was located with `mori registry list`, `mori registry search keiro`,
`mori registry show shinzui/keiro --full --json`, and `mori registry docs shinzui/keiro`.
Mori's metadata is stale and reports no curated guides, so the source was inspected directly.
The authoritative package registry returned 0.24.0.0 as normal for both
`https://hackage.haskell.org/package/keiro-ops.json` and
`https://hackage.haskell.org/package/keiro-ops-http.json`. Upstream tags
`keiro-ops-0.24.0.0` and `keiro-ops-http-0.24.0.0` both peel to
`382192a9053d23e1cad54d03e43a038a79107c7a`. The researched checkout was `ec47c922`, whose
runtime and example source has no diff from that release commit. Future implementation must
verify the host built is at least this release; do not use the old fixture source commit as
proof that new routes are mounted.

Canonical upstream artifacts are
`mori://shinzui/keiro/packages/keiro-ops-http`,
`mori://shinzui/keiro/packages/keiro-ops`,
`mori://shinzui/keiro/plans/325-count-workflow-instances-by-status-class-without-runtime-performance-regressions`,
and `mori://shinzui/keiro/plans/324-map-categories-to-projection-and-durable-subscription-consumers`.
They fulfill `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-58` and
`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-59`. `mori path` could not resolve
the plan-324 URI during creation; retain the canonical reference despite registry lag.
For direct source reading, resolve `mori://shinzui/keiro` through the registry and read its
project-relative `keiro/src/Keiro/Workflow/Inspection.hs`,
`keiro-ops/src/Keiro/Ops/Workflow.hs`, `keiro-ops/src/Keiro/Ops/Projection.hs`,
`keiro-ops-http/src/Keiro/Ops/Http/Application.hs`,
`docs/guides/serve-keiro-ops-over-http.md`, and `docs/user/operations.md`.
Artifact-level URIs for these source and guide paths are pending; their owner is the
canonical project URI just given.

Relevant local ADRs were discovered by filename and heading and read during creation.
[ADR-5](../adr/0005-no-backend-for-frontend.md) requires direct typed clients, with no new
server. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps mutations
outside this read-only extension. [ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md)
requires lossless 64-bit counts as `bigint`, JavaScript's exact integer type.
[ADR-11](../adr/0011-one-error-shape-over-three-envelopes.md) requires normalized `ApiError`
failures with their original codes and messages.
[ADR-12](../adr/0012-poll-first-live-queries.md) requires shared query hooks, pause/resume,
and visible freshness; expensive reads may use a longer interval.
[ADR-13](../adr/0013-honest-gates.md) says missing capabilities are not negative facts.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) requires cache,
request, and navigation isolation between deployments. These decisions already cover this
plan; no new ADR is required merely to add endpoints.


## Plan of Work

### Milestone 1: Released contracts, typed clients, and representative host proof

Add `WorkflowCounts` to `packages/client-keiro/src/schemas.ts`. Its body is
`{observed_at: string, counts: {running, retrying, sleeping, awaiting, completed, cancelled,
failed}}`; all seven counts are required nonnegative `int64()` values, including zeroes.
Retain additive unknown object fields consistently with the existing schemas. Add
`workflows.counts(filters = {}, signal?)`, with a distinct `WorkflowCountsFilters` type that
accepts only optional `workflow_name`. The route is `GET /wf/inspect/counts`; workflow-name
matching is exact and case-sensitive. Do not reuse `WorkflowListFilters`: cursors, ordering,
status and time filters are rejected by the server. These totals count retained current
instance headers, including terminal instances, in one database statement; they are not
historical event totals. Add a query key bound only to the workflow name.

Add `CategoryConsumersPage` and its nested schemas in the same file. The envelope requires
`schema: "keiro/category-consumers/v1"`, `category: string`,
`scope: "mounted_configuration"`, `coverage: {projection_catalog: boolean,
durable_subscribers: boolean}`, and `items`; `next_cursor` is optional. Items require
`kind` (`durable_subscriber`, `process_manager`, or `projection_group`), `name`, nullable
`group_id`, and `bindings`. A binding requires nullable `projection_id`, `handler_name`,
`subscription_id`, and `subscription_name`, plus `delivery` (`inline` or `subscription`)
and `source`. Source has one of three forms: `{kind: "all"}`,
`{kind: "category", category: string}`, or `{kind: "namespace", namespace: string}`.
A namespace matches its exact name and colon-delimited descendants; display the server's
source and do not reproduce matching logic in the browser. Keep subscription IDs and names
as strings; use `subscription_name` for existing subscription inspection links.

Add the branded string `CategoryConsumersCursor` in
`packages/client-keiro/src/cursors.ts`, and
`projections.consumers({category, limit?, after?}, signal?)` in
`packages/client-keiro/src/client.ts`. It calls `GET /projection/consumers`; validate limits
with `checkLimit`, and reject empty or surrounding-whitespace category names locally without
silently trimming or changing case. The default page size is 100, maximum 500. Pagination
bounds consumer items, not nested bindings. Cache keys include category, limit, and cursor;
normalize the wire `next_cursor` through the existing page helper to `nextCursor` while
preserving all coverage and schema fields. Add both methods to the client README.

Handle availability for these exact reads, not every command starting with `projection` or
`wf`. Extend `packages/client-keiro/src/errors.ts` with a command-aware predicate named
`isInspectionReadUnavailable(error, read)`, where `read` is `"workflow-counts"` or
`"category-consumers"`. A locally valid read refused with HTTP 400 `invalid_request` and
`details.arguments` identifying that exact command means the host does not expose it. Treat
HTTP 400 `unsupported_command` for the consumer call likewise. Preserve `ApiError` causes
and require call-site context; do not broaden `HOOK_GATED_WORDS`. An arbitrary 400, HTML
proxy error, `schema_drift`, `inspection_busy`, `inspection_timeout`, `command_failed`, or
413 result-size refusal remains a real failure, never an unavailable capability or zero.

Build and start the current example host, then exercise these two public client methods in
`packages/client-keiro/test/live/reads.live.test.ts` before expanding UI variants. Global and
exact-name counts must decode; an unknown name must return seven zeroes. `order` discovery
must contain `jitsurei-order-reporting`; `creditLimit` must return an empty page with
projection coverage true and durable coverage false. A `limit: 1` request must decode
regardless of whether it has a continuation. Do not assume this seed has multiple consumers.

Add manifest entries with slugs `workflow-counts`, `workflow-counts-named`,
`workflow-counts-empty`, `category-consumers-order`, `category-consumers-credit-limit`, and
`category-consumers-bad-cursor`. They record the unfiltered, pinned `workflow_name`, unknown
workflow-name, `category=order&limit=100`, `category=creditLimit&limit=100`, and
`category=order&after=garbage` requests respectively; the last is an error variant. Record
only Keiro, without reseeding or changing existing entity pins. Unit client tests in
`packages/client-keiro/test/reads.test.ts` and a new
`packages/client-keiro/test/ops-discovery.test.ts` prove query encoding, unavailable/error
classification, all source forms, nullable bindings, both coverage flags, exact integers
above 2^53, and a two-page continuation using explicit synthetic overrides. An unknown
workflow fixture must not be used for every arbitrary name by the mock handler.

M1 passes when these client tests and live checks pass and every new fixture's status and
source commit are recorded accurately. If real bodies disagree with this contract, correct
this plan and schemas before building screens. No UI is needed to verify M1.

### Milestone 2: Exact workflow totals in Overview and Workflows

Replace `useWorkflowsCard` in `apps/console/src/features/overview/queries.ts` with the shared
counts hook from `apps/console/src/features/workflows/queries.ts`. Remove `WORKFLOW_SAMPLE`
and the workflow-list read used solely for Overview. The hook uses `useSurfaceQuery` with
`surface: "keiro"`, the counts key, an abort signal, and a 15-second polling interval;
existing adaptive throttling, pause/resume, and manual refresh remain authoritative. A
filtered and unfiltered call use distinct keys; unfiltered consumers share one cache entry.
Exact counts scan the selected population, so do not add polling per status or a count feed.

Update `WorkflowsCard` in `apps/console/src/features/overview/overview.tsx` to show running as
its headline and all six other totals in its subtitle through `formatInt`, with the response's
`observed_at`. Remove sample wording and `+` markers for this card only. An unavailable
endpoint says "Exact workflow counts unavailable on this host" and retains the Workflows
link. A failure exposes its code and message; a refetch failure may keep the previous values
only with their original observation time and a visible stale/error notice. Never replace
an error with zero or show old data as a fresh observation.

Create `apps/console/src/features/workflows/components/WorkflowCountsSummary.tsx` and render
it on `apps/console/src/routes/_shell/workflows/index.tsx`. Show all seven named totals and
observation time. Pass only `search.workflow_name` to the hook. Its scope text says
"All retained workflows" or "Retained workflows named NAME", followed by "Status and time
filters apply to the list below, not these totals." Cursor, status, time, ordering, and
page-size changes must not change the count request. Name changes do. Keep the paged list
and its feed usable when counts are unavailable or fail; list and counts are separate
observations and need not agree during active writes. Use shared primitives and accessible
labels; this plan requires no new navigation or count-click actions.

Update `apps/console/src/features/overview/overview.test.tsx`,
`apps/console/src/features/workflows/workflow-list.test.tsx`, and the corresponding
`apps/console/e2e/overview/overview.spec.ts` and
`apps/console/e2e/workflows/workflows.spec.ts`. Prove that an exact total larger than the
list page appears without `+`, every digit of a value above 2^53 survives, name scoping is
exact, unrelated filters do not leak into the API call, pause stops count polling, and
unavailable/timeout states leave list navigation working. Assert Overview issues no workflow
list request for its card. M2 passes with the focused unit and browser tests plus a live
comparison to the counts endpoint; use a quiescent seed for numeric equality.

### Milestone 3: Declared consumers on a category detail

Create `apps/console/src/features/streams/CategoryConsumersPanel.tsx` and
`apps/console/src/features/streams/consumer-queries.ts`, and mount the panel on
`apps/console/src/routes/_shell/categories/$name.tsx` above the events table. Read only the
open category. The hook uses `useSurfaceQuery`, `surface: "keiro"`, `poll: false`, abort
signals, and a query key including its own cursor. Own the consumer continuation and back
trail in the panel, independently of event `from`/`limit` URL parameters; reset them when
the category or connection session changes. A manual **Refresh consumers** action clears
the consumer trail and fetches page one. No discovery requests belong on the categories list.

Label the region "Declared consumers" and explain that it reports matching mounted
configuration, not worker health or delivery progress. Show each coverage flag explicitly as
available or unavailable, including when there are rows. Render each item with kind and
name, group ID when present, and every matching binding's projection, handler, delivery,
subscription name/ID, and exact source scope. Render nullable identities as "not reported";
for inline delivery say "inline" instead of implying a missing subscription. Do not truncate
nested bindings silently. Source scopes render as "all categories", "category: VALUE", or
"namespace: VALUE". Opaque/custom consumers are not inferred from event or checkpoint data.

Link a `group_id` to the existing projection-group page and a non-null `subscription_name`
to subscription detail. A configured group can lack runtime status; the declaration still
remains visible. Consumer names need not be inspector aliases, so leave process-manager
names as text in this plan rather than constructing an unverified manager link. Use the
existing application link handling so selected target parameters survive navigation.

An empty page says "No matching consumers in the reported metadata" with the coverage
labels still visible. Never say there are no consumers application-wide. An absent Keiro
endpoint says "Keiro inspection is not configured" without sending a request. A recognized
route refusal says "Consumer discovery is unavailable on this host" without guessing
whether the host is old or hooks are absent. Other failures show the original code/message
and retry control while leaving event inspection working. A 413 says the server refused the
result size; it is not a truncated success. HTTP 400 `invalid_cursor` clears only consumer
paging, refetches page one, and announces that the inventory changed or the cursor expired.
Do not loop if page one itself fails.

Create `apps/console/src/features/streams/category-consumers.test.tsx` and extend
`apps/console/e2e/streams/streams.spec.ts`. Use recorded `order` and `creditLimit` responses
for normal behavior. Synthetic overrides prove multiple pages, every consumer/source kind,
full and partial coverage, an unregistered group, route absence, timeout, oversize refusal,
inventory-change recovery, and independence from event pagination/following. Changing
categories must never display the previous category's declarations as current. M3 passes
with these focused checks and a live `order` lookup whose projection link reaches the
existing group screen; `creditLimit` must preserve its partial-coverage explanation.

### Milestone 4: Integrated proof and documentation

Extend `apps/console/e2e/live.spec.ts` with read-only checks of exact Overview totals and
category declarations. The live test must observe real `/wf/inspect/counts` and
`/projection/consumers` requests, rather than merely a generic row that could be supplied
by another surface. No new live mutating fixture or WebSocket topic is needed.

Update `dev/multi-app/inspection-fixtures.ts` and
`apps/console/e2e/multi-app/multi-app.spec.ts` so two targets return distinct counts and
consumer names for identical category names. Exercise target switching with one delayed
response, assert old results cannot enter the new target, and follow a consumer link while
preserving the chosen application. Include a target without Keiro and assert no new Keiro
requests occur. The shared session layer already supplies the isolation; fix defects there
only if required to meet these criteria.

Update `docs/user/console-reference.md`,
`docs/capabilities/runtime-overview.md`, `docs/capabilities/workflow-inspection.md`, and
`docs/capabilities/event-store-browsing.md` to describe exact retained totals, count filtering,
manual metadata refresh, coverage, and older-host behavior. Advance affected documentation
timestamps and maintain `docs/user/log.md` and `docs/capabilities/log.md` using existing
profile conventions. Update `dev/README.md` with the new fixture/probe expectations and add
both new read probes to `dev/check.sh` for the default example profile only: the Mori profile
uses a standalone host without consumer hooks and must not be required to pass discovery.

Run the final checks below. Record concise results in Progress, triage any logged friction,
and perform ADR distillation. Amend an ADR only if implementation establishes a new durable
constraint; these endpoint additions alone need no decision change. M4 passes when both
features work together against real responses, the multi-target cases pass, the relevant
documentation validates, and the full required code checks pass.


## Concrete Steps

Run from the repository root. Enter `nix develop` if Bun, Just, process-compose, or browser
binaries are missing. Dependency installation, if needed, is `bun install --frozen-lockfile`.
Keep upstream paths in local `dev/.env` configuration, not durable absolute references in
documentation. If absent, copy `dev/.env.example` to `dev/.env` and set checkout paths using
Mori. Existing versions of dependencies in `bun.lock` need no changes for this feature.

```bash
mori registry search keiro
mori registry show shinzui/keiro --full --json
mori registry docs shinzui/keiro
curl -fsSL https://hackage.haskell.org/package/keiro-ops-http.json
curl -fsSL https://hackage.haskell.org/package/keiro-ops.json
nix develop
just stack-build keiro
just stack-up
```

`stack-up` runs in the foreground; keep it in a separate terminal. If it is already running,
stop it with `just stack-down`, rebuild Keiro, and start it again so the process uses the new
binary. Do not seed an existing database just to obtain counts. If the scratch database is
empty, follow `dev/README.md` and run `just stack-seed` once before starting the stack.

From another terminal at the repository root, inspect the new reads. These are read-only:

```bash
curl -fsS http://127.0.0.1:9093/wf/inspect/counts
curl -fsS --get --data-urlencode workflow_name=order-fulfillment http://127.0.0.1:9093/wf/inspect/counts
curl -fsS --get --data-urlencode workflow_name=keiro-ui-counts-missing http://127.0.0.1:9093/wf/inspect/counts
curl -fsS 'http://127.0.0.1:9093/projection/consumers?category=order&limit=100'
curl -fsS 'http://127.0.0.1:9093/projection/consumers?category=creditLimit&limit=100'
```

The first two return HTTP 200 with `observed_at` and exactly the seven required count fields;
the unknown name has seven zeroes. The order result names `jitsurei-order-reporting` with
both inline and subscription delivery bindings. Credit-limit discovery returns `items: []`.
Both consumer results report projection coverage true and durable coverage false. The
following abbreviated examples show shape, not a numeric assertion about a changing seed:

```json
{"observed_at":"...","counts":{"running":0,"retrying":0,"sleeping":0,"awaiting":0,"completed":0,"cancelled":0,"failed":0}}
```

```json
{"schema":"keiro/category-consumers/v1","category":"creditLimit","scope":"mounted_configuration","coverage":{"projection_catalog":true,"durable_subscribers":false},"items":[]}
```

After adding M1's client methods and manifest entries, run:

```bash
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test
bun run fixtures:record keiro
bun run --filter @keiro-ui/testing derive
bun run test --project client-keiro
bun run test --project testing
```

The live suite must execute without skipped new tests, and each new recorder request must
have its expected status (200 successes, 400 invalid cursor). Stop on unexpected 4xx/5xx;
the recorder can preserve an error body without making it a valid success fixture. Review
the derived-fixture diff and preserve existing pins and unrelated surface bytes. Do not add
a second-page recorded fixture if this seed produces no second page.

During M2 and M3, use focused checks before the final suite:

```bash
bun run test --project console overview.test.tsx workflow-list.test.tsx category-consumers.test.tsx
bun run test:e2e -- overview workflows streams
```

For final validation, from the repository root:

```bash
just stack-check
bun run check
bun run test
bun run build
bun run test:e2e
bun run test:e2e:multi-app
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
okf validate docs/user --strict --profile mori/user-documentation-profile.dhall --profile-enforce --log-enforce
bun run dev
```

Keep `bun run dev` running at `http://localhost:5173` in a separate terminal. Run the live
browser gate from `apps/console`:

```bash
KEIRO_UI_LIVE=1 bunx playwright test --config playwright.live.config.ts
```

The read-only new browser cases must run and pass. Existing mutation cases remain skipped
unless separately requested. If ADRs changed, also run from the repository root:

```bash
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
```

Record one provenance revision when implementation first edits this plan, using the actual
current agent's verified runtime identity and the skill's `record-provenance.ts` script.
Implementation commits use Conventional Commits and include both trailers:

```text
ExecPlan: docs/plans/26-expose-keiro-0-24-workflow-counts-and-category-consumers.md
Intention: intention_01m6pvmhf5e0q80x8h7k937q33
```


## Validation and Acceptance

With the example host and Vite running, open Overview and compare all seven displayed totals
with `/keiro/wf/inspect/counts` on a quiet database. They match exactly and carry the server's
observation time. The Workflows card requests counts instead of 500 list rows and never
labels a returned exact count as a sample. Open Workflows: changing the name changes only
the count name filter, while status, dates, ordering, and page navigation leave that summary's
scope unchanged and update the list as before. Pause and resume control count polling.
Unavailable or failing counts never become zero and do not prevent listing workflows.

Open `/categories/order`: the Declared consumers region names `jitsurei-order-reporting`,
shows inline and `jitsurei-order-audit-subscription` bindings, and says durable metadata is
unavailable. Its group and subscription links preserve the selected deployment. Open
`/categories/creditLimit`: events and their pagination remain usable, while consumers says
there are no matching consumers in the reported metadata and retains the coverage limits.
No consumer read happens on the categories list, and no metadata poll happens while idle.
Manual refresh re-reads page one. A server-invalidated cursor restarts only this panel.

Deterministic tests cover conditions the seed does not contain: counts above 2^53;
zero, partial, and full coverage; all three consumer/source kinds; two pages; late responses
after target/category switches; absent optional Keiro; unavailable routes; and actual server
failures. New client tests, focused UI tests, browser tests, multi-app tests, the read-only
live gate, code checks, build, and affected documentation checks must pass. Mock evidence
alone does not complete M1 or M4. This plan requires no upstream benchmark reruns, database
migrations, fleet aggregation, release publication, additional mutations, or new backend.


## Idempotence and Recovery

All new production requests are GETs and can be repeated. Rebuilding hosts and recording
Keiro fixtures can be repeated without reseeding; `just stack-seed` appends example data,
so repeated seeding changes counts and entity IDs. Never reset databases as a convenience.
If a fresh seed is necessary, use a disposable development database and follow the existing
recording guide, updating all affected fixture pins together. Never point the fixture
recorder at a production target.

Consumer cursors are tied to both category and the host's mounted metadata inventory. On
`invalid_cursor`, discard only the consumer continuation and return to page one; do not
reuse a cursor for another category or connection. Retry inspection timeouts through the
ordinary read path without accumulating partial totals or falsely reporting no matches.
Existing query helpers cancel requests when sessions retire, and callbacks must not write
retired results into the current session.

Changes are additive except the Overview sample replacement. Revert the implementation
commits to restore that sample; no schema or persisted browser-state migration needs undoing.
Preserve unrelated work and the existing fixture metadata when restoring an interrupted
recording. If the running host is older than the source checkout, restart the built host
before changing schemas to match an obsolete response.


## Interfaces and Dependencies

The producer is released Keiro 0.24.0.0, verified by Hackage and upstream tags; application
hosts must mount either the projection catalog or durable-consumer metadata for discovery.
The standalone host mounts workflow counts but omits consumer discovery. The example host
mounts projection metadata and no durable-consumer registry. Existing process-manager
inspectors alone do not imply durable subscription metadata.

The public client additions are the following conceptual TypeScript signatures. Schema
output types use the existing branded integer and cursor conventions; optional abort signals
must reach the underlying HTTP request.

```typescript
interface WorkflowCountsFilters {
  workflow_name?: string
}

client.workflows.counts(filters?: WorkflowCountsFilters, signal?: AbortSignal): Promise<WorkflowCounts>
client.projections.consumers(query: {
  category: string
  limit?: number
  after?: CategoryConsumersCursor
}, signal?: AbortSignal): Promise<CategoryConsumersPage>

keiroKeys.workflows.counts(filters?: WorkflowCountsFilters)
keiroKeys.projections.consumers(query: {
  category: string
  limit?: number
  after?: CategoryConsumersCursor
})

isInspectionReadUnavailable(error: unknown, read: "workflow-counts" | "category-consumers"): boolean
```

`WorkflowCounts.counts` has seven required exact integer fields. `CategoryConsumersPage`
retains `schema`, `category`, `scope`, `coverage`, items and optional normalized `nextCursor`.
A lack of `observed_at` in discovery is intentional: it describes configuration, so label
its freshness by client fetch time rather than inventing a database timestamp.

No package upgrade or new UI dependency is needed. Reuse `@keiro-ui/client-core`'s lossless
HTTP parser, `int64`, page helpers, query hooks and optional-surface handling, the existing
Keiro provider, and repository UI components. Before using any unfamiliar dependency API,
locate its source and docs through Mori. The completed plans 22–25 and MasterPlan 3 are
background context, not unfinished prerequisites. This standalone plan owns both additions
and their fixture updates; it has no parent MasterPlan.
