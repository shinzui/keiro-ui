---
id: 13
slug: build-the-streams-and-subscriptions-screens
title: "Build the Streams and Subscriptions screens"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
---

# Build the Streams and Subscriptions screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

After this plan, an operator running the keiro runtime console (`pnpm dev` in this
repository, with the local runtime stack of `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
up) can open the **Streams & Subscriptions** section and see into the kiroku event store
of their application: every stream and category, the events in any stream read forward
or backward, the global `$all` log with a live tail that keeps appending as the
application writes, any single event with its payload, metadata, and the event that caused
it, the durable checkpoint of every subscription measured against the store's head, and
the dead letters a subscription has parked, each linking back to the event that failed.

Concretely, after implementation `http://localhost:5173/streams?category=order` lists only
the streams in the `order` category; clicking one opens `/streams/order-42` with its events;
clicking an event opens a right-hand sheet whose URL (`...?sheet=event:<uuid>`) survives a
reload; `http://localhost:5173/events` shows the newest hundred events and, while the
console's liveness control is on, new events appear at the top within a second of being
appended; `http://localhost:5173/subscriptions` shows every subscription's checkpoint and
how many positions behind the store head it sits; and
`http://localhost:5173/subscriptions/order-projector` lists that subscription's dead letters.

Everything in this plan is read-only. Store dead-letter redrive is not offered because
kiroku has not specified an endpoint for it (see Decision Log).


## Progress

- [ ] M1 — Streams list and stream detail, with the event right sheet and the JSON viewer: `/streams`
  filters by category and prefix and pages by cursor; `/streams/$name` pages events forward or
  backward; any event row opens `?sheet=event:<uuid>`, which survives reload.
- [ ] M2 — Categories and the `$all` log with the live tail: `/categories` and `/categories/$name`
  page forward; `/events` shows the newest events first, follows the store live while liveness is
  on, recovers from `event_stream_overflowed` by re-reading, and stops on pause.
- [ ] M3 — Event page with causation and correlation navigation: `/events/$id` renders payload and
  metadata, links to the causing event, and shows the correlation id as copyable text.
- [ ] M4 — Subscriptions checkpoint dashboard and dead letters: `/subscriptions` shows durable
  checkpoints with their distance to the store head and live registry annotations;
  `/subscriptions/$name` pages dead letters with a member filter and links each to its event.
- [ ] M5 — Section navigation, commands, recents, and the Playwright suite: sidebar entries and
  recent streams, the `stream`/`event`/`subscription` palette commands, and the end-to-end specs
  pass against mock handlers.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: `/events?category=<name>` is a live tail from the current head plus a link to the
  category's history, not a backward-read list.
  Rationale: kiroku's category read (`/categories/<name>/events`) is forward-only and answers
  `direction=backward` with HTTP 400, so "newest first" cannot be served for one category; the
  WebSocket `subscribe_events` frame does accept `category`, so tailing is possible. Browsing a
  category's history belongs to `/categories/$name`, which pages forward and can follow live from
  its last page.
  Date: 2026-10-21

- Decision: kiroku's `lag` metric field is displayed as "positions behind head" with the wire
  name shown in a tooltip; computed checkpoint distances use the console-wide label from
  `format.formatPositionDistance`.
  Rationale: the console shows one vocabulary for "how far behind the head is this reader" on
  every surface. The keiro surfaces are bound by `mori://shinzui/keiro/okf/adrs/concepts/ADR-28`
  to say "global position distance" and never "lag"; kiroku's wire field keeps its published name
  (`mori://shinzui/kiroku/okf/adrs/concepts/ADR-9`), and the tooltip keeps that visible.
  Date: 2026-10-21

- Decision: Cursor paging is one page at a time with the cursor in the URL (`from`); "Previous"
  is an in-session trail kept in component state, never derived from the cursor.
  Rationale: cursors are opaque (`docs/architecture/inspection-api-conventions.md`, section 3), so
  the console cannot compute a previous page; a shared link lands on exactly the page it names;
  the trail gives back navigation for the session that paged forward.
  Date: 2026-10-21

- Decision: The event sheet loads its event from `GET /events/<uuid>` rather than from the row
  that opened it.
  Rationale: the sheet is URL-addressable (`?sheet=event:<uuid>`) from any page, including a
  freshly loaded one that has no rows yet.
  Date: 2026-10-21

- Decision: No store dead-letter redrive, re-checkpoint, or any other mutation is offered.
  Rationale: `docs/adr/0007-read-only-first-with-owning-repository-gates.md` makes the first
  release read-only, and kiroku exposes no redrive endpoint; the screen states this in place of a
  button.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

**What the console is.** This repository, `keiro-ui`, builds the browser console for
applications on the keiro runtime stack. The parent coordination document,
`docs/masterplans/2-build-the-keiro-runtime-console.md`, decomposes the build into child plans
and fixes the shared contracts; the direction document
`docs/architecture/ui-direction.md` describes the screens this plan builds (its "Stream
browser" and "Subscription and checkpoint dashboard" entries). Read the MasterPlan's
"Endpoint inventory", "Shell contracts", "Cross-entity link map", and "Vocabulary and display
rules" before starting; this plan restates what it needs from them but does not replace them.

**The data this section shows.** kiroku is the stack's append-only PostgreSQL event store.
Its vocabulary, used throughout this plan:

- A **stream** is a named, ordered sequence of events (for example `order-42`). Each event in
  a stream has a **stream version** (its position within that stream, starting at 1).
- A **category** is the prefix of a stream name before its first dash (`order` for
  `order-42`). Reading a category means reading every stream in it, merged.
- The **`$all` log** is every event in the store in append order. Each event has a
  **global position** in that log. Global positions are 64-bit integers that can exceed
  JavaScript's safe integer range; the console keeps them as `bigint` (see Interfaces).
- A **durable subscription** is a named reader (often a keiro projection) that remembers
  how far it has read in a **checkpoint**: the last global position it processed, per
  **member** (a subscription may run several parallel members). The store also exposes a
  **live registry** of subscriptions running in the same process as the metrics server;
  that registry is process-local and disappears when the process restarts, while
  checkpoints are the durable truth.
- A **dead letter** is an event a subscription gave up on after repeated failures; kiroku
  keeps it with the failure reason so an operator can see why.

**The endpoints, exactly as shipped.** kiroku serves its inspection surface from the
`kiroku-metrics` package, version 0.3.0.1 (released 2026-10-20). The MasterPlan's inventory is
authoritative; the routes this plan consumes, relative to the kiroku mount prefix, are:

```text
GET /capabilities                                  which routes are mounted; cors.enabled
GET /streams?category=&prefix=&from=&limit=        page of StreamInfo; cursor = stream name
GET /streams/<name>                                StreamInfo
GET /streams/<name>/events?from=&limit=&direction= page of Event; cursor = stream version
GET /categories?from=&limit=                       page of {name}; cursor = name
GET /categories/<name>/events?from=&limit=         page of Event; cursor = global position; forward only
GET /events?from=&limit=&direction=                the $all log; cursor = global position
GET /events/<uuid>                                 one Event
GET /subscription-checkpoints                      {store_position, checkpoints:[...]}
GET /subscriptions                                 live registry (legacy error envelope on 404)
GET /subscriptions/<name>/dead-letters?member=&from=&limit=  page of DeadLetter; opaque cursor
GET /metrics                                       store + subscription metrics (legacy error envelope)
WS  /ws/events                                     live tail: subscribe_events / event frames
```

Pages are `{"items": [...], "next_cursor": ...}`; a missing `next_cursor` means the last page.
`limit` defaults to 100 and caps at 1000 on the browse routes and on dead letters. `from` is an
exclusive cursor; on `/events` and `/streams/<name>/events`, `from=0` with
`direction=forward` means "from the beginning" and `from=0` with `direction=backward` means
"from the newest". `StreamInfo` is `{stream_id, name, category, version, created_at,
deleted_at, truncate_before}`. An `Event` keeps kiroku's published camelCase payload keys —
`eventId`, `eventType`, `streamVersion`, `globalPosition`, `originalStreamId`,
`originalVersion`, `payload`, `metadata`, `causationId`, `correlationId`, `createdAt` — plus
the newer snake_case `original_stream_name` (nullable). Checkpoints are
`{subscription, member, checkpoint_position, updated_at}` beside the store's
`store_position`. Live registry rows are `{subscription, member, phase, global_position}`;
when no registry is configured the route answers 404 with the legacy
`{"error": "subscription status not configured"}`. Dead letters are
`{dead_letter_id, subscription, member, global_position, event_id, reason, reason_summary,
attempt_count, created_at}`. New routes return errors as `{"error": {"code", "message",
"details"?}}` (for example `invalid_query_parameter` with `details.parameter`); bad or missing
store connections return 503 with a `*_unavailable` code.

The live tail protocol on `/ws/events`: the client sends
`{"type":"subscribe_events","from_position":N,"category":"order"}` (both fields optional);
the server answers `{"type":"event_stream_started","from_position":N}` and then one
`{"type":"event","event":{...}}` per event; `{"type":"ping"}` gets `{"type":"pong"}`;
`{"type":"unsubscribe_events"}` stops the tail; the server sends `{"type":"goodbye"}` before
closing; errors are `{"type":"error","code":"...","message":"..."}` with codes
`replay_failed`, `category_read_failed`, `live_decode_failed`, and
`event_stream_overflowed`, the last of which is sent *before* the surviving events and carries
the exact number dropped in its message. Sending a new `subscribe_events` restarts the tail
from the new position. The protocol's structure is the cross-project convention of
`docs/adr/0002-websocket-inspection-protocol-convention.md`; the client core wraps it so this
plan only consumes a hook.

The full wire reference is in the kiroku repository, cited as `mori://shinzui/kiroku` with
paths `docs/guides/building-an-inspection-ui.md` and `docs/user/metrics.md` (artifact-level
URIs pending). Two of its rules bind every screen here: parse 64-bit integers without losing
precision, and ignore unknown fields and frames.

**Where the code goes.** The console application lives in `apps/console`, created by
`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`. Routing is TanStack
Router with file-based routes under `apps/console/src/routes/`; every console page is a child
of the pathless layout `apps/console/src/routes/_shell.tsx`, which
`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md` owns, so this
section's route files live under `apps/console/src/routes/_shell/streams/`,
`.../_shell/categories/`, `.../_shell/events/`, and `.../_shell/subscriptions/`. Screen
components, query hooks, and search-parameter schemas live under
`apps/console/src/features/streams/`. Components that later plans reuse (the JSON viewer, the
cursor pager, the position badge, the live-tail controls) live under
`apps/console/src/components/`. UI primitives are imported only from
`@keiro-ui/ui/components/<name>` (the shadcn/ui React Aria components owned in
`packages/ui`), never from `react-aria-components` directly — the rule of
`docs/adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md`.

**Shell contracts this plan consumes** (all under `apps/console/src/`, owned by plan 8):
`shell/navigation.ts` declares the rail sections and each section's sidebar entries;
`shell/commands.ts` exports `useRegisterCommands` (palette entries, including parsed "go to
entity" commands) and `useRecordVisit` (feeds the recent-entities store the sidebar and
palette show); `shell/right-sheet.tsx` exports `registerSheet(kind, Component)` and
`useRightSheet()`, and mirrors the open sheet to the `sheet` search parameter that
`_shell.tsx` validates for every child route; `lib/links.ts` exports the typed route builders
used for every cross-entity link; `lib/format.ts` exports `relativeTime`, `duration`,
`bigint` (grouped digits), and `formatPositionDistance(head, position)`, the console-wide
label for "how far behind the head". The keyboard contract is fixed there too: Escape closes
the right sheet.

**Data-layer contracts this plan consumes.** `@keiro-ui/client-core` (plan 10) provides
`useSurfaceQuery` (TanStack Query with the per-surface polling default and the adaptive
interval), `useCursorPages` (one page at a time by cursor, echoing cursors untouched),
`useLiveness` (the console-wide pause/resume/refresh state), and `ApiError` (the normalized
error with `surface`, `status`, `code`, `message`, `details`). `@keiro-ui/client-kiroku`
(plan 11) provides `createKirokuClient({baseUrl})` with the namespaces `streams`,
`categories`, `events`, `subscriptions`, `metrics`, and `capabilities`; `useKirokuClient()`
bound to the active connection profile; `useKirokuEventTail(...)`, the `/ws/events`
subscription layered on the poll path; and `useKirokuMetricsFeed()` for `/ws/metrics`. The
exact signatures are listed under Interfaces and Dependencies.

**ADR context.** Locally: `docs/adr/0003-push-is-a-hint-poll-is-truth.md` — the `$all` tail
is poll-first; the WebSocket feed only shortens latency, and an overflow error means re-read
from the last position seen, never assume the stream was complete.
`docs/adr/0007-read-only-first-with-owning-repository-gates.md` — no mutations in this plan;
redrive is stated as unavailable, not hidden. `docs/adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md`
— the import boundary above. Cross-repository, cited by Mori handle:
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-17` — stream browsing orders by name bytes
through one shared name index, which is why `/streams` and `/categories` sort by byte order
rather than locale, and why the list cursor is a name; `mori://shinzui/kiroku/okf/adrs/concepts/ADR-18`
— the surface is composable and self-describing: `/capabilities` says which routes a host
mounted, and the screens degrade to "not mounted here" instead of failing;
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-9` — published wire shapes are frozen, so the
camelCase event keys stay as they are and the console never renames fields;
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-16` — browser access is explicit and default off,
which is why development goes through the Vite proxy (no CORS) and deployment needs the
console's origin on kiroku's allowlist.

**Prior-art lessons applied** (from `docs/architecture/ui-direction.md` and the survey it
cites): the dead-letter screen follows EventStoreDB's parked-messages pattern — a per-reader
list with the reason, the attempt count, and a link to the original event; the event page
grows the causation/correlation navigation the direction document names as a
differentiator; every list keeps its filters in the URL so views are shareable; and every
live view has a user-visible pause control.


## Plan of Work

The work is five milestones, each independently demonstrable. Build them in order: M1
introduces the components the others reuse.

**M1 — Streams list and stream detail, with the event sheet and the JSON viewer.** Create
`apps/console/src/features/streams/search.ts` holding the zod 4 search-parameter schemas
(`streamsSearch`, `streamEventsSearch`, `categoryEventsSearch`, `allEventsSearch`,
`deadLettersSearch`), with `limit` coerced to an integer in 1..1000 defaulting to 100, and
every cursor kept as a **string** in the URL (global positions and stream versions can exceed
the safe integer range, so they are converted to `bigint` only when calling the client).
Create `apps/console/src/features/streams/queries.ts` with hooks that wrap the kiroku client
in `useSurfaceQuery`/`useCursorPages` and the query-key factory for the `kiroku` surface. Add
the route files `apps/console/src/routes/_shell/streams/index.tsx` (`/streams`) and
`apps/console/src/routes/_shell/streams/$name.tsx` (`/streams/$name`). The list page renders
a `table` from `@keiro-ui/ui/components/table` with columns name, category, version,
created, deleted (a "deleted" badge when `deleted_at` is set), a filter bar bound to the
`category` and `prefix` search parameters, and the shared `CursorPager`. The detail page
renders a `StreamInfo` header (name, category, head version, created, deleted, and a note
"events before version N truncated" when `truncate_before` is set), a direction toggle
bound to the `direction` search parameter, and an events table (version, type, global
position, created, causation) whose rows open the event sheet. Create the shared components:
`apps/console/src/components/JsonViewer.tsx` (collapsible tree with raw/pretty toggle and a
copy button, rendering `bigint` values as digits, defaulting to collapsed raw text above
200 KB), `apps/console/src/components/CursorPager.tsx` (First, Previous from the in-session
trail, Next from `nextCursor`; writes `from` to the URL via `navigate({search})`),
`apps/console/src/components/PositionBadge.tsx` (a monospace badge for a `bigint` position
with copy on click), and `apps/console/src/features/streams/EventDetailSheet.tsx`, registered
as sheet kind `event` from `apps/console/src/features/streams/register.ts` (one
`registerStreamsFeature()` function that `apps/console/src/shell/features.ts`, owned by plan 8,
imports). The sheet loads `events.get(uuid)`, shows type, stream (linked), stream version,
global position, created, causation and correlation ids, the payload and metadata in two
`JsonViewer`s, and an "Open full page" link to `/events/$id`.

**M2 — Categories and the `$all` log with the live tail.** Add
`apps/console/src/routes/_shell/categories/index.tsx` (`/categories`: a cursor-paged list of
names, each linking to `/categories/$name`) and `apps/console/src/routes/_shell/categories/$name.tsx`
(`/categories/$name`: forward-only event pages over a global-position cursor, with the same
events table as M1, and a "Follow live" control enabled only on the last page — when the page
has no `next_cursor` — which tails the category from the highest global position on the
page). Add `apps/console/src/routes/_shell/events/index.tsx` (`/events`): without a
`category` parameter it loads the newest events with `events.all({from: 0n, direction:
"backward", limit})`, renders them newest-first, offers "Load older" (a backward read from the
lowest global position shown), and tails the store live; with `category=<name>` it reads the
head position (`events.all({from: 0n, direction: "backward", limit: 1})`), tails from there
with the category filter, and shows a link "Browse history of <name>" to `/categories/$name`
(see Decision Log). Implement the tail in `apps/console/src/features/streams/EventTail.tsx`:
it calls `useKirokuEventTail` with `enabled` tied to `useLiveness().paused === false` and to
the initial read having succeeded, `fromPosition` set to the highest global position
currently shown (echoed back untouched), and `category` from the URL; on each `event` frame it
prepends the event with a brief highlight; on `event_stream_overflowed` it shows the notice
"N events dropped — reloading", re-reads the newest page through the poll path, and the
hook re-subscribes from the new highest position; on `replay_failed`, `category_read_failed`,
or `live_decode_failed` it shows a toast (`@keiro-ui/ui/components/sonner`) and keeps
polling; on pause it unsubscribes and the poll stops; on resume it refetches and
re-subscribes. The baseline poll of the newest page keeps running on the surface's adaptive
interval while the tail is connected (ADR-3). Create
`apps/console/src/components/LiveTailControls.tsx` (the live/paused indicator, a manual
refresh, and the new-events pill shown when the user has scrolled away from the top so the
list does not jump).

**M3 — Event page with causation and correlation navigation.** Add
`apps/console/src/routes/_shell/events/$id.tsx` (`/events/$id`): the full event (every field
of `Event`, payload and metadata viewers), links to its stream (`/streams/<original stream
name>`; fall back to `originalStreamId` when `original_stream_name` is null) and category, a
"Caused by" link to `/events/<causationId>` that renders "not an event in this store" when
that id answers 404 (causation ids may name commands rather than events), and the
`correlationId` as copyable text with the note "correlation filtering is not available on
this surface" (kiroku exposes no correlation query; do not fake one by scanning). Record the
visit with `useRecordVisit`.

**M4 — Subscriptions checkpoint dashboard and dead letters.** Add
`apps/console/src/routes/_shell/subscriptions/index.tsx` (`/subscriptions`). Its truth is
`subscriptions.checkpoints()`: group rows by subscription, show each member's
`checkpoint_position`, `updated_at` (relative), and the distance to `store_position`
rendered with `format.formatPositionDistance(storePosition, checkpointPosition)`; show the
store head itself in the page header. Annotate each row with the live registry
(`subscriptions.live()`) when available — phase and process-local `global_position` under a
"process-local" badge — and, when that route answers 404 with the legacy envelope, show the
muted note "live registry not configured on this surface" instead of an error. Add a
metrics card from `metrics.get()` for each subscription (`last_known_position`, `lag`
displayed as "positions behind head" with the wire name in a tooltip, `db_error_count`,
`last_stop_reason`), again degrading to a note when `/metrics` is not mounted (check
`capabilities.get()`). Add
`apps/console/src/routes/_shell/subscriptions/$name.tsx` (`/subscriptions/$name`): the
subscription's checkpoint rows at the top and its dead letters below, cursor-paged with the
`member` filter in the URL, columns created, member, global position, reason summary,
attempts, and event (linking to `/events/$event_id`); the full `reason` opens inline. A short
line under the table states "Redrive is not available: kiroku specifies no store-level
redrive endpoint; the console will offer one when it does."

**M5 — Section navigation, commands, recents, and the Playwright suite.** Extend
`apps/console/src/shell/navigation.ts` with the section's sidebar entries (Streams,
Categories, All events, Subscriptions) and the recents group for kinds `stream`,
`subscription`, and `event`; call `useRecordVisit` on the stream, event, and subscription
pages. Register the parsed palette commands with `useRegisterCommands`: `stream <name>`,
`event <uuid>`, `subscription <name>`, each navigating through `lib/links.ts`. Write the
Playwright specs under `apps/console/tests/e2e/streams.spec.ts`, `events.spec.ts`, and
`subscriptions.spec.ts` against the mock handlers.


## Concrete Steps

All commands run from the repository root, `/Users/shinzui/Keikaku/bokuno/keiro-ui`. Plan 7
must be complete (workspace, `apps/console`, `packages/ui`), plan 8 complete (shell), and
plan 11 complete (kiroku client). Plan 9's fixtures are used when present; otherwise create
the kiroku fixtures named below yourself, following plan 9's `_meta.json` convention, from
the examples in kiroku's `docs/user/metrics.md`.

1. Confirm the prerequisites exist and the workspace is healthy:

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro-ui
pnpm install
pnpm check
ls packages/client-kiroku/src apps/console/src/shell apps/console/src/routes/_shell.tsx
```

2. Add any primitive this plan needs that `packages/ui` does not yet hold. Check first, then
   add inside the package so the generated source is committed:

```bash
ls packages/ui/src/components
cd packages/ui && pnpm dlx shadcn@latest add table badge tabs toggle-group collapsible scroll-area tooltip kbd sonner input select separator skeleton && cd ../..
```

3. Create the files named in Plan of Work. A route file looks like this (the search schema
   is the single source of truth for the page's URL state):

```typescript
// apps/console/src/routes/_shell/streams/index.tsx
import { createFileRoute } from "@tanstack/react-router"
import { streamsSearch } from "@/features/streams/search"
import { StreamsPage } from "@/features/streams/StreamsPage"

export const Route = createFileRoute("/_shell/streams/")({
  validateSearch: streamsSearch,
  component: StreamsPage,
})
```

```typescript
// apps/console/src/features/streams/search.ts
import { z } from "zod"

const limit = z.coerce.number().int().min(1).max(1000).default(100)
const cursor = z.string().min(1).optional() // opaque; positions stay strings in the URL

export const streamsSearch = z.object({
  category: z.string().min(1).optional(),
  prefix: z.string().min(1).optional(),
  from: cursor,
  limit,
})

export const streamEventsSearch = z.object({
  direction: z.enum(["forward", "backward"]).default("forward"),
  from: z.string().regex(/^\d+$/).optional(),
  limit,
})

export const allEventsSearch = z.object({
  category: z.string().min(1).optional(),
  limit,
})

export const deadLettersSearch = z.object({
  member: z.coerce.number().int().min(0).optional(),
  from: cursor,
  limit,
})
```

   The tail wiring in `EventTail.tsx` follows this shape:

```typescript
const liveness = useLiveness()
const newest = useNewestEvents({ limit })              // poll path, adaptive interval
const tail = useKirokuEventTail({
  enabled: !liveness.paused && newest.status === "success",
  fromPosition: highestGlobalPosition,                // bigint, echoed back untouched
  category,
  onEvent: (event) => prepend(event),
  onOverflow: (dropped) => {
    announce(`${dropped} events dropped — reloading`)
    void newest.refetch()                             // ADR-3: re-read, then re-subscribe
  },
  onError: (error) => toast.error(error.message),
})
```

4. Generate the route tree and run the checks after each milestone:

```bash
pnpm --filter @keiro-ui/console exec tsr generate
pnpm check
pnpm --filter @keiro-ui/console test -- streams
```

   Expected (names will vary with the files you add):

```text
 ✓ src/features/streams/StreamsPage.test.tsx (4 tests)
 ✓ src/features/streams/EventTail.test.tsx (3 tests)
 ✓ src/components/JsonViewer.test.tsx (3 tests)
 Test Files  3 passed
```

5. Run the console against mock handlers and against the live stack:

```bash
VITE_MOCK=1 pnpm dev            # mock handlers from packages/testing
# in another terminal, if the local stack is provisioned (plan 9):
just stack-up
pnpm dev                        # real kiroku-inspect on :9091 through the /kiroku proxy
```

6. Run the end-to-end suite for this section:

```bash
pnpm test:e2e -- streams events subscriptions
```

Fixtures this plan expects under `packages/testing/fixtures/kiroku/`: `capabilities.json`,
`streams.json`, `streams-category-order.json`, `stream-order-42.json`,
`stream-order-42-events-forward.json`, `stream-order-42-events-backward.json`,
`categories.json`, `category-order-events.json`, `events-latest.json`, `event-<uuid>.json`
(at least two, one with a `causationId` that resolves and one whose causation answers 404),
`subscription-checkpoints.json`, `subscriptions.json`, `subscriptions-404-legacy.json`,
`metrics.json`, `dead-letters-order-projector.json`. The scripted feed for tests is
`packages/testing/src/feeds/kiroku.ts` with sequences `started-then-events` (an
`event_stream_started` frame followed by three `event` frames) and `overflow` (an
`event_stream_overflowed` error naming five dropped events, then two `event` frames).


## Validation and Acceptance

Acceptance is what an operator sees in the browser; each item below names the URL, the
input, and the observation. Run the unit and end-to-end suites first, then walk the live
checks.

- `pnpm check` and `pnpm --filter @keiro-ui/console test` pass with the new tests.
- `pnpm test:e2e -- streams events subscriptions` passes against the mock handlers.
- `http://localhost:5173/streams?category=order` shows only streams whose category column is
  `order`; adding `&prefix=order-4` narrows to names starting with `order-4`; the pager's Next
  rewrites the URL to `...&from=<last name on the page>` and the new page starts strictly after
  that name; First clears `from`.
- `http://localhost:5173/streams/order-42` shows the stream header with its head version;
  `?direction=backward` shows the newest event first; clicking any row rewrites the URL to
  include `sheet=event:<uuid>` and opens the right sheet with the payload rendered in the JSON
  viewer; reloading the page reopens the same sheet; Escape closes it and removes the parameter.
- `http://localhost:5173/categories` lists category names in byte order; clicking `order` opens
  `/categories/order` with its events in global-position order; on the last page "Follow live"
  is enabled and new events for the category appear while liveness is on.
- `http://localhost:5173/events` shows the newest 100 events, newest first, each with a
  position badge; with liveness on (the bottom bar indicator), appending an event through the
  running application (for example by re-running a jitsurei scenario from plan 9) makes it
  appear at the top within about one second without a reload; pausing liveness stops the tail
  (the indicator reads paused, no new events appear); resuming refetches and resumes.
- With the scripted `overflow` feed in the Playwright spec, the notice
  "5 events dropped — reloading" appears and the list is re-read from the poll path.
- `http://localhost:5173/events?category=order` shows the category tail from the head and the
  "Browse history of order" link to `/categories/order`.
- `http://localhost:5173/events/<uuid>` renders every field, payload and metadata viewers with
  working copy buttons, a stream link that opens `/streams/<name>`, a "Caused by" link that
  opens the causing event or reads "not an event in this store" after a 404, and the correlation
  id as copyable text with the "not available on this surface" note.
- `http://localhost:5173/subscriptions` shows the store head, one group per subscription, each
  member's checkpoint position and "N positions behind head" (never the word "lag" in the
  console's own labels); live rows carry the "process-local" badge; against the
  `subscriptions-404-legacy.json` fixture the page shows the "live registry not configured"
  note and no error.
- `http://localhost:5173/subscriptions/order-projector` lists dead letters with reason summary
  and attempts, `?member=2` keeps only member 2, each event link opens `/events/<event_id>`,
  and the redrive-unavailable line is present; no button mutates anything.
- The sidebar shows Streams, Categories, All events, Subscriptions under the section, and the
  three most recently visited streams; ⌘K then typing `stream order-42` and Enter opens
  `/streams/order-42`; `event <uuid>` and `subscription order-projector` behave the same.

The early integration check this plan owns: before M2's tail is expanded to categories, the
`$all` tail must be shown working against the live kiroku-inspect server at least once
(an appended event appears without reload), because the scripted feed cannot prove the
server's `from_position` semantics.

Proposed, not required: a per-row "copy as JSON" on the events tables; a stream-version
jump box on the stream detail page.


## Idempotence and Recovery

Every step is additive and safe to repeat: route files, components, tests, and fixtures can be
rewritten freely, `pnpm dlx shadcn@latest add` is a no-op for components already present
(answer "no" if it offers to overwrite a modified file), and `tsr generate` regenerates
`routeTree.gen.ts` from the files present. Nothing in this plan writes to any server; every
request is a GET or a WebSocket subscription. If the live tail misbehaves during development,
pause liveness from the bottom bar; the page keeps working from the poll path. If a fixture is
missing, the mock handlers return 404 with the nested envelope, and the affected test fails
by name; add the fixture and rerun. If the route tree generation leaves stale entries after a
rename, delete `apps/console/src/routeTree.gen.ts` and regenerate.


## Interfaces and Dependencies

**Parent-declared prerequisites.** Hard: plan 8 (`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`)
Complete — the shell, route layout, navigation and command registries, right sheet, links,
and format helpers; plan 11 (`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`)
Complete — the kiroku client and its feed hooks. Soft: plan 9 for recorded fixtures and the
live stack. This plan's event sheet, JSON viewer, cursor pager, and position badge are reused
by plans 15 and 16; keep their props stable once M1 is accepted.

**Consumed from `@keiro-ui/client-kiroku` (plan 11).** This plan assumes the following; if
the implemented names differ, adapt the imports and record the difference in this plan's
Decision Log rather than in the client.

```typescript
createKirokuClient({ baseUrl: string }): KirokuClient
useKirokuClient(): KirokuClient            // bound to useSurfaceBaseUrl("kiroku")

KirokuClient.capabilities.get(): Promise<Capabilities>
KirokuClient.streams.list({ category?, prefix?, from?: string, limit? }): Promise<Page<StreamInfo, string>>
KirokuClient.streams.get(name): Promise<StreamInfo>
KirokuClient.streams.events(name, { from?: bigint, limit?, direction? }): Promise<Page<KirokuEvent, bigint>>
KirokuClient.categories.list({ from?: string, limit? }): Promise<Page<{ name: string }, string>>
KirokuClient.categories.events(name, { from?: bigint, limit? }): Promise<Page<KirokuEvent, bigint>>
KirokuClient.events.all({ from?: bigint, limit?, direction? }): Promise<Page<KirokuEvent, bigint>>
KirokuClient.events.get(id: string): Promise<KirokuEvent>
KirokuClient.subscriptions.checkpoints(): Promise<{ storePosition: bigint; checkpoints: Checkpoint[] }>
KirokuClient.subscriptions.live(): Promise<LiveSubscription[]>   // rejects with ApiError status 404, code "legacy_error" when not configured
KirokuClient.subscriptions.deadLetters(name, { member?, from?: string, limit? }): Promise<Page<DeadLetter, string>>
KirokuClient.metrics.get(): Promise<KirokuMetrics>

useKirokuEventTail({ enabled, fromPosition?: bigint, category?, onEvent, onOverflow, onError }): { status: "idle" | "connecting" | "live" | "error" }
useKirokuMetricsFeed({ enabled }): { snapshot?: KirokuMetrics }
```

Field names follow the wire exactly except that pages expose `nextCursor` and the client's
typed records map `int64()` fields (`globalPosition`, `streamVersion`, `originalVersion`,
`version`, `truncate_before`, `store_position`, `checkpoint_position`, `global_position`,
`last_known_position`, `lag`) to `bigint`; whether the client keeps snake_case or converts to
camelCase for TypeScript property names is plan 11's decision, and this plan uses whatever it
exports.

**Consumed from `@keiro-ui/client-core` (plan 10).** `useSurfaceQuery(surface, key, fn,
options)`, `useCursorPages({ key, from, fetchPage })` returning `{ items, nextCursor, status,
refetch }`, `useLiveness()` returning `{ paused, pause, resume, refreshAll }`, `ApiError`, and
the `Page<T, Cursor>` type (`{ items: T[]; nextCursor?: Cursor }`).

**Consumed from the shell (plan 8).** `registerSheet("event", EventDetailSheet)` and
`useRightSheet().open({ kind: "event", ref: uuid })`; `useRegisterCommands([...])` with
commands `{ id, title, match: (input) => ..., run: (navigate) => ... }`; `useRecordVisit({
kind, ref, title, href })`; `links.stream(name)`, `links.streamEvents(name, search)`,
`links.category(name)`, `links.categoryEvents(name, search)`, `links.allEvents(search)`,
`links.event(id)`, `links.subscriptions()`, `links.subscription(name, search)`; and
`format.relativeTime`, `format.bigint`, `format.formatPositionDistance`. The `sheet` search
parameter is validated by `_shell.tsx`; child schemas in this plan must not redeclare it.

**UI primitives** come only from `@keiro-ui/ui/components/*` (`table`, `badge`, `tabs`,
`toggle-group`, `collapsible`, `scroll-area`, `tooltip`, `kbd`, `sonner`, `input`, `select`,
`separator`, `skeleton`, `sheet` via the shell). **Libraries whose choice matters**: TanStack
Router (file routes, zod 4 `validateSearch`), TanStack Query 5 through the client core, zod 4,
vitest with `@keiro-ui/testing`'s `startMockServer()` and MSW, Playwright with the browser
mock setup from `@keiro-ui/testing`.

**Provided for later plans.** `apps/console/src/components/JsonViewer.tsx` (`{ value: unknown;
title?: string; defaultMode?: "tree" | "raw" }`), `apps/console/src/components/CursorPager.tsx`
(`{ nextCursor?: string; onNavigate: (from?: string) => void }`),
`apps/console/src/components/PositionBadge.tsx` (`{ position: bigint; label?: string }`),
`apps/console/src/components/LiveTailControls.tsx` (`{ status; newCount; onJumpToTop; onRefresh }`),
and the `event` sheet kind, which any page opens with `useRightSheet().open({ kind: "event",
ref: uuid })`.
