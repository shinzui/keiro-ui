---
id: 15
slug: build-the-workflows-screens
title: "Build the Workflows screens"
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

# Build the Workflows screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

keiro runs **durable workflows**: long-lived, resumable programs whose every step is
recorded in a journal (an append-only event stream in the kiroku store) so that a crashed
or restarted process continues exactly where it stopped. An operator of an application
built on keiro needs to answer, from a browser: which workflow instances exist, which are
running, retrying, sleeping, or waiting for an external signal, which have failed and why,
what each one has done so far and how long each step took, which child workflows it
started, and which external promises ("awakeables") it is waiting on.

After this plan, the console at `apps/console` has a **Workflows** section. `/workflows`
lists instances with filters for status class, workflow name, and time windows, pages
through them with server cursors, and updates live as instances change. `/workflows/$name/$id`
shows one instance: its header, a journal rendered as a grouped timeline with lenses and
derived step durations, its step index, its children, and its awakeables; any journal entry
opens in the right sheet with its payload and links into the event store. Everything is
read-only. The section is reachable from the left rail, the sidebar (with preset filters),
and the ⌘K command palette, and recently visited instances appear in recents.

You can see it working by starting the local runtime stack and the console, running
keiro's workflow sample scenario, and watching the list change without a reload:

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro-ui
just stack-up            # from docs/plans/9: Postgres, kiroku-inspect, pgmq-inspect, keiro-ops-http on 9093
bun run dev                 # console on http://localhost:5173
# in another shell, in the keiro repository:
just jitsurei-workflow   # seeds and runs the workflow sample against the stack database
```

Open `http://localhost:5173/workflows`: rows appear and their status badges move from
`running` to `completed` while the page stays open. Click a row: the journal timeline shows
the recorded steps in order with the time between them.


## Progress

- [ ] M1 — `/workflows` lists instances with URL-held filters, cursor paging, and the
  `workflows` feed reconciling the first page; the live-stack check (MasterPlan early check 3)
  passes and is recorded with evidence.
- [ ] M2 — `/workflows/$name/$id` renders the header, URL-held tabs, and a journal timeline
  with lenses, grouping by step, generation selection, and infinite cursor paging.
- [ ] M3 — Journal entries open a `journal-entry` right sheet with payload and store links;
  derived step segments are shown; Steps, Children, and Awakeables tabs link out correctly.
- [ ] M4 — Navigation is wired (rail, sidebar presets, palette commands, recents), and the
  vitest and Playwright suites for the section pass in mock mode.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The Workflows section ships no actions. keiro-ops exposes `cancel`,
  `resurrect`, `lease release`, `awakeable signal/cancel`, and `gc` as preview/confirm
  mutations over HTTP, and the direction document lists cancel/resurrect/lease as workflow
  actions, but this plan renders none of them, and docs/plans/19-add-gated-operator-actions.md
  deliberately limits itself to processor pause/resume, timer requeue/cancel, and queue
  dead-letter redrive. Workflow mutations are deferred beyond this initiative.
  Rationale: ADR-7 (read-only first); the workflow verbs change durable execution state
  and deserve their own guardrail design after the read-only console has been used in anger.
  Date: 2026-10-21

- Decision: Step durations and "time to first step" are computed in the browser from
  consecutive `recorded_at` values and the instance's `created_at`; they are labelled as
  derived in the UI and never presented as server facts. No waiting-versus-executing
  classification is attempted beyond that, because the journal does not record when a
  suspension began.
  Rationale: the journal wire format carries `recorded_at` per entry and nothing about
  wall-clock waiting; inventing a classification would mislead operators.
  Date: 2026-10-21

- Decision: The "journal stream" link to the kiroku stream browser is omitted. Neither the
  instance header nor the journal entries expose the journal stream name on the wire;
  entries carry `global_position` and `event_id`, so links go to the `$all` log and the
  event detail instead. A candidate improvement request to keiro ("expose the journal
  stream name per generation in the instance header") is recorded here, not filed by this
  plan unless the implementer confirms the gap against the audited commit.
  Rationale: the console never fabricates stream names (the generation stream naming
  function is a keiro implementation detail that could change).
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

This repository, keiro-ui, holds the browser console for applications built on the keiro
runtime. Read the parent MasterPlan, `docs/masterplans/2-build-the-keiro-runtime-console.md`,
for the initiative's vision, the audited endpoint inventory, and the shared contracts this
plan consumes; read `docs/architecture/ui-direction.md` for the screen's design intent
(the workflow list and detail are "the durable-execution centerpiece, in Restate's mold":
a list paged by status class, type, and age; a detail that renders the journal as a
timeline with event grouping and multiple lenses, Temporal's pattern; and distinct
queue-delay and execution segments, Inngest's pattern).

**Terms.** A *workflow definition* has a name (`workflow_name`); an *instance* of it has an
id (`workflow_id`); the pair identifies it everywhere. An instance's *journal* is the event
stream that records each completed step; each *generation* of a journal is one stream — a
workflow that "continues as new" starts generation N+1 and its header's `generation` moves
on, while older generations remain readable by number. The *step index* is a derived
table of step name, recorded result, and time, one row per step of one generation. A
*child* is a workflow started by this instance; `await_step` names the parent's step that
waits for it. An *awakeable* is an external promise the workflow waits on until someone
signals it. The *wake ledger* is keiro's `keiro_workflows` table, the single row per
instance that says whether and when it must be woken (`mori://shinzui/keiro/okf/adrs/concepts/ADR-23`:
discovery is exact and the instance row is the complete ledger). The list screen is a
view over that ledger. A *status class* is the seven-way summary the surface derives
from the row: `running` (status running, attempts 0), `retrying` (running with attempts
above 0), `sleeping` (suspended with `wake_after` set), `awaiting` (suspended without),
`completed`, `cancelled`, `failed` — the source is `statusClassOf` in
`keiro/src/Keiro/Workflow/Inspection.hs` in the keiro repository. The `status` field is
the raw status text (`running`, `suspended`, `completed`, `cancelled`, `failed`); the
badge shows the class and the tooltip shows the raw status.

**Where things live after the prerequisite plans.** The workspace is a bun workspace
(docs/plans/7-scaffold-the-console-workspace-and-design-system.md). The application is
`apps/console`; UI primitives come only from `@keiro-ui/ui/components/<name>` (ADR-8,
`docs/adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md`);
a primitive this plan needs that is missing from `packages/ui` is added there with
`bunx shadcn@latest add <name>` and committed, never imported from
`react-aria-components` directly. The shell (docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md)
provides, under `apps/console/src/`: the route tree layout with one directory per section
(this plan's routes go in the Workflows section directory the shell established, expected
to be `apps/console/src/routes/_shell/workflows/`; follow whatever directory the shell
actually created), `shell/navigation.ts` (rail sections and sidebar entries that this plan
extends), `shell/commands.ts` (`useRegisterCommands` and the recents store fed by
`useRecordVisit`), `shell/right-sheet.tsx` (`registerSheet(kind, Component)` and
`useRightSheet().open({kind, ref})`, mirrored to the `sheet` search parameter),
`lib/links.ts` (typed route builders — every cross-entity hyperlink goes through them),
and `lib/format.ts` (relative time, durations, bigint display). The keiro client
(docs/plans/12-implement-the-keiro-typed-client.md) is `@keiro-ui/client-keiro`, built on
`@keiro-ui/client-core` (docs/plans/10-...): `createKeiroClient({baseUrl})` exposes the
`workflows` namespace (`list`, `header`, `journal`, `steps`, `children`, `awakeables`),
zod-validated types, cursors branded per read kind, the `workflows` feed dialect with
`useWorkflowsFeed(filters, options)` and the pure cache-merge function for its frames, and
the query-key factory `keiroKeys.workflows.*`. From client-core this plan uses
`useCursorPages` (the `useInfiniteQuery` adapter that echoes `next_cursor` back as `after`),
`useSurfaceQuery` (polling with the adaptive clamp), and `useLiveness` (the global
pause/resume state the bottom bar controls). Fixtures and mock handlers come from
`@keiro-ui/testing` (docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md):
recorded keiro responses under `packages/testing/fixtures/keiro/` and scripted feed frames
in `packages/testing/src/feeds/keiro.ts`.

**The wire contract this screen consumes** (keiro-ops-http 0.21.0.0, audited 2026-10-21;
routes are generated from the keiro-ops command grammar in
`keiro-ops/src/Keiro/Ops/Workflow.hs`, JSON in `keiro/src/Keiro/Workflow/Inspection.hs`,
per `mori://shinzui/keiro/okf/adrs/concepts/ADR-53`). All are GET and reached under the
`/keiro` prefix on the console's origin (`http://localhost:5173/keiro/...` in development
through the Vite proxy). `GET /keiro/wf/inspect/list` takes `status_class` (repeatable;
the client repeats the key per value), `workflow_name`, `created_since`, `created_before`,
`updated_since`, `updated_before` (UTC timestamps such as `2026-10-20T01:02:03Z`),
`ordering` (`key` or `created_desc`, default `key`), `limit` (default 100, at most 500),
and `after` (an opaque cursor). It returns `{"observed_at", "items": [...], "next_cursor"?}`
where each item has `workflow_id`, `workflow_name`, `generation`, `status`, `status_class`,
`attempts`, `last_error`, `next_attempt_at`, `wake_after`, `leased_by`, `lease_expires_at`,
`created_at`, `updated_at`, `completed_at` (nullable where not applicable).
`GET /keiro/wf/inspect/header/{NAME}/{ID}` returns one such item.
`GET /keiro/wf/inspect/journal/{NAME}/{ID}` and `.../steps/{NAME}/{ID}` take `generation`
(defaults to the current one), `limit`, `after` and return pages that additionally carry
`generation`; a journal entry has `event_id` (UUID text), `event_type`, `stream_version`,
`global_position`, `step_name`, `recorded_at`, `payload`; a step row has `step`, `result`,
`recorded_at`. Terminal journal entries (completed, cancelled, failed, continued-as-new)
carry synthetic step names and, for failures, the reason as payload; the exact
`event_type` strings are those of `workflowJournalCodec` in keiro — read them from the
recorded fixtures rather than guessing. `.../children/{NAME}/{ID}` and
`.../awakeables/{NAME}/{ID}` take `limit` and `after`; a child row has `child_id`,
`child_name`, `parent_id`, `parent_name`, `await_step`, `status`, `result`,
`failure_reason`, timestamps; an awakeable row has `awakeable_id`, `owner_workflow_name`,
`owner_workflow_id`, `status`, `payload`, timestamps. Cursors are opaque base64url strings
bound to one read kind: echo them back untouched, and expect `409 cursor_generation_mismatch`
if a cursor is reused across generations. Errors are `{"error": {"code", "message", "details"?}}`;
the codes this screen must render are `invalid_cursor` and `invalid_page_size` (400),
`command_failed` (422, which is how "workflow not found" arrives), `schema_drift` (409),
`inspection_busy` (503), `inspection_timeout` (504). `global_position` is an int64 and
arrives from the client as `bigint`.

**The live feed.** keiro-ops-http serves `/keiro/ws` (`keiro-ops-http/src/Keiro/Ops/Protocol.hs`
and `Views.hs`; guide `docs/guides/stream-keiro-inspection-views.md` in keiro). The client
sends `{"type":"subscribe","feed":"workflows","status_class":[...],"workflow_name":"...","limit":100}`
(only those three filter fields exist; selecting all seven classes is the same as none).
The server replies `snapshot {feed, sequence, trigger, observed_at, items}` and thereafter
`update {feed, sequence, trigger, observed_at, changed, removed}` where `changed` holds full
items to upsert by `{workflow_name, workflow_id}` and `removed` holds key objects of items
that **left the first page** (not necessarily deleted). `trigger` is `subscribe`, `notify`,
or `timeout`. `sequence` increases per published frame; a gap, or an `error` frame with
code `queue_overflow`, means the view must be rebuilt by re-subscribing or re-polling
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-56`: no replay cursors). Other error codes:
`invalid_frame`, `unknown_feed`, `invalid_subscription`, `read_failed` (the last view stays
valid while the driver retries), `too_many_views`, `inspection_busy`,
`inspection_result_too_large`. `unsubscribe` is answered by `unsubscribed`; `ping` by
`pong`; `goodbye` precedes a server close. The feed covers the first page only, so the
reconcile applies to page one of the list and later pages stay poll-only. All of this is
implemented once in client-core's feed core and the keiro client's dialect; this plan
only wires the merge into the list query's cache and renders what it sees. Polling remains
authoritative (`docs/adr/0003-push-is-a-hint-poll-is-truth.md`).

**ADRs.** Local: ADR-3 (poll is truth), ADR-7 (read-only; see the Decision Log), ADR-8
(the UI import boundary). Cross-repository, by canonical handle:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` (the inspection surface is a bounded
exception to keiro's no-UI stance — this screen renders supported reads only),
`ADR-53` (HTTP as a transport over the command tree, which is why the paths read like
`wf/inspect/list`), `ADR-56` (feed semantics above), `ADR-23` (the wake ledger),
`ADR-28` (position vocabulary: this screen shows `global_position` values as positions
and never computes a "lag").


## Plan of Work

All code lives in `apps/console/src/features/workflows/` except the route files, which
live in the shell's Workflows route directory. The feature directory holds `search.ts`
(zod 4 schemas for the list and detail search parameters), `queries.ts` (TanStack Query
option factories over the keiro client), `feed.ts` (glue between `useWorkflowsFeed` and the
list query cache), `segments.ts` (pure duration derivation, unit-tested), `navigation.ts`
(sidebar entries, presets, and palette commands), and `components/` with
`StatusClassBadge.tsx`, `WorkflowTable.tsx`, `WorkflowFilters.tsx`, `TimeWindowFilter.tsx`,
`WorkflowHeader.tsx`, `WorkflowTimeline.tsx`, `JournalEntrySheet.tsx`, `StepsTable.tsx`,
`ChildrenTable.tsx`, and `AwakeablesTable.tsx`. Tests live beside the code in
`__tests__/` (vitest) and in `apps/console/e2e/workflows.spec.ts` (Playwright).

### Milestone 1 — the list, its filters, paging, and the live reconcile

Scope: the `/workflows` route with every filter in the URL, server cursor paging, and the
`workflows` feed keeping page one current. At the end an operator can filter to retrying
instances of one definition created in the last hour, share the URL, page forward and
back, and watch rows change while the page is open.

`search.ts` defines the list schema: `status_class` as an array of the seven class
literals (default empty, meaning all), `workflow_name` optional string, `created_since`,
`created_before`, `updated_since`, `updated_before` optional ISO date-time strings,
`ordering` as `key | created_desc` defaulting to `key`, `limit` as an integer 1–500
defaulting to 100, and `after` optional string (the cursor). The route uses it as
`validateSearch` so bad URLs render the shell's search-error component with a "reset
filters" link rather than a blank page.

`queries.ts` exports `workflowListOptions(search)` built on `keiroKeys.workflows.list(search)`
and `client.workflows.list(search)`, consumed through `useSurfaceQuery` so the adaptive
polling interval and the global pause apply; and `workflowPagesOptions(search)` through
`useCursorPages` for forward paging. Paging is forward-only on the server (there is no
previous cursor); the UI keeps the visited cursor chain in component state so "previous"
works within a session and the URL always holds the cursor of the page being viewed.

`WorkflowFilters.tsx` renders the seven status classes as toggle chips (a chip per class,
all off meaning all classes), a workflow-name field with submit-on-enter, two
`TimeWindowFilter` instances (created, updated) each with since/before date-time inputs
and quick ranges (15 min, 1 h, 24 h), the ordering select, and the page-size select. Every
change navigates with the new search params and drops `after`, because a cursor is only
valid for the query that produced it.

`WorkflowTable.tsx` shows one row per instance: name and id (the id links to the detail
route via `links.workflow({name, id})`), `StatusClassBadge` (class as the label, raw
status and attempts in its tooltip), generation, attempts, `last_error` truncated to one
line with the full text in a tooltip, "next attempt" and "wake after" as relative times
(absolute in the tooltip), `leased_by` with the lease expiry, and created/updated/completed
columns. An "as of" caption shows the page's `observed_at` and whether the feed is
connected, polling, or paused. Rows that the feed removed from page one fade out with a
quiet "moved off this page" notice rather than vanishing.

`feed.ts` subscribes with `useWorkflowsFeed({status_class, workflow_name, limit})` only
while the list is on page one (`after` absent) and liveness is not paused, and applies each
frame to the list query's cache with the keiro client's merge function (snapshot replaces
`items` and `observed_at`; update upserts `changed` by key and deletes `removed`). The
feed's `onResync` (fired on `queue_overflow`, a sequence gap, or reconnect) invalidates
the list query so the poll path re-reads. Time-window filters are not part of the feed
subscription (the feed accepts only class, name, and limit), so when any time window is
set the list is poll-only and the caption says so.

Acceptance for M1 includes the MasterPlan's early producer/consumer check (3): with the
local stack running and the keiro workflow scenario executing, the first page reconciles
from feed frames — a row's badge changes from `running` to `completed` without a reload,
and a `removed` key fades its row. The automated form is a vitest test that mounts the
list against MSW fixtures and the scripted feed sequence (snapshot → update with changed
and removed → `queue_overflow` → resync) and asserts the rendered rows after each frame.
Record both in Progress with evidence.

### Milestone 2 — the detail route, tabs, and the journal timeline

Scope: `/workflows/$name/$id` with the header, URL-held tabs, and a journal timeline
grouped by step with lenses, generation selection, and infinite paging.

The detail search schema holds `tab` (`journal | steps | children | awakeables`, default
`journal`), `generation` (optional non-negative integer; absent means current), `lens`
(`all | steps | errors`, default `all`), and the shell's `sheet` parameter. The route
loads `client.workflows.header(name, id)` through `useSurfaceQuery` and renders
`WorkflowHeader`: the badge, raw status, generation (as a selector when the header's
`generation` is above 0, listing 0..current and navigating by setting `generation`),
attempts, `last_error` in full, lease, wake and next-attempt times, and the three
timestamps. A `command_failed` error for an unknown instance renders a "no such workflow"
state with a link back to the list. Visiting the route calls `useRecordVisit` with the
instance's name and id so it appears in recents.

The Journal tab uses `useCursorPages` over `client.workflows.journal(name, id, {generation, limit, after})`
with a "load more" control and renders `WorkflowTimeline`: entries in stream-version order,
grouped by `step_name` (consecutive entries sharing a step collapse into one group with a
count), each entry showing its `event_type`, `recorded_at` (relative, absolute on hover),
`stream_version`, and `global_position`. The `lens` control filters client-side: `steps`
hides terminal and continued-as-new entries, `errors` shows only failure entries and the
entries immediately preceding them. Switching generation resets the cursor chain (cursors
are bound to a generation; reusing one across generations yields `cursor_generation_mismatch`,
which the UI handles by clearing `after` and reloading). The page's `observed_at` is shown
as "as of" and the detail polls through `useSurfaceQuery`; there is no feed for a single
instance, so the detail is poll-only and says so in the liveness caption.

### Milestone 3 — the journal-entry sheet, derived segments, and the other tabs

Scope: the right sheet for a journal entry, the derived durations, and the Steps,
Children, and Awakeables tabs with their links.

`JournalEntrySheet.tsx` registers sheet kind `journal-entry` with reference
`<name>/<id>/<event_id>` (URL-safe; the sheet reopens on reload from the `sheet` search
parameter). It shows the entry's step name, event type, recorded time, stream version,
global position, and payload as JSON, with links built through `links`: "open in the $all
log" to the events route positioned so the entry is the first row (`links.allEvents({from: global_position - 1n})`;
the exact builder name is whatever docs/plans/13 established — if that plan is not complete,
define the builder in `lib/links.ts` here and reconcile), and "open event" to the event
detail by `event_id`. The payload viewer is the `JsonViewer` from docs/plans/13; if that
plan is not yet complete, ship a minimal `JsonViewer` in this feature's components and
replace it when the shared one lands (note the swap in this plan's Progress).

`segments.ts` derives, from a journal page and the header, the span between consecutive
entries (`recorded_at[n] - recorded_at[n-1]`), the "time to first step" (`created_at` to
the first entry's `recorded_at`), the cumulative time, and the longest step. The timeline
renders each span as a labelled bar beside its entry group, with a legend stating that the
spans are derived in the UI from recorded timestamps and are not server facts; no
waiting-versus-executing classification is drawn (see the Decision Log). Spans across a
page boundary are computed only when both entries are loaded.

The Steps tab renders `StepsTable` over `client.workflows.steps` (same generation and
paging rules as the journal) with `step`, `result` (JSON, expandable), `recorded_at`. The
Children tab renders `ChildrenTable` over `client.workflows.children`: child name and id
linking to `links.workflow({name: child_name, id: child_id})`, `await_step`, status badge,
`result`, `failure_reason`, timestamps. The Awakeables tab renders `AwakeablesTable` over
`client.workflows.awakeables`: id, status, payload (JSON), timestamps. Both are
cursor-paged with "load more".

### Milestone 4 — navigation, presets, commands, recents, and the end-to-end suite

Scope: the section is reachable everywhere the shell allows, and the Playwright suite
covers the operator journeys.

`navigation.ts` registers the Workflows rail section's sidebar entries: "All workflows"
(`/workflows`), presets "Running", "Retrying", "Failed" (each a link with the matching
`status_class` preset), and the recents list for this section (fed by `useRecordVisit`).
It registers palette commands: `workflows` (opens the list), `workflows <status_class>`
(opens the list with that class), and the parsed command `workflow <name>/<id>` (navigates
to the detail; the parser accepts `name/id` and `name id`). The Playwright suite in
`apps/console/e2e/workflows.spec.ts` runs against MSW by default and covers: filters
round-trip through the URL (set chips and a time window, reload, see them restored);
paging forward and back; the detail tabs switching via the URL; the journal-entry sheet
reopening after reload; a feed update changing a row's badge without reload (using the
scripted feed); and the palette command opening a detail route.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated otherwise.

Confirm the prerequisites are in place before writing code:

```bash
bun run --filter @keiro-ui/client-keiro build && bun run --filter @keiro-ui/client-keiro test
ls apps/console/src/shell apps/console/src/lib/links.ts apps/console/src/lib/format.ts
ls packages/testing/fixtures/keiro | grep -i wf
```

Expect the client build and tests to pass, the shell modules to exist, and fixtures named
after the workflow routes (for example `wf-inspect-list.json`, `wf-inspect-header.json`,
`wf-inspect-journal.json`, `wf-inspect-steps.json`, `wf-inspect-children.json`,
`wf-inspect-awakeables.json`; the exact slugs are set by docs/plans/9's recorder). If a
fixture is missing, record it with the recorder (`bun run --filter @keiro-ui/testing record keiro`
against the live stack) rather than hand-writing JSON.

Add any missing UI primitives to the owned component package (the badge, tooltip, tabs,
table, sheet, and toggle-group are expected to exist from earlier plans; `kbd` and
`scroll-area` may not):

```bash
cd packages/ui && bunx shadcn@latest add kbd scroll-area && cd ../..
git status --short packages/ui
```

Create the feature directory and route files, then run the route generator and the
checks after each milestone:

```bash
bun run --filter @keiro-ui/console generate-routes
bun run check
bun run --filter @keiro-ui/console test -- workflows
```

Expected: `bun run check` prints no type, lint, or format errors; the vitest run lists the
workflows tests and ends with `Test Files N passed`.

Run the console in mock mode to develop without the Haskell stack:

```bash
VITE_MOCK=1 bun run dev
```

Open `http://localhost:5173/workflows`; the fixture instances appear and the scripted
feed advances them.

For the live-stack check (M1 acceptance), bring up the stack and seed workflows:

```bash
just stack-up
bun run dev
```

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro
just jitsurei-workflow
```

Verify the surface directly through the proxy before trusting the UI:

```bash
curl -s 'http://localhost:5173/keiro/wf/inspect/list?limit=5' | head -c 600
```

Expect a JSON object beginning `{"observed_at":"...","items":[{"workflow_id":...` with at
least one item from the scenario (its `workflow_name` is the one `keiro/jitsurei/src/Jitsurei/DurableWorkflow.hs`
defines). Then, with `http://localhost:5173/workflows` open, run the scenario again and
observe the row's badge change without a reload. Optionally watch the raw feed:

```bash
printf '{"type":"subscribe","feed":"workflows","limit":100}\n' | websocat -n ws://localhost:5173/keiro/ws
```

Expect a `snapshot` frame followed by `update` frames whose `changed` items match the rows
that moved.

Run the end-to-end suite (M4):

```bash
bun run test:e2e -- workflows
```

Expected: every test in `apps/console/e2e/workflows.spec.ts` passes against the mock
service worker; with `KEIRO_UI_LIVE=1` and the stack up, the smoke subset also passes
against the real surface.


## Validation and Acceptance

M1 is accepted when: navigating to `/workflows?status_class=retrying&status_class=failed&workflow_name=order-fulfillment&created_since=2026-10-21T00:00:00Z`
renders only matching rows and the chips, name field, and time window show those values;
changing a chip updates the URL and drops `after`; "next page" requests the server's
`next_cursor` as `after` and "previous" returns to the prior page; pausing liveness in the
bottom bar stops both polling and the feed, and resuming refetches; the scripted-feed
vitest test passes; and the live-stack check above is recorded in Progress with the
observed before/after badge values and the frame sequence.

M2 is accepted when: `/workflows/<name>/<id>?tab=journal` shows the header and the
timeline in stream-version order, grouped by step with counts; `lens=errors` shows only
failure entries and their predecessors; selecting an older generation reloads the journal
for that generation and resets paging; "load more" appends the next cursor page; an
unknown id renders the not-found state; and the "as of" caption reflects `observed_at`.

M3 is accepted when: clicking a journal entry opens the right sheet, the URL gains
`sheet=journal-entry:<name>/<id>/<event_id>`, reloading reopens it, its two links land on
the `$all` log at the entry's position and on the event detail; the timeline shows a
duration bar per step group with the derived-data legend and the "time to first step"
value; Steps, Children, and Awakeables tabs render fixture data, and a child row's link
opens that child's detail.

M4 is accepted when: the rail highlights Workflows on these routes; the sidebar shows the
presets and recents (a visited instance appears at the top); ⌘K with `workflow <name>/<id>`
navigates to the detail; and `bun run test:e2e -- workflows` passes in mock mode.

Required acceptance ends there. Proposals for later scope, not required here: a journal
diff between two generations; a "stuck" lens combining `retrying` with `next_attempt_at`
in the past; workflow actions (deferred, see the Decision Log).


## Idempotence and Recovery

Every step is additive and re-runnable: the route generator and `shadcn add` are
idempotent (re-running `add` on an existing component prompts to overwrite; answer no
unless intended). The fixture recorder overwrites fixture files deterministically from the
same database seed; if the seed changes, re-record and update the tests' expectations in
the same commit. The live-stack check can be repeated by re-running `just jitsurei-workflow`;
it only appends workflow instances. If a cursor-related test fails with
`cursor_generation_mismatch`, the test is reusing a cursor across generations — clear
`after` in the fixture URL rather than loosening the client's branding. Nothing in this
plan writes to any server.


## Interfaces and Dependencies

Libraries: `@tanstack/react-router` (file routes, `validateSearch` with zod 4 schemas),
`@tanstack/react-query` (through client-core's `useSurfaceQuery` and `useCursorPages`),
`zod` 4, `@keiro-ui/ui` components (badge, tooltip, tabs, table, sheet, toggle-group,
select, input, kbd, scroll-area, skeleton), `@keiro-ui/client-keiro`, `@keiro-ui/client-core`,
`@keiro-ui/testing` (dev/test only), `vitest`, `@playwright/test`.

Consumed interfaces (full module paths): from `@keiro-ui/client-keiro`:
`createKeiroClient`, `client.workflows.list(query): Promise<Page<WorkflowInstance, WorkflowListCursor>>`,
`client.workflows.header(name, id)`, `client.workflows.journal(name, id, {generation?, limit?, after?})`,
`client.workflows.steps(...)`, `client.workflows.children(name, id, {limit?, after?})`,
`client.workflows.awakeables(...)`, types `WorkflowInstance`, `WorkflowStatusClass`,
`WorkflowJournalEntry`, `WorkflowStep`, `WorkflowChild`, `WorkflowAwakeable`,
`WorkflowListQuery`, `useWorkflowsFeed(filters, {enabled, onResync})`,
`mergeFeedFrame(page, frame)`, and `keiroKeys.workflows`; from
`@keiro-ui/client-core`: `useSurfaceQuery`, `useCursorPages`, `useLiveness`, `ApiError`,
`Page`; from `apps/console/src/shell/*`: `registerSheet`, `useRightSheet`,
`useRegisterCommands`, `useRecordVisit`, the navigation registry; from
`apps/console/src/lib/links.ts` and `lib/format.ts`: `links.workflow`, `links.allEvents`,
`links.event`, `formatRelative`, `formatDuration`, `formatBigInt`.

Provided interfaces (for docs/plans/16, 17, and 19): `StatusClassBadge` and
`WorkflowTimeline` exported from `apps/console/src/features/workflows/components/`;
the sheet kind `journal-entry`; the sidebar and command registrations; and `segments.ts`
as a pure, tested module other timelines may reuse.

Prerequisites declared by the parent: docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md
and docs/plans/12-implement-the-keiro-typed-client.md must be Complete before this plan
starts (hard dependencies). docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md
is a soft dependency: without it, the live-stack check is deferred and recorded as pending
in Progress, and tests run on hand-copied samples until fixtures exist.
docs/plans/13-build-the-streams-and-subscriptions-screens.md is a soft dependency for the
shared `JsonViewer`, `EventDetailSheet`, and `CursorPager`; this plan ships minimal local
versions when they are absent and reconciles afterwards.
