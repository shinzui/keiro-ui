---
id: 17
slug: build-the-projections-and-overview-screens
title: "Build the Projections and Overview screens"
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
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-10-21T22:22:25Z
      mode: "implement"
      note: "M1-M4 implemented: projections, shards, overview, live-stack gate passed"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Build the Projections and Overview screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

After this plan, an operator running the keiro runtime console can answer two families of
questions that today require SQL or the `keiro-ops` command line. On the **Projections**
section they see every projection group (a named read model that keiro keeps up to date by
folding events), how far its served position sits behind the store's visible head — the
**global position distance** — whether reads and writes are allowed, whether a rebuild is in
flight and how far it has got, and whether the group has failed and why; drilling into a
group shows the durable checkpoint positions of the subscription that feeds it, and a
**Shards** page shows which worker owns which shard bucket of a sharded subscription. On
the **Overview** (the console's landing page, `/`) they see one card per concern — queues,
workflows, projections, processors, the store, aggregates and process managers, timers —
each showing the headline number the direction document assigns it, each linking into its
section, plus a health strip for the four surfaces and keiro's own health card. Every
number is fetched directly from the owning project's endpoint by the typed clients, polls
adaptively, pauses when the operator pauses liveness, and says when it was observed.

This plan also owns the MasterPlan's **live-stack integration gate**: with the local
runtime stack running, every section's list screen and the Overview render real data
through the Vite proxy with liveness on. Completing that walkthrough and its Playwright
specification is how this plan proves the whole read-only console composes, and it is
what lets the parent MasterPlan tick the gate.

To see it working: start the local stack from `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`,
run `bun run dev` at the repository root, open `http://localhost:5173/`, and watch the
Projections card report the largest global position distance across groups while the
Queues card reports the age of the oldest ready message; click either card and land on its
section with the same numbers in the table.


## Progress

- [x] M1 (2026-10-21): `/projections` with the global position distance per group
  (`features/projections/distance.ts`, bigint-exact; "n/a", "caught up", the number, or
  "ahead by"), lifecycle, access, rebuild progress, and failure badges, URL cursor paging, and
  the `projection_groups` feed on page one. Evidence: `distance.test.ts` (including 2^62),
  `projections.test.tsx` (feed change and removal with no re-read; one re-read on overflow).
- [x] M2 (2026-10-21): `/projections/$group` (the group card, the feeding-subscription
  limitation sentence, members and maximum distance when given a subscription) and `/shards`
  (list, and ownership with the unowned count behind `?subscription=`). Evidence:
  `projections.test.tsx`, `e2e/projections/shards.spec.ts`.
- [x] M3 (2026-10-21): `/` with seven cards (queues, workflows, projections, processors, store,
  aggregates & process managers, timers), the surfaces strip, and the keiro health card; "+"
  and "newest 500 instances" on a sampled workflow page, "not mounted on this host", and
  "mutations: disabled on server". Evidence: `overview.test.tsx`;
  `e2e/overview/overview.spec.ts` (keyboard and mouse navigation; no card read for 7 s while
  paused, at least five at once on resume).
- [x] M4 (2026-10-21): the live-stack integration gate. Walkthrough on the jitsurei stack
  (kiroku-metrics 0.3.0.1 at kiroku `ea364cf`, pgmq-inspect 0.1.0.0 at pgmq-hs `d6750a6`,
  keiro-ops-http 0.21.0.0 at keiro `7ee722a7`, and the shibuya-pgmq-adapter example consumer
  on shibuya-metrics 0.10.0.x): `/` shows four healthy surfaces and live headlines; every list
  screen renders rows or its empty or not-mounted state. `KEIRO_UI_LIVE=1 bunx playwright test
  --config playwright.live.config.ts` → `✓ e2e/live.spec.ts:26:1 › every section renders
  against the live stack (1.6s)`, `1 passed`; `KEIRO_UI_LIVE=1 bunx vitest run
  packages/client-core/test/contract.test.ts` → 112 passed. Playwright screens and shell 49
  passed; `bun run test` 541 passed; `bun run check` clean.


## Surprises & Discoveries

- keiro-ops-http admits 4 concurrent inspection reads by default (`defaultInspectionLimits`
  in `keiro-ops-http/src/Keiro/Ops/Http/Config.hs`) and answers 503 `inspection_busy` beyond
  that. The Overview's keiro reads plus the shell's health probe exceeded it, so the stuck-timer
  read failed and keiro's health dot turned red under the console's own load. The client core's
  HTTP client gained `maxConcurrent` (an in-order limiter), the keiro client uses 3, and the
  shell's probe treats a keiro `inspection_busy` 503 as degraded ("busy"), not down.
- The keiro feed hook wrote `projection_groups` frames' `visible_store_head` into the cache as a
  JSON number while the HTTP page holds a bigint; mixed bigint math would throw. The hook now
  converts with `toInt64`, and the scripted feed sends the head as real keiro does.
- The recorded projection and shard fixtures have no served positions, members, or sharded
  subscriptions; `derive.ts` keeps the recorded rows and adds one group per display case and
  a sharded `jitsurei-order-reporting`, aligned with the derived kiroku checkpoints.
- Live, the only managed group (`jitsurei-order-reporting`) serves no position, so the
  Projections card says "no served position" rather than "all caught up".
- The shell's health probes keep polling while liveness is paused (they describe
  connectivity); the pause acceptance counts the cards' reads, not the probes.


## Decision Log

- Decision: The Overview adds no charting dependency. Cards are numeric with an "as of"
  stamp and a trend glyph computed from the previous poll; the queue-age and
  projection-distance cards keep a 30-sample in-memory history behind `useSampleHistory`
  so a later plan can render sparklines (for example with the shadcn aria `chart`
  component, which brings Recharts) without changing the data flow.
  Rationale: the direction document calls charting "a separate, later choice"; no card in
  this plan needs a chart to answer its question, and Recharts is not a cost to pay
  speculatively.
  Date: 2026-10-21

- Decision: keiro does not expose which durable subscription feeds a projection group
  (`/projection/status` items carry no subscription field), so the group detail page reads
  the subscription name from the `subscription` search parameter, offers a search field to
  set it, and states the limitation inline. A candidate improvement request to keiro —
  "expose the feeding subscription name on projection-status rows" — is recorded in
  Interfaces and Dependencies; it is not a dependency.
  Rationale: inventing the mapping client-side (for example by naming convention) would
  violate ADR-5's rule that the UI never shows what the API cannot serve.
  Date: 2026-10-21

- Decision: Workflow status counts on the Overview are computed client-side from one
  `workflows.list` page of the newest 500 instances and render as "500+" when a further
  page exists, with the card subtitle "newest 500 instances". A candidate improvement
  request to keiro for a status-class count read is recorded; it is not a dependency.
  Rationale: no count endpoint exists; an honest bounded count beats a misleading exact
  one, and seven per-class requests would multiply load for the same bound.
  Date: 2026-10-21

- Decision: No rebuild, pause, promote, or prune control appears on any projection screen in
  this plan. The direction document's rebuild flow (pause, typed confirmation, reset-point
  choice, blast-radius preview, live progress) is deferred beyond this initiative.
  Rationale: ADR-7 — the first release is read-only, and rebuild is replay-shaped; keiro's
  `/rebuild/*` routes are hook-gated and absent from every runnable host today.
  Date: 2026-10-21

- Decision: The projections list pages by URL cursor (`after`) with the shared pager rather
  than "load more", like every other list; page one shares its cache entry with the feed.
  The surfaces strip reuses the shell's `useSurfaceHealth` (same rule, shared cache) instead of
  issuing its own health calls. No `registerProjectionsFeature()`: the section's pages and
  palette entries are the shell's and recents are recorded by kind.
  Rationale: one paging idiom across lists; no duplicate probes; no empty registration.
  Date: 2026-10-21


## Outcomes & Retrospective

Complete (2026-10-21). Projections show the global position distance exactly, live on the
first page; the group page shows a feeding subscription's members when the operator names it;
shards show bucket ownership; and the Overview composes one card per concern from one owner
call each, honestly bounded ("+", "not mounted on this host"). The live-stack integration gate
passed on the jitsurei stack, so every read-only section is verified end to end.

Found on the way and fixed: the console exceeded keiro's inspection budget on the Overview
(now a client-side cap and a "busy" health state), and the projection feed's head type.
Candidate improvement requests to keiro, recorded for the MasterPlan: expose the feeding
subscription on `/projection/status` rows; a status-class count read for workflows.


## Context and Orientation

**What exists when this plan starts.** The repository is a bun workspace created by
`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`: `apps/console` is the
React 19 + TypeScript + Vite application, `packages/ui` (`@keiro-ui/ui`) holds the
shadcn-generated React Aria components and Paper Mono, and the Vite dev server proxies the
four runtime surfaces under `/kiroku`, `/shibuya`, `/pgmq`, `/keiro` to local ports 9091,
9090, 9095, 9093. `docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`
built the shell: the rail, the collapsible sidebar, the bottom status bar, the right sheet,
the ⌘K palette, connection profiles, and — under `apps/console/src/` — `shell/navigation.ts`
(sections and their sidebar entries), `shell/features.ts` (`registerFeature`, through
which this plan registers its presets and static commands), `shell/commands.ts`
(`useRegisterCommands` for static entries; the parsed `projection <group>` jump already
exists in the shell's `jumpParsers`), `shell/recent.ts` (`useRecordVisit({kind, label, href})`),
`shell/status-bar.tsx` (status slots, including the visible store head), `lib/links.ts`
(typed route builders), and `lib/format.ts` (`formatRelativeTime`, `formatDuration`,
`formatInt`, `formatTimestamp`, and `formatPositionDistance`). `docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
built `@keiro-ui/client-core`: `useSurfaceQuery` (polling with the adaptive clamp
`clamp(10s, 10 × last fetch, 60s)` and per-surface defaults), `useLiveness` (pause, resume,
refresh), `useFeedSubscription` (a WebSocket feed layered on the query cache), `ApiError`,
and the int64-as-`bigint` rule. `docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`
and `docs/plans/12-implement-the-keiro-typed-client.md` built the typed clients this plan
reads from; the exact exports are listed under Interfaces and Dependencies. The other
section screens (`docs/plans/13-...` streams, `14-...` queues, `15-...` workflows, `16-...`
aggregates and process managers) may be complete or in progress; the Overview links to
their routes and, where a section is not yet built, to the placeholder route EP-8 left.

**Terms.** A *projection group* is one of keiro's read models identified by `group_id`; its
status comes from the frozen SQL contract `keiro_read.projection_group_status_v1`
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-35`). *Global position* is the store-wide
sequence number of an event in kiroku; *visible store head* (`visible_store_head`) is the
highest global position readers can currently see; `store_position` is the position a
caller observed; the difference between the head and a served position is the **global
position distance** — on every keiro-facing screen that phrase is used and the words "lag"
and "backlog" never are (`mori://shinzui/keiro/okf/adrs/concepts/ADR-28`; the display rule
is fixed in the MasterPlan's "Vocabulary and display rules"). A *durable subscription* is a
named kiroku consumer with checkpointed positions per *member*; a *sharded subscription*
splits its work into *buckets* leased by *owners* (workers). A *feed* is a keiro WebSocket
subscription that sends a `snapshot` then `update` frames (`changed` items to upsert,
`removed` keys to delete) for the first page of a read (`mori://shinzui/keiro/okf/adrs/concepts/ADR-56`):
there are no replay cursors, so a sequence gap or a `queue_overflow` error means
re-subscribe or re-poll; the client core handles that by refetching the owning query.

**The endpoints this plan consumes**, as audited in the MasterPlan's endpoint inventory
(keiro: `keiro-ops-http` 0.21.0.0 in tree; the routes are generated from the `keiro-ops`
command grammar, reads are GET and return the command's JSON unwrapped):

- `GET /keiro/projection/status?limit&after` → `{observed_at, visible_store_head, items, next_cursor?}`;
  each item has `group_id`, `lifecycle_phase`, `reads_allowed`, `writes_allowed`,
  `serving_revision_id`, `serving_epoch`, `serving_position_basis` (`append` | `checkpoint` |
  `unmanaged`), `serving_applied_position` (nullable int64), `active_run_id`,
  `candidate_revision_id`, `candidate_rebuild_position`, `candidate_rebuild_head`,
  `query_models` (list), `rebuild_started_at`, `last_promoted_at`, `failed_at`,
  `failure_code`, `failure_detail`.
- `GET /keiro/projection/position?subscription=<name>` → `{subscription, store_position, visible_store_head, members, minimum_checkpoint_position, maximum_global_position_distance}`;
  each member has `subscription`, `member`, `checkpoint_position`, `checkpoint_updated_at`,
  and a server-computed `global_position_distance`.
- `GET /keiro/shard/list` → `{observed_at, items: [{subscription, shard_counts, buckets_total, buckets_live, buckets_expired, buckets_unowned, live_owners}]}`
  and `GET /keiro/shard/status?subscription=<name>` → `{subscription, observed_at, shard_counts, ownership: [{bucket, owner, lease_expires_at, lease_state, heartbeat_at, updated_at, lease_age_seconds}]}`.
- `GET /keiro/health` → 200 `{status: "ok", schema_drift: [], mutations_enabled}`; under
  the host's default refuse-on-drift policy a drifted schema answers **503** with
  `{status: "schema_drift", schema_drift: [...], mutations_enabled}` (200 with that body
  only when the host allows drift); an unreachable database answers 503
  `{status: "unavailable", message}`; keiro's MasterPlan 46 also lets it answer 503
  `inspection_busy`. The keiro client's `health.get()` resolves with the body for all of
  these.
- `GET /keiro/wf/inspect/list?ordering=created_desc&limit=500` → a page of workflow
  instances with `status_class` per item (`running`, `retrying`, `sleeping`, `awaiting`,
  `completed`, `cancelled`, `failed`).
- `GET /keiro/timer/pending/list?limit=100` and `GET /keiro/timer/stuck/list`.
- `GET /keiro/aggregate/types` and `GET /keiro/pm/list` exist only when the host mounts
  the aggregate and process-manager hooks; on a host without them keiro answers HTTP 400
  with error code `invalid_request`, which the console renders as "not mounted on this
  host" (the same rule `docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md`
  applies).
- WebSocket `/keiro/ws`, feed `projection_groups`: `subscribe {feed, limit}` →
  `snapshot {feed, sequence, trigger, observed_at, visible_store_head, items}` then
  `update {..., visible_store_head, changed, removed}` keyed by `{group_id}`.
- kiroku (`kiroku-metrics` 0.3.0.1): `GET /kiroku/subscription-checkpoints` →
  `{store_position, checkpoints: [{subscription, member, checkpoint_position, updated_at}]}`;
  `GET /kiroku/metrics` → counters including `subscriptions_dead_lettered` (legacy error
  shape, process-local, zero on the standalone `kiroku-inspect`); `GET /kiroku/health/live`.
- pgmq (`pgmq-inspect` 0.1.0.0): `GET /pgmq/metrics` → an array of `QueueMetrics`
  (`queue_name`, `queue_length`, `queue_visible_length`, `total_messages`,
  `oldest_msg_age_sec` nullable, `newest_msg_age_sec` nullable, `scrape_time`,
  `default_partition_length` nullable) — this route counts rows in every queue and is
  expensive, so the Overview polls it no faster than every 15 s; `GET /pgmq/health/live`.
- shibuya (`shibuya-metrics` 0.10.0.1 plus unreleased): `GET /shibuya/health/ready` →
  `{ready, application, processors: {total, healthy, failed, stuck, paused}, dependencies}`
  with HTTP 200 or 503 and the same body; `GET /shibuya/health/live`.

**ADRs.** Local: [ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md) — every number here
is poll-first; the `projection_groups` feed only shortens latency, and overflow triggers a
refetch. [ADR-5](../adr/0005-no-backend-for-frontend.md) — the Overview composes its cards
in the browser from the four clients; there is no aggregation server and each card calls
exactly one owner. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) —
no mutation control ships in this plan; the keiro health card shows `mutations_enabled` as
a server fact, never as a UI switch. [ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
— UI primitives come only from `@keiro-ui/ui/components/<name>`. Cross-repository:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-35` (the projection-status contract is frozen,
so the field list above will not shrink), `mori://shinzui/keiro/okf/adrs/concepts/ADR-28`
(position vocabulary), `mori://shinzui/keiro/okf/adrs/concepts/ADR-56` (feed semantics),
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-18` (kiroku's surface is self-describing via
`/capabilities`; the health strip uses `/health/live`, which is always mounted). The
direction document (`docs/architecture/ui-direction.md`) defines the Overview as queue
latency first and depth second, workflow status counts, projection freshness as global
position distance, and processor states, and names Restate's adaptive clamp — supplied by
`useSurfaceQuery` — as the polling policy.


## Plan of Work

All new code lives under `apps/console/src/`. Routes follow the directory
`docs/plans/8-...` established for section routes (the MasterPlan names
`routes/_shell.tsx` as the layout and every page as a placeholder file under
`routes/_shell/`, which this plan fills without creating or renaming route files):
`routes/_shell/index.tsx` for `/`, `routes/_shell/projections/index.tsx` for `/projections`,
`routes/_shell/projections/$group.tsx` for `/projections/$group`, and
`routes/_shell/shards/index.tsx` for `/shards`. Feature code lives in
`features/projections/` and `features/overview/`; shared presentational pieces in
`features/overview/stat-card.tsx` (`StatCard`), `features/overview/health-strip.tsx`
(`HealthStrip`), and `features/projections/distance-cell.tsx` (`DistanceCell`).

### Milestone 1 — the projections table with distance math and the feed

Create `features/projections/distance.ts` exporting
`positionDistance({ head, applied, basis })` that returns a discriminated union:
`{kind: "unmanaged"}` when `basis === "unmanaged"`, `{kind: "none"}` when `applied` is null,
`{kind: "caught-up"}` when `head - applied === 0n`, else `{kind: "behind", distance: bigint}`
(and `{kind: "ahead", distance}` if a served position exceeds the head, which the UI
renders with a warning glyph rather than hiding). Display goes through
`formatPositionDistance` from `lib/format.ts`; EP-8 ships it with the two-argument
signature `(visibleStoreHead, position)`, so extend it additively to accept the union.
Create `features/projections/queries.ts` with `useProjectionStatus(search)` wrapping
`useSurfaceQuery({ surface: "keiro", queryKey: keiroKeys.projections.status(search), queryFn: () => keiro.projections.status(search) })`
and `useProjectionGroupsLive(enabled)` which calls the keiro client's
`useProjectionGroupsFeed({ enabled })` from `@keiro-ui/client-keiro/feeds`; that hook
already replaces the cached first page on `snapshot`, upserts `changed` items by
`group_id` and deletes `removed` keys on `update`, stores the frame's `visible_store_head`
in the cache's page header, and refetches on overflow or a sequence gap, so this plan
supplies only the `enabled` rule (first page, liveness not paused). Build
`features/projections/projection-table.tsx` on `@keiro-ui/ui/components/table` (composed
with `@tanstack/react-table` the way shadcn's data-table recipe does, as EP-13's lists do):
columns group, lifecycle (a `badge` coloured per phase), access (two small badges
"reads"/"writes" dimmed when false), serving revision and epoch, basis, applied position
(a `bigint` rendered with `formatInt`), distance (`DistanceCell`), rebuild
(empty unless `active_run_id` is set; then the candidate revision and a progress ratio
`candidate_rebuild_position / candidate_rebuild_head` as a `progress` bar with both
numbers in its label, and `rebuild_started_at` as relative time), query models (count with
the list in a `tooltip`), failure (a red "failed" badge when `failed_at` is set, with
`failure_code` and the first line of `failure_detail`), last promoted. The page header shows
`visible_store_head` and `observed_at`. Paging uses the client core's cursor adapter: a
"Load more" button appears while `next_cursor` is present and echoes it as `after`. The
route validates `search` with a zod 4 schema `{after?: string}`.

Verify: with fixtures (`VITE_MOCK=1 bun run dev`) the table shows the fixture groups; one
group with basis `unmanaged` shows "n/a", one with `serving_applied_position` equal to the
head shows "caught up", one behind shows a number; when the scripted feed emits an `update`
with a `changed` item the row updates in place without a refetch, and when it emits
`removed` the row disappears. Vitest: `features/projections/distance.test.ts` (pure math
including bigint beyond 2^53) and `features/projections/projection-table.test.tsx`
(render against `@keiro-ui/testing`'s mock server and scripted feed).

### Milestone 2 — group detail and shards

`routes/_shell/projections/$group.tsx` validates `{subscription?: string}` in search. The detail
card re-reads `projections.status` (first page, then paging until the group is found, or
the row passed through router state when navigated from the table) and shows every field
of M1's row in a definition list, with the distance union rendered large. Below it, a
`search-field` labelled "Feeding subscription" is prefilled from `?subscription=`; when
set, `useProjectionPosition(subscription)` calls `keiro.projections.position({subscription})`
and renders `store_position`, `visible_store_head`, `maximum_global_position_distance`,
`minimum_checkpoint_position`, and a members table (member, checkpoint position, the
server's `global_position_distance`, checkpoint updated at), plus a link built with
`links.subscription(subscription)` to the kiroku checkpoint page. When unset, a muted
note reads "keiro does not expose which subscription feeds this group; enter it to see
checkpoints" — that sentence is the acceptance for the limitation. A `command_failed`
`ApiError` (unknown subscription) renders inline as the server's message. No controls
appear; a muted footer line states "Rebuild and promotion are operator-CLI actions in this
release".

`routes/_shell/shards/index.tsx` validates `{subscription?: string}`. The list half calls
`keiro.shards.list()` and renders subscription, shard counts, buckets total/live/expired/
unowned, and live owners; clicking a row sets `?subscription=`. The status half, present
only with a subscription, calls `keiro.shards.status({subscription})` and renders the
ownership rows (bucket, owner, lease state as a badge, lease expires at and heartbeat at as
relative times, lease age in seconds) with a count of unowned buckets in its header. Both
halves poll via `useSurfaceQuery`.

Verify: against fixtures, `/projections/<fixture-group>?subscription=<fixture-subscription>`
shows members whose `global_position_distance` matches the fixture, and `/shards?subscription=<name>`
shows the fixture ownership rows. Vitest covers the limitation note and the error inline.

### Milestone 3 — the Overview

`routes/_shell/index.tsx` composes `features/overview/overview.tsx`. Each card is a `StatCard`
(`@keiro-ui/ui/components/card` plus a headline, a subtitle, an "as of" line, a trend
glyph, and a `link` built from `lib/links.ts`) fed by one hook in
`features/overview/queries.ts`:

- **Queues** → `pgmq.metrics.all()` with a 15 s floor on the poll interval. Headline: the
  largest non-null `oldest_msg_age_sec` formatted as a duration, labelled "oldest ready
  message"; if every value is null, "no ready messages". Subtitle: "<n> queues · <total>
  total · <visible> visible" from sums of `queue_length` and `queue_visible_length`. Links to
  `/queues`.
- **Workflows** → `keiro.workflows.list({ordering: "created_desc", limit: 500})`. Headline:
  the running count (`status_class === "running"`); subtitle: the other six classes as
  "retrying 2 · sleeping 5 · …", every number suffixed "+" and the subtitle prefixed
  "newest 500 instances:" when `next_cursor` is present. Links to `/workflows`.
- **Projections** → the M1 query (first page, `limit` 500). Headline: the largest
  `behind` distance across groups, labelled "max global position distance", or "all caught
  up"; subtitle: "<n> groups · <f> failed · head <visible_store_head>". Links to
  `/projections`. This hook also publishes `visible_store_head` to the status bar's store
  head slot via EP-8's slot API, so the bottom bar shows it on every page once the Overview
  or a projections page has run.
- **Processors** → `shibuya.health.ready()`, which resolves with `{status, body}` for both
  200 and 503 (`body.ready` false on 503) — EP-11's declared contract. Headline:
  `body.application` state; subtitle: "total 4 · healthy 3 · failed 0 · stuck 1 · paused 0".
  Links to `/processors`.
- **Store** → `kiroku.checkpoints.inventory()` for `store_position` (headline, labelled
  "store position") and the number of distinct subscriptions (subtitle), and
  `kiroku.metrics.all()` for `subscriptions_dead_lettered` rendered as "dead letters seen:
  <n>" when the call succeeds and omitted when `/metrics` is disabled or legacy-errors
  (`kiroku-inspect` reports zero because it runs no subscriptions; say so in a tooltip).
  Links to `/subscriptions`.
- **Aggregates & process managers** → `keiro.aggregates.types()`. Headline: the number
  of aggregate types; subtitle lists them. On an `ApiError` with status 400 and code
  `invalid_request` the card body reads "not mounted on this host" and links to
  `/aggregates`, which EP-16 renders with the same message.
- **Timers** → `keiro.timers.pending({limit: 100})` and `keiro.timers.stuck({})`. Headline:
  pending count, "100+" when `next_cursor` is present; subtitle: "<s> stuck". Links to
  `/timers`.

`HealthStrip` renders four dots from `kiroku.health.live()`, `pgmq.health.live()`,
`shibuya.health.live()` (each resolving `{status, body}`), and `keiro.health.get()`: green
when the call succeeds with 200 and reports alive/ok, amber for keiro's `schema_drift` body
(which arrives with HTTP 503 under the default refuse-on-drift policy, so the body, not the
status code, decides amber), red for any other 503 body, grey with the text "unreachable"
when the request fails at the network level. This is the same rule the shell's bottom-bar
probe applies (`degraded` for keiro drift). The keiro health card shows
`status`, the `schema_drift` list in a `collapsible` when non-empty, and the line
"mutations: disabled on server" or "mutations: enabled on server" from `mutations_enabled`
— this is a fact about the server and never a control.

Every card shows "as of <relative time>" from its query's `dataUpdatedAt`, dims while
`useLiveness().paused` is true, and refetches on `refreshAll`. `useSampleHistory(key, value, 30)`
in `features/overview/sample-history.ts` keeps the last 30 samples of the queue-age and
projection-distance headlines in memory for the trend glyph (up, down, flat versus the
previous sample).

Verify: against fixtures every card shows the fixture-derived number; switching the mock
scenario to "aggregates not mounted" (a fixture variant EP-9 provides, or a one-off MSW
override in the test) flips that card to "not mounted on this host"; pausing liveness from
the bottom bar stops the cards' refetch counter in the MSW request log; resuming refetches.

### Milestone 4 — navigation, commands, the Playwright suite, and the live-stack gate

`registerProjectionsFeature()` (one `registerFeature` call wired into
`apps/console/src/features/index.ts`) adds the Projections section's recents group and a
static "Projections" palette entry; the page entries "Status" and "Shards" are the shell's
own, the Overview section has none, and the parsed `projection <group>` jump is the
shell's (`jumpParsers`), verified here rather than re-registered. Call
`useRecordVisit({kind: "projection", label: group_id, href})` on the detail page so recent
groups appear in the palette. Add Playwright specs under `apps/console/e2e/`:
`overview/overview.spec.ts` (each card links to its section; "not mounted" state; pause
stops polling), `projections/projections.spec.ts` (distance cell values for the three
fixture cases; load more; feed update changes a row), `projections/shards.spec.ts`
(selecting a subscription shows ownership rows), and `live.spec.ts`.

The live-stack integration gate is verified in two parts. First the manual walkthrough:
with the EP-9 stack up (`just stack-up` in this repository, which starts PostgreSQL with
seeded data, `kiroku-inspect` on 9091, `pgmq-inspect` on 9095, `keiro-ops-http` on 9093, and
a shibuya-metrics server on 9090), run `bun run dev`, keep liveness on, and visit in order
`/`, `/streams`, `/categories`, `/events`, `/subscriptions`, `/queues`, `/processors`,
`/workflows`, `/process-managers`, `/timers`, `/aggregates`, `/projections`, `/shards`,
confirming each list screen shows rows from the seeded database (or the honest
"not mounted on this host" message where the host lacks hooks) and that the bottom bar's
health dots are green for all four surfaces; then run the client core's int64 round-trip
check exactly as `docs/plans/10-...` defines it (its live contract test under
`KEIRO_UI_LIVE=1`). Second, `e2e/live.spec.ts`, which is skipped unless
`KEIRO_UI_LIVE=1`, automates the same visits through `playwright.live.config.ts`
(baseURL `http://localhost:5173`, reusing the running dev server; `localhost`, not
`127.0.0.1`, so the browser's `Origin` matches the one keiro-ops-http allow-lists) and
asserts at least one
row or the not-mounted message on every list, and four healthy dots. Record the walkthrough
date, the stack's package versions, and the spec's pass line in this plan's Progress, then
tick the "Live-stack integration gate" checkbox in
`docs/masterplans/2-build-the-keiro-runtime-console.md` with the same date.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui`.

Add any missing primitives to the component package before using them (the import boundary
of ADR-8): check `packages/ui/src/components/` for `table`, `badge`, `progress`, `tooltip`,
`collapsible`, `card`, `search-field` (or `input`), and run, for each that is absent:

```bash
cd packages/ui && bunx shadcn@latest add badge progress tooltip collapsible card
```

Expected: the CLI reports each component written under `packages/ui/src/components/` using
the `aria-nova` style from `packages/ui/components.json`; commit the generated files.

Develop against fixtures, then against the live stack:

```bash
VITE_MOCK=1 bun run --filter @keiro-ui/console dev     # mock mode, no Haskell needed
just stack-up && bun run --filter @keiro-ui/console dev # live stack on 9090-9093
```

Expected: Vite prints `Local: http://localhost:5173/`; in live mode the bottom bar shows
four green dots within one poll interval.

Run the checks per milestone:

```bash
bun run check                                   # typecheck + oxlint + oxfmt --check
bun run --filter @keiro-ui/console test         # vitest, fixtures via @keiro-ui/testing
bun run --filter @keiro-ui/console test:e2e     # Playwright against the mock service worker
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/console test:e2e -- --config playwright.live.config.ts
```

Expected transcript shape for the live specification:

```text
Running 1 test using 1 worker
  ✓  e2e/live.spec.ts:12:5 › every section renders against the live stack (9.8s)
1 passed (10.1s)
```

After the walkthrough, update the gate in the MasterPlan by editing the checkbox line under
`## Progress` in `docs/masterplans/2-build-the-keiro-runtime-console.md` from `- [ ]` to
`- [x]` and appending the date and the spec's pass line in parentheses. Commit with the
trailers:

```text
feat(console): add projections, shards, and overview screens

MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md
ExecPlan: docs/plans/17-build-the-projections-and-overview-screens.md
```


## Validation and Acceptance

Required acceptance, all observable in a browser or a test transcript:

1. On `/projections` against the fixture set, three rows demonstrate the distance rule: a
   group with `serving_position_basis` `unmanaged` shows "n/a"; a group whose
   `serving_applied_position` equals the page's `visible_store_head` shows "caught up"; a
   group behind the head shows the exact difference as a number with thousands separators,
   computed in `bigint` (a fixture whose positions exceed 2^53 must still show the exact
   difference). The column header reads "global position distance"; the strings "lag" and
   "backlog" appear nowhere in `apps/console/src/features/projections/` or
   `features/overview/` (a vitest assertion greps the rendered DOM of both pages).
2. A scripted `projection_groups` feed emitting `update {changed: [row]}` changes that row's
   cells without a new `/keiro/projection/status` request appearing in the mock server's
   request log; `update {removed: [{group_id}]}` removes the row; an `error {code: "queue_overflow"}`
   frame causes exactly one refetch.
3. `/projections/<group>?subscription=<name>` shows the members table with the server's
   `global_position_distance` per member and `maximum_global_position_distance` in the
   summary; without `?subscription=` the limitation sentence is visible and no
   `/keiro/projection/position` request is made.
4. `/shards?subscription=<name>` shows ownership rows and the unowned count; without the
   parameter only the list half renders.
5. On `/`, each of the seven cards shows its fixture-derived headline and navigates to its
   section when activated by mouse and by keyboard; the "newest 500 instances" prefix and
   "500+" suffix appear exactly when the workflow fixture page has a `next_cursor`; the
   aggregates card shows "not mounted on this host" under the not-mounted fixture variant;
   the keiro health card shows "mutations: disabled on server" for the default fixture.
6. Pausing liveness from the bottom bar stops all Overview requests (the mock request log
   gains no entries for 20 s); resuming issues one request per card immediately.
7. The live-stack integration gate: the manual walkthrough is recorded in Progress with
   date and versions, and `KEIRO_UI_LIVE=1 … live.spec.ts` passes against the EP-9 stack.

Proposals for additional scope (not required): sparklines on the queues and projections
cards using the sample history; a "copy as of" action on cards; a projections column
filter by lifecycle phase.


## Idempotence and Recovery

Every step is additive and repeatable. Re-running `shadcn add` for a component that already
exists prompts before overwriting; answer no unless you intend to refresh it. Route files
regenerate `routeTree.gen.ts` automatically under `bun run dev`; if the generated tree is
stale after a rename, run `bun run --filter @keiro-ui/console generate-routes`. Fixture
variants are files under `packages/testing/fixtures/keiro/`; adding the "aggregates not
mounted" variant is a new file, never an edit to an existing recording. If the live stack
is unavailable, every milestone except the gate in M4 is fully verifiable against
fixtures; the gate waits, and this plan stays In Progress rather than claiming it. If
`playwright.live.config.ts` finds no dev server, it fails fast with a connection error
rather than starting one, so start `bun run dev` first.


## Interfaces and Dependencies

**Prerequisites (parent-declared).** Hard: `docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`
Complete (shell contracts named below); `docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`
Complete; `docs/plans/12-implement-the-keiro-typed-client.md` Complete. Soft:
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` for fixtures,
the scripted feed, and the live stack; `docs/plans/13-...`, `14-...`, `15-...`, `16-...`
for the sections the Overview links to and for the `data-table` and `RouteUnavailable`
conventions they establish.

**Consumed from `@keiro-ui/client-keiro`** (names as the MasterPlan's "keiro client
specifics" fixes them; if EP-12 exported a different identifier, adapt the import, never the
behaviour): `projections.status({limit?, after?})`, `projections.position({subscription})`,
`shards.list()`, `shards.status({subscription})`, `health.get()`,
`workflows.list({ordering, limit, after?})`, `timers.pending({limit, after?})`,
`timers.stuck({})`, `aggregates.types()`, `health.get()` (resolves with the body on 200 and
503), the `keiroKeys` factory, and `useProjectionGroupsFeed({enabled?, onResync?})` from
`@keiro-ui/client-keiro/feeds` (EP-12's hook, which does the cache merge). Positions are
`bigint`; cursors are opaque strings echoed back unchanged.

**Consumed from `@keiro-ui/client-kiroku`**: `checkpoints.inventory()`,
`metrics.all()` (may reject with an `ApiError` whose code is `legacy_error` when `/metrics`
is disabled), `health.live()` (resolves `{status, body}`). From `@keiro-ui/client-pgmq`:
`metrics.all()`, `health.live()`. From `@keiro-ui/client-shibuya`: `health.ready()` and
`health.live()` (each resolves `{status, body}` on 200 and 503).

**Consumed from `@keiro-ui/client-core`**: `useSurfaceQuery`, `useLiveness`,
`useCursorPages` (the "load more" adapter, for the projections table), `ApiError`, and the
per-surface query key factories.

**Consumed from the shell (`apps/console/src/shell/*`, `lib/*`)**: `features.ts`
(`registerFeature`), `commands.ts` (`useRegisterCommands`), `recent.ts` (`useRecordVisit`),
`status-slots.tsx` (`useStatusSlot("store-head", ...)`), `lib/links.ts` builders
(`links.projections()`, `links.projection(group)`, `links.shards({subscription?})`,
`links.subscription(name)`, `links.queues()`, `links.workflows()`, `links.processors()`,
`links.aggregates()`, `links.timers()`), and `lib/format.ts` (`formatPositionDistance`,
`formatInt`, `formatDuration`, `formatRelativeTime`).

**Provided to later plans**: `features/overview/stat-card.tsx` (`StatCard`),
`features/overview/health-strip.tsx` (`HealthStrip`), `features/projections/distance-cell.tsx`
(`DistanceCell`) and `features/projections/distance.ts` (`positionDistance`), reusable by
`docs/plans/19-add-gated-operator-actions.md`, which reads `mutations_enabled` from the
same keiro health query to decide whether to render enabled or disabled actions.

**Candidate improvement requests to keiro** (to be filed from this repository if this plan
confirms the gaps against the live stack; not dependencies): expose the feeding
subscription name on `/projection/status` rows; add a status-class count read for
workflows; both carry `origin: mori://shinzui/keiro-ui` and cite
`docs/architecture/ui-direction.md`.
