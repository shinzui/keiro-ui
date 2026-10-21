---
id: 16
slug: build-the-aggregates-process-managers-and-timers-screens
title: "Build the Aggregates, Process Managers, and Timers screens"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
---

# Build the Aggregates, Process Managers, and Timers screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

An **aggregate** is the unit of consistency in an event-sourced application built on the
keiro runtime: a named kind (for example `Order`) whose every instance is one stream of
events in the kiroku event store, and whose "current state" is the fold of those events.
A **process manager** is a long-lived coordinator that reacts to events, keeps its own
journal stream, and waits for inputs or **timers** (scheduled wake-ups it asked keiro to
fire later). No surveyed operations console treats the aggregate as a first-class object;
`docs/architecture/ui-direction.md` declares the aggregate browser — "its event stream and
folded current state side by side, with snapshot metadata" — the console's differentiation
surface, alongside live process-manager state.

After this plan, an operator running the console (`pnpm dev` in this repository, or the
deployed bundle) can open **Aggregates**, pick a kind, page through its instances, and
open one to see the raw events of its stream on the left and the folded state, hydration
source, and snapshot health on the right; open **Process managers**, pick a manager and a
correlation, and see its state, what it is waiting for, its last reaction with provenance,
and its pending timers; and open **Timers** to watch the pending-timer ledger live, filter it
by manager and correlation, switch to the stuck-timer view, and inspect any timer's payload
in the right sheet. Every identifier is a hyperlink into the Streams section. Nothing here
mutates anything: timer requeue and cancel arrive only with
`docs/plans/19-add-gated-operator-actions.md`.

You can see it working by starting the local runtime stack of
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` (or the mock mode
`VITE_MOCK=1 pnpm dev`), opening `http://localhost:5173/timers`, and watching a timer row
update without reloading when its state changes; then opening an aggregate instance and
seeing both panes populated. When the keiro host behind the console does not mount the
aggregate and process-manager inspection hooks (today's standalone hosts do not), the
Aggregates and Process managers pages say so plainly instead of showing an error.


## Progress

- [ ] M1 — Aggregates: `/aggregates` lists mounted kinds, `/aggregates/$type` pages
  instances with cursor paging and the explained `skipped` count, and
  `/aggregates/$type/$id` shows raw kiroku events beside folded state with the hydration
  badge, snapshot card (mismatch warning visible on an incompatible fixture), persisted
  split ratio, and the projections note; vitest passes on fixtures.
- [ ] M2 — Process managers: `/process-managers` explains name discovery and lists
  configured and recent names, `/process-managers/$name` pages instances, and
  `/process-managers/$name/$correlation` renders the state, "Waiting for", "Last
  reaction" (with provenance status), pending-timers, and journal link panels, plus the
  "no instance" state for a `null` response; vitest passes on fixtures.
- [ ] M3 — Timers: `/timers` pages pending timers with URL filters, updates live through
  the `timers` feed with an "as of" stamp, offers the Stuck tab, and opens the `timer`
  right sheet; vitest passes with the scripted feed.
- [ ] M4 — Shell integration and end-to-end: not-mounted states for both hook-gated
  sections (including the Overview card text), sidebar entries, commands, recents, and the
  Playwright suite pass in mock mode; a live-stack smoke against the EP-9 stack records
  which routes were exercised.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Process-manager names are not discoverable from keiro's HTTP surface (only
  `pm show` and `pm list` exist, both requiring `--name`), so the index page reads names
  from the connection profile's optional `processManagerNames` list and from the
  recent-entities store, states on screen that discovery is not exposed, and this plan
  records a candidate improvement request to keiro for a `pm types` read. No name is ever
  guessed from aggregate categories or stream prefixes.
  Rationale: inventing discovery client-side would mean parsing stream names, which the
  conventions forbid (cursors and names are opaque); an honest empty state plus a filed
  request keeps pressure where ownership is (ADR-5 consequence).
  Date: 2026-10-21

- Decision: A hook-gated keiro route that is not mounted surfaces in the client as the typed
  refusal `RouteUnavailable` (defined by `docs/plans/12-implement-the-keiro-typed-client.md`
  from the 400 `invalid_request` the ops router returns for an unknown command word), and
  every page in this plan renders that refusal as a dedicated "not mounted on this host"
  empty state, never as a generic error toast.
  Rationale: the MasterPlan records that no runnable keiro host mounts these hooks today;
  an operator pointing the console at such a host must learn what to run, not that
  "something failed".
  Date: 2026-10-21

- Decision: The stuck-timer view and the pending-timer view are two tabs of one `/timers`
  route (`tab=pending|stuck`) rather than two routes, because they share columns, the
  timer sheet, and the manager/correlation link builders; the stuck view polls only (keiro
  exposes no stuck feed) and renders a reduced column set because `/timer/stuck/list`
  returns a bare array without `last_error`, `due_in_seconds`, or `observed_at`.
  Rationale: keeps one sidebar entry per concept and one place for timer rendering; the
  column difference follows the wire shapes, which the console never pads.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

This repository, keiro-ui, is a pnpm workspace (created by
`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`) holding the React +
TypeScript + Vite console `apps/console` (published name `@keiro-ui/console`), the owned
component package `packages/ui` (`@keiro-ui/ui`, shadcn/ui components generated on the
React Aria base — every UI primitive a screen uses is imported from
`@keiro-ui/ui/components/<name>` and nowhere else), the client core
`packages/client-core`, the typed clients `packages/client-<surface>`, and the
fixtures-and-mocks package `packages/testing`. Routing is TanStack Router with file-based
routes under `apps/console/src/routes/`; server state is TanStack Query. The parent
MasterPlan, `docs/masterplans/2-build-the-keiro-runtime-console.md`, fixes the shared
contracts this plan consumes; read its "Shell contracts", "Client-core contracts", "keiro
client specifics", "Cross-entity link map", and "Vocabulary and display rules" before
starting.

**The surfaces this plan reads.** Two owning projects serve the data, each through its own
HTTP surface reached on the console's origin under a fixed prefix (in development the Vite
dev server proxies `/keiro` to `keiro-ops-http` on port 9093 and `/kiroku` to
`kiroku-inspect` on port 9091; in deployment a host or reverse proxy composes them at the
same prefixes):

- **keiro** (`keiro-ops-http`, the HTTP transport over the `keiro-ops` command tree; cross-repo
  decision `mori://shinzui/keiro/okf/adrs/concepts/ADR-53`): path segments are command
  words, query keys are `snake_case` versions of CLI flags, reads are `GET`, and a
  successful read returns the command's JSON unwrapped. The routes this plan uses, with
  their flags as the ops parsers in `keiro-ops/src/Keiro/Ops/Aggregate.hs`,
  `keiro-ops/src/Keiro/Ops/ProcessManager.hs`, and `keiro-ops/src/Keiro/Ops/Timer.hs` of
  the keiro repository define them:
  - `GET /keiro/aggregate/types` → `{"items":[{name, category, snapshots_configured, snapshot_policy}]}`
  - `GET /keiro/aggregate/list?name=&limit=&after=` (limit default 50, 1..500) →
    `{name, category, items:[{aggregate_id, stream_name, stream_version, created_at, deleted_at, truncate_before}], skipped, next_cursor?}`
  - `GET /keiro/aggregate/show?name=&id=` → the aggregate view (fields listed under M1)
  - `GET /keiro/aggregate/snapshot?name=&id=` → the snapshot status (fields listed under M1)
  - `GET /keiro/pm/list?name=&limit=&after=` (limit default 50, 1..500) →
    `{items:[{correlation_id, stream_name, stream_version, created_at, deleted_at, truncate_before}], skipped, next_cursor?}`
  - `GET /keiro/pm/show?name=&correlation=&timer_limit=` (timer_limit default 20, 1..500) →
    the instance view (fields listed under M2), or JSON `null` when no instance exists
  - `GET /keiro/timer/pending/list?manager=&correlation=&after=&limit=` (limit default 100) →
    `{observed_at, items:[...], next_cursor?}` where each item is
    `{timer_id, process_manager_name, correlation_id, fire_at, payload, status, attempts, fired_event_id, last_error, due_in_seconds}`
  - `GET /keiro/timer/stuck/list?min_age=&min_attempts=` (`min_age` is a duration such as
    `5m` or `1h`) → a bare JSON array of `{timer_id, process_manager_name, correlation_id, fire_at, payload, status, attempts, fired_event_id}`
  - `WS /keiro/ws`, feed `timers` with filters `manager`, `correlation_id`, `limit` →
    `snapshot {feed, sequence, trigger, observed_at, items}` then
    `update {feed, sequence, trigger, observed_at, changed, removed}` keyed by `{timer_id}`;
    first page only; a sequence gap or `queue_overflow` means re-subscribe and re-poll
    (`mori://shinzui/keiro/okf/adrs/concepts/ADR-56`).

  The `aggregate` and `pm` command words exist **only when the host mounts the matching
  `AppHooks`** (`keiro-ops/src/Keiro/Ops.hs` adds them conditionally). On a host without
  the hooks the router's parser rejects the path and answers
  `400 {"error":{"code":"invalid_request","message":...,"details":{"arguments":[...]}}}`.
  Cursors (`after`, `next_cursor`) are opaque base64url strings bound to one read kind;
  the console echoes them back untouched and never inspects them. Positions and versions
  are int64 and arrive as `bigint` from the client (MasterPlan int64 rule).

- **kiroku** (`kiroku-metrics` 0.3.0.1, the event store's inspection surface): this plan
  uses only `GET /kiroku/streams/<name>/events?from=&limit=&direction=` (exclusive `from`
  stream version, default 0; `limit` default 100, cap 1000; `direction=forward|backward`,
  where `from=0` backward means "from the newest") returning `{items:[Event], next_cursor?}`
  with the published camelCase event keys (`eventId`, `eventType`, `streamVersion`,
  `globalPosition`, `payload`, `metadata`, `causationId`, `correlationId`, `createdAt`,
  plus snake_case `original_stream_name`). It is reached through the kiroku client's
  `streams.events(name, {from, limit, direction})`.

**Packages and contracts this plan depends on.**

- `packages/client-keiro` (`docs/plans/12-implement-the-keiro-typed-client.md`) exports
  `createKeiroClient({baseUrl})` with namespaces `aggregates` (`types()`, `list({name, limit, after})`,
  `show({name, id})`, `snapshot({name, id})`), `processManagers` (`list({name, limit, after})`,
  `show({name, correlation, timerLimit})`), and `timers` (`pending({manager, correlation, after, limit})`,
  `stuck({minAge, minAttempts})`), query-key factories, the hook `useTimersFeed(filters, applyToCache)`
  built on the client core's `useFeedSubscription`, zod schemas for every response, and the
  typed refusals `RouteUnavailable` (unknown command word), `SchemaDrift`, and
  `MutationsDisabled` as subclasses of the client core's `ApiError`. If any of these names
  differ when EP-12 lands, this plan's implementer adapts to EP-12's exports and records
  the difference in Surprises & Discoveries; the contract, not the spelling, is fixed by
  the MasterPlan.
- `packages/client-kiroku` (`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`)
  exports `createKirokuClient({baseUrl})` with `streams.events(...)` and the `Event` schema.
- `packages/client-core` (`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`)
  provides `ApiError`, `Page<T, Cursor>`, the `useInfiniteQuery` cursor adapter,
  `useSurfaceQuery` (poll-first with the liveness pause/resume of ADR-3), and
  `useFeedSubscription`.
- The shell (`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`)
  provides, under `apps/console/src/`: `routes/_shell.tsx` (the layout every section
  mounts under), `shell/navigation.ts` (rail sections and sidebar entries),
  `shell/commands.ts` (`useRegisterCommands`, `useRecordVisit`, the recents store),
  `shell/right-sheet.tsx` (`registerSheet(kind, Component)`, `useRightSheet().open({kind, ref})`,
  mirrored to the `sheet` search parameter), `lib/links.ts` (typed route builders),
  `lib/format.ts` (relative time, durations, bigint display), `settings/connection-profiles.ts`
  (the `ConnectionProfile` type and `useSurfaceBaseUrl`), and the `EmptyState` composition.
- `docs/plans/13-build-the-streams-and-subscriptions-screens.md` (soft) introduces
  `EventDetailSheet` (sheet kind `event`, ref `<eventId>`), `JsonViewer`, and `CursorPager`
  under `apps/console/src/features/streams/`. If EP-13 is not complete when this plan
  starts, ship minimal local versions under `apps/console/src/features/shared/` and
  reconcile to EP-13's components when both exist (record the reconciliation in the
  Decision Log).
- `packages/testing` (`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`, soft)
  provides fixtures at `packages/testing/fixtures/keiro/` and `packages/testing/fixtures/kiroku/`,
  MSW handlers, and scripted feeds under `packages/testing/src/feeds/keiro.ts`. Because no
  runnable keiro host mounts the aggregate and process-manager hooks (MasterPlan,
  Surprises & Discoveries), EP-9 hand-derives the `aggregate/*` and `pm/*` fixtures from
  keiro's JSON encoders (`keiro/src/Keiro/Inspection/Aggregate.hs` and
  `keiro/src/Keiro/ProcessManager/Inspect.hs` in the keiro repository) and from the test
  seed in `keiro-ops-http/test/Main.hs`. This plan is accepted against those fixtures; the
  live-stack smoke in M4 covers timers and records the aggregate/PM routes as "not mounted"
  until a host exists.

**Relevant decisions.** Locally, in `docs/adr/`: [ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md)
— the timers feed only shortens latency; `/timer/pending/list` polling stays authoritative
and any feed doubt triggers a refetch; [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md)
— this plan ships no mutation; timer requeue, cancel, and dead-letter are deferred to
`docs/plans/19-add-gated-operator-actions.md`; [ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
— UI primitives come only from `@keiro-ui/ui`. Cross-repository, by Mori handle:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` (inspection surfaces are a bounded exception
to keiro's no-UI stance: hosts mount hooks explicitly, which is why these routes may be
absent), `ADR-54` (aggregate inspection reuses the application's hydration path without
diagnostics — `hydration.source` tells the operator whether a snapshot was used, and a
`full_replay` carries a `reason`), `ADR-55` (legacy reaction provenance is bounded,
explicit opt-in metadata — `provenance_status` may be `unavailable` or `truncated`, and
the console says so rather than inferring), `ADR-56` (feeds are bounded shared drivers with
no replay cursor), and `ADR-28` (position vocabulary: `global_position` is shown by that
name; any distance is a "global position distance", never "lag").

**Terms.** *Hydration* is how keiro rebuilt the state it shows: from a stored snapshot plus
later events (`snapshot`) or by replaying every event (`full_replay`). A *snapshot* is a
stored copy of folded state at some stream version; its *compatibility* says whether the
stored shape still matches the running code. *Correlation id* is the key identifying one
process-manager instance. A *cursor* is an opaque token for "the next page". A *right sheet*
is the console's slide-in inspector panel on the right edge, addressed by the `sheet` URL
parameter so it can be shared.


## Plan of Work

All application code lives in `apps/console/src/`. Routes go under `routes/aggregates/`,
`routes/process-managers/`, and `routes/timers/` as file-based TanStack routes mounted
under the shell layout; feature code goes under `features/aggregates/`,
`features/process-managers/`, and `features/timers/`; shared pieces introduced here go
under `features/shared/`. Every list route validates its search parameters with a zod 4
schema passed as `validateSearch`, so filters, cursors, tabs, and the `sheet` parameter are
all in the URL.

### Milestone 1 — the aggregate browser

Scope: three routes and the side-by-side browser. At the end an operator can navigate kind
→ instance → browser, and the browser shows raw events and folded state together.

`routes/aggregates/index.tsx` (`/aggregates`) queries `aggregates.types()` through
`useSurfaceQuery` and renders a table (`@keiro-ui/ui/components/table`) with columns name,
category (linking to `/categories/<category>` via `links.category`), snapshots configured
(a badge), and snapshot policy; each row links to `links.aggregateType(name)`. A
`RouteUnavailable` refusal renders the not-mounted state described in M4 (build the
component here, reuse it later).

`routes/aggregates/$type.tsx` (`/aggregates/$type`) validates search `{after?: string, limit?: number}`
and pages `aggregates.list({name: type, limit, after})` with the client core's cursor
adapter and `CursorPager`. Columns: aggregate id (link to the browser), stream name (link to
`links.stream(stream_name)`), stream version, created at and deleted at (relative time with
the absolute value in a tooltip), truncate before. Above the table a one-line caption reads
"N streams in category <category> skipped: not instances of <type>" when `skipped > 0`,
with a tooltip explaining that keiro lists the category's streams and skips those whose
name does not parse as this aggregate kind.

`routes/aggregates/$type.$id.tsx` (`/aggregates/$type/$id`) renders `features/aggregates/AggregateBrowser.tsx`:
a `SplitPane` (`features/shared/SplitPane.tsx`, built on `@keiro-ui/ui/components/resizable`,
persisting its ratio under the localStorage key `keiro-ui.split.aggregate-browser` and
tolerating a missing or throwing storage) whose left pane is `features/aggregates/StreamEventsPane.tsx`
— the kiroku stream `stream_name` (taken from the `aggregates.show` response, so the show
query gates the events query) paged with `streams.events(stream_name, {from, limit: 100, direction})`
newest-first by default (`direction=backward`, `from=0`), with a direction toggle, a
`CursorPager`, and rows showing stream version, event type, `globalPosition`, created at;
clicking a row opens the `event` sheet with `useRightSheet().open({kind: "event", ref: eventId})`.
The right pane is `features/aggregates/FoldedStatePane.tsx`: a header with `state_label`,
`state_version`, `stream_version`, and `HydrationBadge` (`features/shared/HydrationBadge.tsx`:
"snapshot @ v<snapshot_version>" or "full replay: <reason>" with `miss`/`detail` in a
tooltip; `hydration` may be `null` when no state was produced, rendered as "no state");
the `state` JSON in `JsonViewer`; a "History" line with `history.owner`, `history.stream_name`
(linked), and `history.head_version`; and the **snapshot card** from
`aggregates.snapshot({name, id})`: `status` present/absent, `observed_at`, the `configured`
block (policy, codec version, shape hashes — hashes truncated with copy-on-click), and when
`stored` is present its stream version, created/updated at, `age_seconds` as a duration,
`events_since`, `ahead_of_observed_head` (a warning badge when true), `compatibility`
(`compatible`/`incompatible`/`unused`), and, when `mismatched` is non-empty, a visible
warning listing the mismatched fields. Below both panes a note reads "Projections consuming
category <category>: see Projections" linking to `links.projections()` — keiro exposes no
per-category projection mapping, so the link is to the section, not a filtered view; this
is recorded as a candidate improvement request in M4's documentation step.

Deleted aggregates (`deleted_at` set) show a "deleted" badge in the header; `truncate_before > 0`
shows "history truncated before v<n>" so the operator knows the left pane cannot start at
version 1.

### Milestone 2 — process managers

Scope: the index with the discovery decision, instance paging, and the instance detail.

`routes/process-managers/index.tsx` (`/process-managers`) does not call keiro: it lists the
names from the active connection profile's optional `processManagerNames: string[]`
(added to the `ConnectionProfile` type in `settings/connection-profiles.ts` as an optional
field — coordinate with EP-8's owner; the settings page gains a text area for it) merged
with manager names seen in the recents store, each linking to `links.processManager(name)`,
plus an inline explanation: "keiro does not expose a list of mounted process managers; add
names in Settings → Connections or open one by name" with a name input that navigates on
submit. The index never sends a request with a blank name (keiro rejects it with
`invalid_request`) and never probes; the not-mounted state appears only when a later
request to `/keiro/pm/*` returns `RouteUnavailable`, so the index itself is always
reachable.

`routes/process-managers/$name.tsx` (`/process-managers/$name`) validates `{after?, limit?}`
and pages `processManagers.list({name, limit, after})`: columns correlation id (link to the
detail), stream name (link to `links.stream`), stream version, created at, deleted at,
truncate before, with the same `skipped` caption as M1 (here: "streams in the category that
are not journals of this manager").

`routes/process-managers/$name.$correlation.tsx` (`/process-managers/$name/$correlation`)
validates `{timer_limit?: number}` (default 20, 1..500) and queries
`processManagers.show({name, correlation, timerLimit})`. A JSON `null` response renders
the empty state "No instance of <name> with correlation <correlation>". Otherwise
`features/process-managers/InstanceDetail.tsx` lays out: a header with `state_label`,
`HydrationBadge`, `state_version`, `stream_version`, `observed_head_version`, and
`observed_at` ("as of"); a "State" card with `state` in `JsonViewer`; a "Waiting for"
panel (`features/process-managers/WaitingForPanel.tsx`) listing `waiting_for` as rows of
`input` → `target_state`, or "not waiting on any input" when empty; a "Last reaction" card:
`event_type`, `event_id` (link to `links.event`), `stream_version`, `global_position` (shown
under that name), `recorded_at`, then `provenance_status` as a badge — `available`,
`truncated` ("provenance bounded; some entries omitted"), or `unavailable` ("this reaction
predates provenance recording or the host opted out", per ADR-55) — and, when
`provenance` is present, its `family`, source event (link), `source_global_position`,
`source_stream_name` (link), the `dispatched_commands` table (emit index, target stream
link, event id link, witness `event_present`/`not_observed` badge), and `timer_ids` each
linking to `links.timers({manager: name, correlation})` with the id as the sheet ref; a
"Pending timers" table rendering `pending_timers.items` with the same columns as M3's
pending view and a "View all in Timers" link to `links.timers({manager: name, correlation})`
(shown when `pending_timers.next_cursor` is present or always, as a shortcut); and a
"Journal" line linking `journal_stream_name` to `links.stream(journal_stream_name)`.
`deleted_at` and `truncate_before` render as in M1.

### Milestone 3 — timers

Scope: the pending ledger with live updates, the stuck tab, and the timer sheet.

`routes/timers/index.tsx` (`/timers`) validates
`{tab?: "pending" | "stuck", manager?: string, correlation?: string, after?: string, limit?: number, min_age?: string, min_attempts?: number, sheet?: string}`.
A filter bar (`@keiro-ui/ui/components/input-group` and `field`) edits `manager` and
`correlation`; submitting replaces the search params and resets `after`. The pending tab
pages `timers.pending({manager, correlation, after, limit})` through the cursor adapter and
shows the page's `observed_at` as "as of <relative>" next to the liveness indicator;
columns: timer id (opens the `timer` sheet), manager (link to `links.processManager(name)`),
correlation (link to the instance detail), fire at (relative text built from
`due_in_seconds` — "due in 2m" / "overdue by 40s" — with the absolute `fire_at` in a
tooltip), status (badge), attempts, last error (truncated, full text in the sheet), fired
event (link to `links.event(fired_event_id)` when present).

Live updates: `features/timers/useLiveTimers.ts` calls `useTimersFeed({manager, correlation_id: correlation, limit}, applyToCache)`
only when `after` is undefined (the feed covers the first page only; deeper pages poll).
`applyToCache` replaces the page on `snapshot`, upserts `changed` and deletes `removed`
by `timer_id` on `update`, updates the displayed `observed_at` from the frame, and on
`queue_overflow` or a `sequence` gap calls the query's refetch and re-subscribes (the client
core's `onResync`). The server refreshes this feed at most every 5 s, so the "as of" stamp
is what tells the operator how fresh the ledger is; polling continues underneath per ADR-3
and the shell's pause control stops both.

The stuck tab (`tab=stuck`) polls `timers.stuck({minAge: min_age, minAttempts: min_attempts})`
with a small form for `min_age` (free text validated against keiro's duration syntax such
as `5m`, `1h`; invalid input is rejected client-side with the same message keiro would
return) and `min_attempts`; it renders timer id, manager, correlation, fire at (absolute,
since no `due_in_seconds` is served), status, attempts, fired event, and no "as of" stamp
(the response has none). A short explanatory line defines "stuck": timers in the firing
state longer than `min_age` or claimed more than `min_attempts` times.

`features/timers/TimerSheet.tsx` is registered with `registerSheet("timer", TimerSheet)`
and resolves its ref (a timer id) from the current page's cache (pending or stuck). keiro
exposes no timer-by-id read, so when the row is not in the cache the sheet shows "timer
<id> is not on the current page" with a link that clears the filters; otherwise it shows
every field plus `payload` in `JsonViewer` and `last_error` in full. No requeue, cancel, or dead-letter button exists in this plan; the sheet footer
carries the static note "operator actions arrive with gated actions (read-only release)".

### Milestone 4 — shell integration, not-mounted states, and end-to-end

Scope: everything that makes these pages part of the console.

`features/shared/NotMountedState.tsx` renders the `RouteUnavailable` refusal for the
`aggregate` and `pm` families: title "Aggregate inspection is not mounted on this keiro
host" (or "Process-manager inspection ..."), a sentence explaining that keiro exposes these
reads only when the application mounts its inspection hooks
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-40`), the exact prefix that was probed
(`/keiro/aggregate/types`), and a link to `dev/README.md` (written by EP-9) for how to run a
host that mounts them. The Overview card for this section (owned by
`docs/plans/17-build-the-projections-and-overview-screens.md`) shows the same title; this
plan exports `aggregatesMountedQuery()` from `features/aggregates/queries.ts` so EP-17 can
reuse the probe.

Navigation: extend `shell/navigation.ts` with the Aggregates section (sidebar: "Aggregate
kinds", recent aggregates) and the Process managers & Timers section (sidebar: "Process
managers", "Timers", "Stuck timers" → `/timers?tab=stuck`, recent instances). Commands:
register `aggregate <type>/<id>`, `pm <name>/<correlation>`, and `timer <id>` parsed
commands with `useRegisterCommands`, plus static entries for the four pages. Recents: call
`useRecordVisit` on the aggregate browser, the instance detail, and the timer sheet.
Formatting: positions and versions display through `lib/format.ts`'s bigint helpers; the
word "lag" never appears.

Documentation: operator documentation stays in the sections' empty states plus a
paragraph in `apps/console/README.md` ("Sections" → Aggregates, Process managers, Timers);
no separate guide is written. Record the two candidate improvement requests to keiro (a
`pm types` read listing mounted managers; a per-category projection mapping) in this plan's
Outcomes & Retrospective so the MasterPlan can file them.

Tests are described in Validation and Acceptance.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated. Confirm the prerequisites first:

```bash
pnpm install
pnpm --filter @keiro-ui/client-keiro exec tsc --noEmit
pnpm --filter @keiro-ui/client-kiroku exec tsc --noEmit
/bin/ls apps/console/src/shell apps/console/src/lib packages/testing/fixtures/keiro
```

Expect the three directories to exist and the client packages to type-check; if
`packages/testing/fixtures/keiro/aggregate-types.json` (or EP-9's equivalent) is missing,
hand-derive the fixtures as described in Context and Orientation before continuing, and
note the gap in Surprises & Discoveries.

Add any missing primitive to the component package before using it (this plan expects
`resizable`, `table`, `badge`, `tooltip`, `tabs`, `input-group`, `field`, `card`, `empty`,
`sheet`, `kbd` to exist from EP-7/EP-8/EP-13; `resizable` is the most likely addition):

```bash
cd packages/ui && pnpm dlx shadcn@latest add resizable && cd ../..
git status --short packages/ui
```

Create the route and feature files named in Plan of Work, then regenerate the route tree
and type-check:

```bash
pnpm --filter @keiro-ui/console exec tsr generate
pnpm check
```

Expected: `pnpm check` ends with the oxlint and oxfmt summaries reporting zero errors and
`tsc` producing no output.

Run the unit tests and the end-to-end suite in mock mode:

```bash
pnpm --filter @keiro-ui/console test -- aggregates process-managers timers
VITE_MOCK=1 pnpm --filter @keiro-ui/console test:e2e -- tests/e2e/aggregates.spec.ts tests/e2e/process-managers.spec.ts tests/e2e/timers.spec.ts
```

Expected transcript tail:

```text
 ✓ src/features/aggregates/AggregateBrowser.test.tsx (6 tests)
 ✓ src/features/process-managers/InstanceDetail.test.tsx (5 tests)
 ✓ src/features/timers/useLiveTimers.test.ts (4 tests)
 Test Files  3 passed
  3 passed (… tests)
Running 9 tests using 1 worker
  9 passed
```

For the live-stack smoke (M4), start the EP-9 stack in another terminal, then:

```bash
just stack-up          # from docs/plans/9: postgres, seed, kiroku-inspect, pgmq-inspect, keiro-ops-http
pnpm dev
```

Open `http://localhost:5173/timers`, confirm rows appear and the "as of" stamp advances;
open `http://localhost:5173/aggregates` and confirm the not-mounted state names
`/keiro/aggregate/types` (today's hosts do not mount the hooks). Record both observations
with a timestamp in Progress.


## Validation and Acceptance

Acceptance is what an operator sees, in mock mode (`VITE_MOCK=1 pnpm dev`, backed by
EP-9's fixtures and scripted feeds) unless stated.

**M1.** Visiting `/aggregates` shows a table of kinds whose first row is the fixture's
first kind with its category badge; clicking it opens `/aggregates/<kind>` showing the
fixture's instances and, when the fixture page has `skipped: 3`, the caption "3 streams in
category … skipped". Clicking an aggregate id opens the browser: the left pane lists events
newest-first with the stream version of the first row equal to the fixture's
`stream_version`, the right pane shows `state_label`, the hydration badge ("snapshot @ v…"
for the snapshot fixture and "full replay: snapshot_missed" for the replay fixture), the
state JSON, and the snapshot card; with the fixture whose `stored.compatibility` is
`incompatible`, a warning lists the mismatched field names. Dragging the split and reloading
keeps the ratio. Clicking an event row opens the right sheet and adds `sheet=event:<id>` to
the URL. `vitest` covers: the `skipped` caption, hydration badge variants, the mismatch
warning, and that the events query is not issued before `aggregates.show` resolves.

**M2.** `/process-managers` with a profile listing `["order-fulfillment"]` shows that name
and the discovery note; entering `shipping` in the name input navigates to
`/process-managers/shipping`. `/process-managers/<name>` pages instances. The detail
renders all five panels for the full fixture; for the fixture with `waiting_for: []` the
panel says "not waiting on any input"; for `provenance_status: "truncated"` the badge and
note appear; for the `null` fixture the "No instance …" state appears; the journal link
points at `/streams/<journal_stream_name>`. `vitest` covers the `null` case, the three
provenance statuses, and the timers link's search params.

**M3.** `/timers` lists the fixture page with "as of" shown; setting manager and
correlation in the filter bar updates the URL (`?manager=…&correlation=…`) and the request;
with the scripted feed, an `update` frame carrying one `changed` item and one `removed`
key changes the table without a reload and advances "as of"; a scripted `queue_overflow`
error triggers one refetch (assert the mock handler's call count) and a re-subscribe.
Pausing liveness in the bottom bar stops both polling and the feed (no further requests for
15 s); resuming refetches immediately. `?tab=stuck&min_age=5m` lists the stuck fixture
without an "as of" stamp; `min_age=five` is rejected inline. Clicking a timer id opens the
sheet with the payload JSON and no action buttons.

**M4.** With the MSW handler for `/keiro/aggregate/types` returning
`400 {"error":{"code":"invalid_request","message":"…","details":{"arguments":["aggregate","types"]}}}`,
`/aggregates` shows the not-mounted state naming `/keiro/aggregate/types` and linking to
`dev/README.md`; the same for `/process-managers/<name>` via `/keiro/pm/list`. The sidebar
shows the entries listed in M4; ⌘K with `timer 7b…` opens `/timers` with the sheet; the
three recents appear after visiting. Playwright: `tests/e2e/aggregates.spec.ts` (kind →
instance → browser with both panes and the split persisted), `tests/e2e/process-managers.spec.ts`
(detail panels and the null state), `tests/e2e/timers.spec.ts` (filter round trip, feed
update, stuck tab, sheet), and `tests/e2e/not-mounted.spec.ts`. The live-stack smoke is
recorded in Progress with the routes exercised.

Required acceptance is the four milestones above. Proposals that are not required:
virtualized event lists for very long streams; a "diff against snapshot" view; any action.


## Idempotence and Recovery

Every step is additive and re-runnable: regenerating the route tree, re-running
`shadcn add` (it refuses to overwrite without `--overwrite`), and re-running tests are
safe. If a shared component from EP-13 lands mid-way, replace the local copies under
`features/shared/` with imports and delete the copies in one commit. If the split-ratio
localStorage value is corrupt, `SplitPane` falls back to 50/50 and overwrites it. If a
fixture shape disagrees with keiro's encoder, fix the fixture in `packages/testing` and note
the source line; never adapt the screen to a wrong fixture. Nothing in this plan writes to
any server.


## Interfaces and Dependencies

Libraries whose choice matters: `@tanstack/react-router` (file routes, `validateSearch`
with zod 4), `@tanstack/react-query` (via the client core hooks), `react-aria-components`
only through `@keiro-ui/ui`, `react-resizable-panels` only through
`@keiro-ui/ui/components/resizable`.

Consumed interfaces, by full path:

- `packages/client-keiro/src/index.ts`: `createKeiroClient`, `aggregates.*`,
  `processManagers.*`, `timers.*`, `useTimersFeed`, `RouteUnavailable`, the response
  schemas `AggregateTypes`, `AggregateListPage`, `AggregateView`, `SnapshotStatus`,
  `ProcessManagerInstancePage`, `ProcessManagerInstanceView`, `PendingTimerPage`,
  `StuckTimer[]`.
- `packages/client-kiroku/src/index.ts`: `createKirokuClient`, `streams.events`, `Event`.
- `packages/client-core/src/live.ts`: `useSurfaceQuery`, `useFeedSubscription`, `useLiveness`.
- `apps/console/src/shell/{navigation,commands,right-sheet}.ts(x)`, `apps/console/src/lib/{links,format}.ts`,
  `apps/console/src/settings/connection-profiles.ts` (extended here with
  `processManagerNames?: string[]`).

Provided interfaces, by full path, for later plans: `apps/console/src/features/shared/SplitPane.tsx`,
`apps/console/src/features/shared/HydrationBadge.tsx`, `apps/console/src/features/shared/NotMountedState.tsx`,
`apps/console/src/features/process-managers/WaitingForPanel.tsx`,
`apps/console/src/features/timers/TimerSheet.tsx` (sheet kind `timer`, ref `<timer_id>`),
`apps/console/src/features/aggregates/queries.ts` (`aggregatesMountedQuery`, used by EP-17's
Overview card), and the link builders this plan asks EP-8 to add if absent:
`links.aggregateType`, `links.aggregate`, `links.processManager`, `links.processManagerInstance`,
`links.timers({manager?, correlation?, tab?})`.

Prerequisites declared by the parent: `docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`,
`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`, and
`docs/plans/12-implement-the-keiro-typed-client.md` must be Complete before this plan
starts; `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` and
`docs/plans/13-build-the-streams-and-subscriptions-screens.md` are soft and handled by the
fallbacks above.
