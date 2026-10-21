---
id: 10
slug: implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries
title: "Implement the client core for HTTP, cursors, int64, WebSocket, and live queries"
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
      at: 2026-10-21T21:03:35Z
      mode: "implement"
      note: "Implemented M1-M4; live early check 1 and the EP-8 liveness integration check pass"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Implement the client core for HTTP, cursors, int64, WebSocket, and live queries

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (the browser application this repository builds, see
`docs/masterplans/2-build-the-keiro-runtime-console.md`) talks to four independently owned
HTTP and WebSocket services: kiroku-metrics (the event store), pgmq-inspect (queues),
shibuya-metrics (queue processors), and keiro-ops-http (the framework: workflows,
aggregates, projections, timers). Each is called a **surface**. The four surfaces follow
one set of cross-project conventions (`docs/architecture/inspection-api-conventions.md`)
but differ in details that would otherwise be re-solved four times: three different error
body shapes, two casing styles, cursor pagination with different parameter names,
identifiers that overflow JavaScript numbers, and five WebSocket dialects that share a
structure but not frame names.

This plan builds `packages/client-core`, published inside the workspace as
`@keiro-ui/client-core`: the one place where those conventions become code. After it is
complete, a developer writing a typed client for a surface (the plans
`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md` and
`docs/plans/12-implement-the-keiro-typed-client.md`) imports an HTTP client that already
encodes queries and normalizes errors, a page schema that already understands
`next_cursor`, an `int64()` field type that already keeps 64-bit identifiers exact, and a
WebSocket core that already reconnects, recognizes overflow, and asks the owning query to
re-read. A developer writing a screen imports `useSurfaceQuery` to poll a surface with the
console's liveness rules (a global pause toggle, adaptive polling when a backend is slow)
and `useFeedSubscription` to layer a live feed on top of that poll without ever trusting the
feed as the source of truth.

You can see it working by running the package's test suite (`bun run --filter @keiro-ui/client-core test`), which proves with recorded samples that the identifier
`9223372036854775807` survives a round trip unchanged and that a scripted WebSocket server
that overflows causes a refetch, and — when the local runtime stack from
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` is running — by
running the same suite with `KEIRO_UI_LIVE=1`, which fetches kiroku's `/capabilities` and a
page of pgmq messages through the development proxy and checks the ids exactly.


## Progress

- [x] M1 — HTTP client, error normalization, and lossless int64: `createHttpClient`,
  `ApiError`/`normalizeError` covering the three wire envelopes, `parseJsonLossless` with
  the `context.source` path and the scanning fallback, `int64()`; unit tests pass and the
  round trip of `9223372036854775807` and of a `msg_id` above 2^53 is proven. (2026-10-21:
  `test/int64.test.ts`, `errors.test.ts`, `http.test.ts`; Node 22 supports both
  `context.source` and `JSON.rawJSON`, and the fallback is tested equal on every sample.)
- [x] M2 — Pages, query keys, liveness, and adaptive polling: `pageSchema`,
  `useCursorPages`, `queryKeys`, `LivenessProvider`/`useLiveness`, `useSurfaceQuery` with
  per-surface defaults and the clamp; hook tests show polling stops while paused, resumes
  with an immediate refetch, and stretches to the clamp after a slow fetch. (2026-10-21:
  `test/live.test.tsx` — ≥3 fetches in 55 ms at `poll: 10`, none while paused, exactly one on
  resume; a 3 s fetch defers the next poll to 30 s.)
- [x] M3 — Feed core: `openFeed` with the `Dialect` descriptor, backoff reconnect,
  `goodbye` handling, overflow-to-resync, unknown-frame tolerance, and
  `useFeedSubscription`; scripted-socket tests cover snapshot-then-delta, overflow,
  goodbye-then-reconnect, and unknown frames; the five dialect fact sheets are recorded in
  the package README. (2026-10-21: `test/feed.test.ts`, `test/feed-subscription.test.tsx`.)
- [x] M4 — Contracts documented and the live check recorded: `packages/client-core/README.md`
  explains every export for client authors and screen authors, the contract tests run
  against `packages/testing/fixtures` when present, and the `KEIRO_UI_LIVE=1` run against
  the local stack (MasterPlan early check 1) is recorded here with its output.
  (2026-10-21: the contract test parses all 103 JSON fixtures. Live run, default profile,
  through the Vite proxy on :5173:

  ```text
  stdout | test/contract.test.ts > live stack through the dev proxy > kiroku /capabilities
  kiroku kiroku-metrics 0.3.0.1
  stdout | test/contract.test.ts > live stack through the dev proxy > pgmq message ids round-trip exactly
  pgmq console_demo msg_id 9007199254740994 (bigint, exact)
  compared 6 msg_id values
   ✓ |client-core| test/contract.test.ts > live stack through the dev proxy > kiroku /capabilities 17ms
   ✓ |client-core| test/contract.test.ts > live stack through the dev proxy > pgmq message ids round-trip exactly 27ms
  ```
  )
- [x] MasterPlan early check 2 (with plan 8): `apps/console/src/shell/liveness.tsx` re-exports
  this package's `LivenessProvider` and `useLiveness`; `src/shell/liveness-integration.test.tsx`
  shows the bottom bar's toggle stopping a real `useSurfaceQuery` poll and resume refetching
  once, and the `shell` Playwright project passes unchanged (2026-10-21).


## Surprises & Discoveries

- 2026-10-21: undici's `WebSocket` (Node's global) rejects jsdom's `Event` objects ("The
  event argument must be an instance of Event"), so hook tests under jsdom pass the `ws`
  package's client as `WebSocket`; node-environment feed tests use the global `WebSocket`
  against a `ws` server. Closing a `ws` server waits for its clients, so test cleanups run in
  reverse order (client first).
- 2026-10-21: `useInfiniteQuery` refetches every loaded page in sequence; it cannot poll only
  the first page, so `useCursorPages` polls all loaded pages (cursors are still echoed back
  untouched).


## Decision Log

- Decision: JSON integers whose source text does not fit `Number.MAX_SAFE_INTEGER` are
  revived as `bigint`; schema fields declared `int64()` always normalize to `bigint`
  regardless of how small the value was; every other number stays a `number`.
  Rationale: kiroku's and pgmq's inspection guides both require lossless 64-bit handling
  and pgmq message ids can exceed 2^53; reviving only oversized literals keeps counts and
  ages ergonomic, and normalizing declared fields keeps types stable across small and
  large values. Recorded in the MasterPlan Decision Log on 2026-10-21.
  Date: 2026-10-21

- Decision: One `ApiError` type normalizes three wire envelopes (nested object, shibuya's
  flat object, kiroku's legacy string) and non-JSON bodies; the raw body is kept on the
  error for display and nothing is renamed inside `details`.
  Rationale: screens switch on `code` and display `message` verbatim per the conventions;
  the shipped shapes are frozen (kiroku ADR-9, shibuya ADR-7) so the client adapts, not
  the servers.
  Date: 2026-10-21

- Decision: The WebSocket core is parameterized by a data-only `Dialect` descriptor rather
  than by subclassing; the five descriptors live in the client packages that own each
  surface, and this package ships only the core, the descriptor type, and the recorded
  facts each descriptor must encode.
  Rationale: ADR-2 promised one core per structural convention with per-dialect frame
  names; a descriptor keeps the per-surface knowledge next to the surface's types.
  Date: 2026-10-21

- Decision: `pong` frames do nothing, `goodbye` means "reconnect after the close", a
  reconnect always fires `onResync`, and unknown frame types are ignored.
  Rationale: servers already ping at the protocol level every 30 s; a reconnect may have
  missed frames, and under ADR-3 any doubt is resolved by re-reading; kiroku's guide
  requires tolerance of unknown frames and fields.
  Date: 2026-10-21


- Decision: Feed tests use a real `ws` server on an ephemeral port rather than MSW's
  WebSocket interception.
  Rationale: it exercises the real `WebSocket` client, its close and reconnect behaviour,
  and the frames on the wire; MSW is kept for HTTP.
  Date: 2026-10-21

- Decision: `surfaceRetry` never retries a 4xx (a definite answer) but does retry network
  failures (status 0) and 5xx, at most twice; `resume()` invalidates every surface and
  `useSurfaceQuery`'s resume effect calls `refetch({cancelRefetch: false})`, joining that
  fetch, so a query refetches exactly once on resume. `normalizeError` uses the standard
  status text as the message for non-envelope bodies, falling back to the first 200
  characters of the body for unlisted statuses. `useFeedSubscription` also accepts an
  injectable `WebSocket` (for tests).
  Rationale: the plan said "never for an ApiError with status below 500", which would have
  excluded transient network failures from retry; the rest keeps the spelled contract.
  Date: 2026-10-21


## Outcomes & Retrospective

2026-10-21 — complete. `@keiro-ui/client-core` provides `createHttpClient`, `ApiError` over
three envelopes, lossless int64 parsing and serialization, `int64()`, `pageSchema`,
`useCursorPages`, bigint-safe `queryKeys`, `openFeed` with `Dialect`, `LivenessProvider`,
`useSurfaceQuery` with the adaptive clamp, and `useFeedSubscription`, with 102 tests (147
including one per fixture). Both early producer/consumer checks the MasterPlan schedules
for this plan pass: the int64 round trip through the dev proxy against the live stack, and
the shell's pause toggle driving a real poll. EP-11 and EP-12 can build their clients and
dialect descriptors on these exports; the README's fact sheets carry the dialect facts.


## Context and Orientation

**Repository state.** keiro-ui is a bun workspace created by
`docs/plans/7-scaffold-the-console-workspace-and-design-system.md` (EP-7), which must be
Complete before this plan starts. EP-7 leaves `apps/console` (the Vite + React
application), `packages/ui` (the component library), and an empty but wired
`packages/client-core` directory holding a `package.json` named `@keiro-ui/client-core`,
a `tsconfig.json` extending the workspace base, and the root `vitest`, `oxlint`, and
`oxfmt` configuration. The Vite development server (`bun run dev`, port 5173) proxies the path
prefixes `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` to local servers on ports 9091, 9090,
9095, and 9093 with the prefix stripped and WebSocket upgrades forwarded. Nothing in this
plan touches those files beyond adding dependencies to `packages/client-core/package.json`.

**Terms.** A *surface* is one of the four inspection services; its name is one of
`kiroku`, `pgmq`, `shibuya`, `keiro`. An *envelope* is the JSON shape a server uses for an
error body. A *cursor* is the opaque value a paginated read returns as `next_cursor` and
expects back on the next request; the console never computes or inspects cursors. A
*feed* is a WebSocket connection over which a surface pushes `snapshot` frames (full state
after a subscribe) and then *delta* frames (`update` for state changes, `event` for
append-only logs). A *dialect* is one surface's concrete frame vocabulary. *Overflow* is a
server dropping frames because the client fell behind; every surface signals it in-band
with an `error` frame carrying a code. *TanStack Query* (`@tanstack/react-query` 5) is the
cache for server state; a *query key* is the array that identifies one cached read.
*zod* (version 4) is the schema library used for runtime validation. *MSW* (Mock Service
Worker 3) intercepts HTTP and WebSocket traffic in tests. A `bigint` is JavaScript's
arbitrary-precision integer type; `number` cannot represent integers beyond 2^53 exactly.

**Wire facts this package must encode** (audited on 2026-10-21 against the owning
repositories' working trees; the MasterPlan's "Endpoint inventory" section is the
coordination copy).

Errors. kiroku's new routes, pgmq-inspect, and keiro-ops-http return a nested envelope:

```json
{ "error": { "code": "stream_not_found", "message": "No stream named 'orders-42' exists.", "details": { "stream_name": "orders-42" } } }
```

shibuya-metrics returns a flat envelope whose extra keys are context:

```json
{ "error": "Control operations are disabled", "code": "control_disabled" }
```

```json
{ "error": "processor not found", "code": "processor_not_found", "processor": "orders" }
```

kiroku's legacy routes (`/metrics`, `/metrics/<name>`, `/subscriptions`,
`/subscriptions/<name>`, and a plain HTTP GET of `/ws`) return a string:

```json
{ "error": "subscription not found", "subscription": "orders-projector" }
```

Status codes carry meaning the console switches on: 400 invalid input, 403 a disabled
gate or a refused origin (`mutations_disabled`, `control_disabled`, `origin_not_allowed`),
404, 405 (with an `Allow` header), 409 keiro `schema_drift` or `cursor_generation_mismatch`,
413 keiro result too large, 422 keiro `command_failed`, 426 pgmq `websocket_upgrade_required`,
429 pgmq `inspection_busy` on an upgrade, 500, 503 `*_unavailable`/`inspection_busy`, 504
keiro `inspection_timeout`/`mutation_outcome_unknown`.

Pagination. Every paged read returns `{"items": [...], "next_cursor": <cursor>}` and omits
`next_cursor` on the last page. The request parameter that takes the cursor is `from` on
kiroku and pgmq and `after` on keiro; the cursor type is a string (kiroku stream names,
kiroku dead-letter `"pos:id"` tokens, keiro base64url tokens) or an integer (kiroku stream
versions and global positions, pgmq message ids). keiro pages add top-level fields such as
`observed_at`, `generation`, and `visible_store_head` that must be preserved.

Integers. pgmq message ids (`msg_id`) are int64 and may exceed 2^53; kiroku global
positions and keiro positions are int64; both owners' guides say clients must parse them
losslessly (kiroku: `docs/guides/building-an-inspection-ui.md` in `mori://shinzui/kiroku`;
pgmq: `docs/user/queue-inspection.md` in `mori://shinzui/pgmq-hs`; artifact-level URIs
pending).

Casing. New fields are `snake_case`. shibuya's processor records are `camelCase`
(`startedAt`, `oldestInFlight`) and the event payload inside kiroku's `event` frames and
browse responses is `camelCase` (`eventId`, `globalPosition`). Both are frozen; this package
never renames fields.

WebSocket dialects (facts the client packages' descriptors must encode; the core only
needs the structural names):

```text
surface  path(s)                 client frames                                   server frames                                                  overflow code / resync rule
kiroku   /ws/events              subscribe_events{from_position?,category?},     event_stream_started{from_position}, event{event},             event_stream_overflowed (the message
                                 unsubscribe_events, ping                        error{message} or error{code,message}, goodbye, pong           text names a dropped batch count;
                                                                                                                                                no structured field, never parse it)
kiroku   /ws/metrics             (snapshot sent on connect), subscribe_metrics,  snapshot{metrics}, goodbye, pong                               none; reconnect = resync
                                 unsubscribe_metrics, ping
shibuya  /ws                     subscribe_all, subscribe{processors},            snapshot{metrics}, update{processor,metrics},                  queue_overflow (a fresh snapshot
                                 unsubscribe{processors}, ping                   terminal{processor,status,error?,messageId?},                  follows immediately); no replay cursor
                                                                                 error{code,message}, goodbye, pong
pgmq     /ws                     subscribe{queue}, unsubscribe{queue}, ping       snapshot{queue,metrics,push}, update{queue,metrics,source},    overflow
                                                                                 error{code,message,queue|null}, goodbye, pong
keiro    /ws (/keiro/ws mounted) subscribe{feed,...filters}, unsubscribe{feed},  snapshot{feed,sequence,trigger,observed_at,items},             queue_overflow; also any gap in
                                 ping                                            update{feed,sequence,...,changed,removed}, unsubscribed{feed}, `sequence`
                                                                                 error{code,message,feed?}, goodbye, pong
```

Every server also sends WebSocket protocol-level pings every 30 s; application-level
`ping`/`pong` exists but nothing in the console depends on it.

**ADR context.** Locally: `docs/adr/0002-websocket-inspection-protocol-convention.md`
(ADR-2) is the reason one core suffices — all dialects are `type`-tagged JSON with explicit
subscribe/unsubscribe, snapshot-then-delta, in-band `error`, and `goodbye`; this plan's
`Dialect` descriptor is that structure made explicit. `docs/adr/0003-push-is-a-hint-poll-is-truth.md`
(ADR-3) requires that every live view is backed by an authoritative poll and that a client
that misses frames recovers by re-reading; this plan's `onResync` callback and the
`useFeedSubscription` invalidation are that rule. `docs/adr/0005-no-backend-for-frontend.md`
(ADR-5) is why the normalization happens in the browser: there is no server to reshape
responses. `docs/adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md`
does not affect this package (it has no UI). Cross-repository:
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-9` freezes kiroku's published HTTP and
WebSocket shapes, which is why the legacy string envelope must be handled rather than
fixed; `mori://shinzui/keiro/okf/adrs/concepts/ADR-56` says keiro's feeds own bounded
shared drivers and have no replay cursor, so a sequence gap is a resync; shibuya's
`docs/adr/0008-deliver-websocket-frames-through-one-bounded-outbound-queue-per-connection.md`
(project `mori://shinzui/shibuya`, artifact-level URI pending) is why `queue_overflow` is
followed by a replacement snapshot and why a stalled client may be closed without
`goodbye`.

**Files this plan creates**, all under `packages/client-core/`:

```text
packages/client-core/
  package.json               @keiro-ui/client-core; exports "." -> ./src/index.ts
  tsconfig.json              extends the workspace base (created by EP-7)
  vitest.config.ts           jsdom environment for hook tests, node for the rest
  README.md                  the contract document for client and screen authors
  src/index.ts               re-exports every public name below
  src/surface.ts             Surface type and the list of surfaces
  src/http.ts                createHttpClient
  src/errors.ts              ApiError, normalizeError, isApiError
  src/int64.ts               parseJsonLossless, serializeJson, int64(), Int64, formatInt64
  src/pages.ts               Page, pageSchema, useCursorPages
  src/query-keys.ts          queryKeys, surfaceKey, keyPart
  src/live.ts                LivenessProvider, useLiveness, useSurfaceQuery, useFeedSubscription, adaptiveInterval
  src/feed.ts                Dialect, Frame, FeedHandle, openFeed
  test/http.test.ts, errors.test.ts, int64.test.ts, pages.test.ts, query-keys.test.ts,
  test/live.test.tsx, feed.test.ts, contract.test.ts
  test/samples/              inline JSON samples used until packages/testing/fixtures exists
```


## Plan of Work

**Milestone 1 — HTTP client, errors, and lossless int64.** The goal is that any surface
can be called with one function and that every failure arrives as one error type. At the
end, `createHttpClient({surface: "pgmq", baseUrl: "/pgmq"})` returns an object whose
`get("/queues/orders/messages", {query: {limit: 5}})` resolves to parsed JSON in which a
large `msg_id` is a `bigint`, and whose `get("/queues/missing")` rejects with an `ApiError`
of status 404 and code `queue_not_found`.

`src/surface.ts` exports `type Surface = "kiroku" | "pgmq" | "shibuya" | "keiro"` and
`const surfaces: readonly Surface[]`.

The signatures in this plan's Interfaces and Dependencies section are the contract the
client plans (`docs/plans/11-...` and `docs/plans/12-...`) and every screen plan restate
verbatim; when this package's implementation must deviate, change this section first and
cascade the spelling to those plans in the same commit rather than letting them adapt
silently.

`src/int64.ts` comes first because `http.ts` depends on it. `parseJsonLossless(text)`
parses a JSON document so that integer literals that do not fit a safe integer become
`bigint`. The preferred mechanism is the ES2025 "JSON.parse source text access" reviver
signature, `JSON.parse(text, (key, value, context) => ...)`, where `context.source` is the
exact literal text; feature-detect it once at module load by parsing `"1"` with a reviver
that checks whether its third argument is defined, and export the result as
`supportsJsonSource`. In the reviver, when `typeof value === "number"`,
`Number.isInteger(value)`, `!Number.isSafeInteger(value)`, and `context.source` matches
`/^-?\d+$/`, return `BigInt(context.source)`; otherwise return `value` (this keeps `1e20`
and fractional numbers as numbers). When the runtime lacks `context.source`, fall back to a
single-pass scan of the text that skips string literals (honoring backslash escapes),
finds integer literal tokens (an optional minus and digits not followed by `.`, `e`, or
`E`), and when `Number(token)` is not a safe integer rewrites the token to the string
`"\u0000int64:<digits>"`; then parse with a reviver that turns strings with that prefix
into `BigInt`. Both paths must produce identical results, and the test suite runs both by
forcing the fallback through an exported `parseJsonLosslessFallback`. `serializeJson(value)`
is the inverse for request bodies and uses `JSON.rawJSON` when available so a `bigint`
becomes a bare integer literal, else a replacer that emits the decimal string (documented
as the only lossy path, unused by any current request body). `int64()` returns a zod 4
schema that accepts a `bigint`, a safe-integer `number`, or a string matching `/^-?\d+$/`,
and transforms to the branded type `Int64` (`bigint & { readonly __brand: "Int64" }`);
`toInt64(value)` applies the same conversion outside schemas; `formatInt64(value,
{grouping?})` renders a `bigint` or `number` for display. Tests prove that
`parseJsonLossless('{"msg_id":9223372036854775807}').msg_id === 9223372036854775807n`,
that `9007199254740993` is a `bigint` while `42` and `3.5` are numbers, that strings
containing digits are untouched, and that `int64().parse(42) === 42n`.

`src/errors.ts` defines `class ApiError extends Error` with readonly fields `surface`,
`status`, `code`, `message`, `details?: unknown`, `raw: unknown` (the parsed body, or the
body text when it was not JSON), and `headers: Headers`. `normalizeError(surface, status,
bodyText, headers)` tries `parseJsonLossless(bodyText)`; if the result is an object whose
`error` is an object with a string `code`, it is the nested envelope (`code`, `message`,
`details` taken verbatim); if `error` is a string and `code` is a string, it is shibuya's
flat envelope (`message = error`, `details` = every remaining key); if `error` is a string
and there is no `code`, it is kiroku's legacy envelope (`code = "legacy_error"`,
`message = error`, `details` = every remaining key, for example `subscription`); anything
else — including non-JSON bodies and HTML from a proxy — becomes
`code = "http_" + status` with `message` set to the status text or the first 200
characters of the body. `isApiError(e, code?)` narrows an unknown thrown value. Tests use
one sample per shape and assert `code`, `message`, and `details`.

`src/http.ts` exports `createHttpClient(options)` where `options` is
`{surface: Surface; baseUrl: string; fetch?: typeof fetch; headers?: Record<string, string>}`.
`baseUrl` is either an absolute origin plus prefix (`http://localhost:9095`,
`https://ops.example.com/pgmq`) or a root-relative prefix (`/pgmq`) resolved against
`window.location.origin` when present and against `http://localhost:5173` otherwise (so node
tests through the development proxy work). The returned `HttpClient` has `surface`,
`baseUrl`, `url(path, query?)`, `get<T>(path, {query?, signal?, headers?, okStatuses?})`, and
`post<T>(path, {body?, query?, signal?, headers?, okStatuses?})`. `okStatuses` lists non-2xx
statuses whose JSON body is returned instead of thrown — the health routes of every surface
answer 503 with a readiness body, and the client plans pass `okStatuses: [200, 503]` there.
Query encoding: keys are emitted in the
caller's order; `undefined` values are omitted; `boolean` becomes `true`/`false`; `bigint`
and `number` become their decimal text; arrays repeat the key (`status_class=running&status_class=retrying`,
which is what keiro's repeatable flags expect); strings are percent-encoded with
`URLSearchParams`. Every request sends `Accept: application/json`. `post` sends a body only
when `body` is not `undefined`, serialized with `serializeJson` and `Content-Type:
application/json`; a `post` with no body sends no body and no content type, which is
exactly how keiro's mutation preview is requested. Responses: a 204 or empty body resolves
to `undefined`; otherwise the text is passed through `parseJsonLossless`; a non-2xx status
rejects with `normalizeError(...)`. A `fetch` rejection (network failure) becomes an
`ApiError` with status 0 and code `network_error`, except that an abort (`error.name ===
"AbortError"`) is rethrown unchanged so TanStack Query treats it as cancellation. Tests use
MSW's node server for the happy paths and envelope cases and a throwing `fetch` for the
network and abort cases.

**Milestone 2 — pages, query keys, liveness, adaptive polling.** The goal is that a screen
can poll a surface with one hook that obeys the console's pause toggle and slows down when
the backend is slow, and can page through a cursor read without touching the cursor.

`src/query-keys.ts` exports `type QueryKeyPart = string | number | boolean | null |
Record<string, unknown>`, `keyPart(value)` which converts a `bigint` to its decimal string
(TanStack Query hashes keys with `JSON.stringify`, which throws on `bigint`), `surfaceKey(surface,
...parts)` returning `[surface, ...parts] as const`, and `queryKeys` with one factory per
surface (`queryKeys.kiroku("streams", {category})` → `["kiroku", "streams", {category}]`).
The surface is always the first element so invalidating one surface is
`invalidateQueries({queryKey: [surface]})`.

`src/pages.ts` exports `interface Page<T, C = string> { items: T[]; nextCursor?: C }`,
`pageSchema(itemSchema, cursorSchema, extraSchema?)` which builds a zod schema reading an
object with `items` (array of `itemSchema`) and an optional `next_cursor` (validated by
`cursorSchema`; a missing or `null` value means "last page") and passing through any extra
top-level keys declared in `extraSchema` (keiro's `observed_at`, `generation`,
`visible_store_head`), and transforms to `Page<T, C> & Extra`; `nextCursor` must never be
derived from the items. `useCursorPages({surface, queryKey, fetchPage, enabled?})` wraps
`useInfiniteQuery` with `initialPageParam: undefined`, `getNextPageParam: (last) =>
last.nextCursor` (so `undefined` ends paging), and `queryFn: ({pageParam, signal}) =>
fetchPage(pageParam, signal)`; the caller's `fetchPage` is the only place that knows whether
the parameter is called `from` or `after`. It returns the infinite-query result plus two
conveniences: `items` (all pages flattened) and `hasMore`. Its refetch interval comes from
`useSurfaceQuery`'s rules (below) applied to the first page only.

`src/live.ts` exports `LivenessProvider` (a React context provider holding `paused` and
`pausedSince`, default not paused, optionally seeded from `initialPaused`), `useLiveness()`
returning `{paused, pausedSince, pause(), resume(), refreshAll()}` where `refreshAll`
invalidates the query key prefix of every surface, `surfacePollDefaults: Record<Surface,
number>` (kiroku 5000, pgmq 5000, shibuya 2000, keiro 5000 milliseconds),
`adaptiveInterval(baseMs, lastFetchMs)` returning `baseMs` when the last fetch took at most
1000 ms and otherwise `Math.min(60000, Math.max(10000, 10 * lastFetchMs))` (Restate's
clamp, named in `docs/architecture/ui-direction.md`), and `useSurfaceQuery(options)`.
`useSurfaceQuery` takes TanStack `UseQueryOptions` plus `surface` and an optional `poll`
(`number` in milliseconds to override the surface default, or `false` to disable polling
for this query). It wraps the caller's `queryFn` to measure its duration into a ref, sets
`refetchInterval` to a function returning `false` while `paused` and otherwise
`adaptiveInterval(base, lastDuration)`, sets `refetchIntervalInBackground: false`, sets
`retry` to at most two attempts and never for an `ApiError` with status below 500, and
installs an effect that calls `refetch()` when `paused` flips from `true` to `false`. Tests
use `renderHook` with a `QueryClientProvider` and fake timers to show that a query with a
10 ms base interval refetches repeatedly, stops after `pause()`, refetches once immediately
on `resume()`, and that after a `queryFn` that resolves in 3000 ms the next interval is
30000 ms.

**Milestone 3 — the feed core.** The goal is one WebSocket implementation that any
dialect plugs into. At the end, a scripted server that sends a snapshot, two updates, an
overflow error, and a goodbye drives the expected callbacks and reconnects.

`src/feed.ts` exports `type Frame = { type: string } & Record<string, unknown>`,
`type FeedStatus = "connecting" | "open" | "reconnecting" | "closed"`, and the descriptor:

```typescript
export interface Dialect<SubscribeArgs = void> {
  name: string
  subscribe(args: SubscribeArgs): Frame | null      // null: this dialect pushes on connect (kiroku /ws/metrics)
  unsubscribe(args: SubscribeArgs): Frame | null
  ping: Frame                                        // {"type":"ping"} on every surface
  frameTypes: {
    snapshot: string                                 // "snapshot" everywhere
    delta: "update" | "event"                        // "event" for kiroku /ws/events, "update" elsewhere
    error: string                                    // "error"
    goodbye: string                                  // "goodbye"
    pong: string                                     // "pong"
    extra?: string[]                                 // "event_stream_started", "terminal", "unsubscribed"
  }
  overflowCodes: string[]                            // see the dialect table in Context and Orientation
  isResync(frame: Frame): boolean                    // e.g. keiro sequence gaps
}
```

`openFeed(options)` takes `{url, dialect, subscriptions?, onSnapshot, onDelta, onExtra?,
onError?, onResync, onStatus?, WebSocket?, backoff?}` and returns a `FeedHandle` with
`status`, `send(frame)`, `subscribe(args)`, `unsubscribe(args)`, and `close()`. Behavior:
it connects immediately (status `connecting`), and on open sets status `open` and sends
`dialect.subscribe(args)` for every entry in `subscriptions` and every later `subscribe`
call (the handle remembers them so they are re-sent after every reconnect). Each incoming
message is parsed with `parseJsonLossless`; a value that is not an object with a string
`type` is ignored. Dispatch is by `type`: the snapshot type calls `onSnapshot(frame)`; the
delta type calls `onDelta(frame)`; the error type calls `onResync({code, frame})` when
`frame.code` is in `overflowCodes` or `dialect.isResync(frame)` is true, and `onError(frame)`
otherwise; the goodbye type marks the connection as closing by the server; the pong type
does nothing; a type listed in `extra` calls `onExtra(frame)`; any other type is ignored
(kiroku's rule: tolerate unknown frames). On close: if `close()` was called, status becomes
`closed` and nothing reconnects; otherwise status becomes `reconnecting` and a reconnect is
scheduled with full-jitter exponential backoff starting at 500 ms, doubling, capped at
30 s, and reset after a connection stays open for 10 s. A `goodbye` does not shorten or
skip the backoff; it only lets the status callback distinguish "server said goodbye" from
"connection dropped". After every successful reconnect the handle re-sends the
subscriptions and then calls `onResync({code: "reconnected"})`, because frames may have
been missed while disconnected. `WebSocket` is injectable so node tests can pass the `ws`
package's constructor. The package README records, for each of the five dialects, the
facts in the Context table so that EP-11 and EP-12 write their descriptors without
re-reading the owners' sources; those descriptors live in the client packages, not here.

`useFeedSubscription(options)` in `src/live.ts` takes `{enabled?, url, dialect,
subscriptions?, applyToCache, invalidate}` where `applyToCache(queryClient, frame, kind)`
is called with `kind` `"snapshot"`, `"delta"`, or `"extra"` and `invalidate` is the query
key prefix to invalidate on resync. It opens the feed when `enabled !== false` and liveness
is not paused, closes it when paused, disabled, or unmounted, forwards frames to
`applyToCache`, and on `onResync` calls `queryClient.invalidateQueries({queryKey:
invalidate})`. It returns `{status}`. Tests run a scripted server (MSW 3's WebSocket
interception in jsdom, or the `ws` package in node — pick one and record it in the Decision
Log) through four scripts: snapshot then two deltas (callbacks in order with parsed
`bigint` fields intact); an `error` frame with an overflow code (`onResync` called, `onError`
not); `goodbye` followed by a server close (status `reconnecting`, a reconnect within the
backoff, subscriptions re-sent, `onResync` with `reconnected`); and a frame of unknown type
plus a non-object message (no callback, no throw).

**Milestone 4 — contracts documented and the live check recorded.**
`packages/client-core/README.md` documents every export with a short example for two
audiences: client authors (how to build a surface client with `createHttpClient`,
`pageSchema`, `int64()`, and a `Dialect`) and screen authors (`useSurfaceQuery`,
`useCursorPages`, `useFeedSubscription`, `useLiveness`, `queryKeys`). `test/contract.test.ts`
reads recorded responses from `packages/testing/fixtures/<surface>/*.json` when that
directory exists (owned by EP-9) and otherwise from `test/samples/`, and asserts that every
sample parses through `parseJsonLossless` and, where it is a page, through a generic
`pageSchema(z.unknown(), z.union([z.string(), int64()]))`. When `KEIRO_UI_LIVE=1`, the same
file also performs the MasterPlan's early check 1 against the running stack: it fetches
`/capabilities` from kiroku and one page of messages from the first pgmq queue listed by
`/queues`, through `KEIRO_UI_LIVE_BASE` (default `http://localhost:5173`, the Vite proxy),
and asserts that each `msg_id` re-serializes to exactly the digits present in the raw
response text. The transcript of that run is pasted into Progress when M4 is accepted.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated. The workspace, `bun`, and the root tooling exist because EP-7 is Complete.

Add the package's dependencies. Peer dependencies are the ones consumers already have
(React 19, TanStack Query 5, zod 4); test tooling is local:

```bash
cd packages/client-core
bun add --peer react @tanstack/react-query zod
bun add --dev vitest jsdom @testing-library/react msw ws @types/ws
cd ../..
```

Create the source files listed in Context and Orientation and fill them per the Plan of
Work. Keep `src/index.ts` as the only entry point:

```typescript
export * from "./surface"
export * from "./int64"
export * from "./errors"
export * from "./http"
export * from "./pages"
export * from "./query-keys"
export * from "./feed"
export * from "./live"
```

Write `test/samples/` from the owners' documented shapes. The pgmq page sample is modeled
on `pgmq-inspect/test/golden/page-more.json` in the pgmq-hs repository (locate it with
`mori registry show shinzui/pgmq-hs --full`) and must contain an id above 2^53:

```json
{
  "items": [
    { "msg_id": 9007199254740993, "read_ct": 0, "enqueued_at": "2026-10-20T12:00:00Z",
      "last_read_at": null, "vt": "2026-10-20T12:00:00Z", "message": { "order_id": "ord-7" }, "headers": null }
  ],
  "next_cursor": 9007199254740993
}
```

The kiroku capabilities sample follows `docs/user/metrics.md` in the kiroku repository:
`{"package":"kiroku-metrics","version":"0.3.0.1","routes":{...},"cors":{"enabled":false},"process_local":[...]}`.

Run the package's checks after each milestone:

```bash
bun run --filter @keiro-ui/client-core typecheck
bun run --filter @keiro-ui/client-core test
bun run check
```

Expected shape of a passing test run (counts will differ):

```text
 ✓ test/int64.test.ts (12 tests)
 ✓ test/errors.test.ts (6 tests)
 ✓ test/http.test.ts (9 tests)
 ✓ test/pages.test.ts (4 tests)
 ✓ test/query-keys.test.ts (3 tests)
 ✓ test/live.test.tsx (5 tests)
 ✓ test/feed.test.ts (4 tests)
 ✓ test/contract.test.ts (2 tests | 1 skipped)
 Test Files  8 passed (8)
```

The skipped contract test is the live check; it runs when the EP-9 stack is up:

```bash
# in another terminal, with the stack from docs/plans/9-... running and `bun run dev` serving the proxy
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-core test -- test/contract.test.ts
```

Expected: the live test prints the kiroku package version from `/capabilities` and the
first `msg_id` it compared, and passes. If pgmq has no queues in the seeded database the
test fails with a message naming the seed recipe in
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`.

Commit at the end of each milestone with the trailers:

```text
feat(client-core): add http client, error normalization, and lossless int64 parsing

MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md
ExecPlan: docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md
```


## Validation and Acceptance

Required acceptance, all observable from the test runner or a browser console:

1. Int64 round trip. `bun run --filter @keiro-ui/client-core test -- int64` passes, including
   the assertions that `parseJsonLossless('{"id":9223372036854775807}').id` is the `bigint`
   `9223372036854775807n`, that `serializeJson({id: 9223372036854775807n})` is the exact
   text `{"id":9223372036854775807}` on a runtime with `JSON.rawJSON`, and that the
   fallback parser produces the same values as the `context.source` path on every sample.
2. Envelope normalization. For each of the four body shapes in Context and Orientation,
   `normalizeError` yields the expected `code` (`stream_not_found`, `control_disabled`,
   `legacy_error`, `http_502`), the verbatim `message`, and `details` carrying
   `stream_name`, `processor`, or `subscription` respectively.
3. HTTP behavior. Through MSW: a 200 page resolves with a `bigint` id; a 404 rejects with
   `ApiError.status === 404`; `post(path)` with no body sends neither a body nor a
   `Content-Type` header (asserted on the intercepted request); `post(path, {body:
   {confirm: "execute"}})` sends that JSON; array query values repeat the key; an aborted
   request rejects with the original `AbortError`.
4. Liveness. With fake timers, a `useSurfaceQuery` with `poll: 10` fetches at least three
   times in 50 ms, zero times in the 50 ms after `pause()`, and exactly once immediately
   after `resume()`; after a 3000 ms fetch the computed interval is 30000 ms; after a
   7000 ms fetch it is 60000 ms; after a 500 ms fetch it is the surface default.
5. Feed. The four scripted-socket scripts in Milestone 3 pass, and `useFeedSubscription`
   invalidates the given key on overflow and closes the socket when `pause()` is called.
6. Contract and live check. `test/contract.test.ts` passes against `test/samples` (and
   against `packages/testing/fixtures` once EP-9 lands), and the `KEIRO_UI_LIVE=1` run
   against the stack passes with its transcript recorded in this plan. This is the
   MasterPlan's early producer/consumer check 1 and must pass before EP-11 generates the
   pgmq client.
7. Workspace checks. `bun run check` (typecheck, oxlint, oxfmt) passes with the package
   included.

Proposals beyond this scope, not required here: a `HEAD`/`OPTIONS` helper, request
deduplication, and a React DevTools panel for feed status.


## Idempotence and Recovery

Every step is additive inside `packages/client-core` and can be re-run. Re-running `bun add` is harmless. Tests are pure or use in-process servers (MSW, `ws` on an ephemeral
port) and leave no state. If the `context.source` feature detection misbehaves in a
runtime, set the exported override `setJsonSourceSupport(false)` in a test or at app
start to force the fallback; the two paths are tested for equality so switching is safe.
If the live check fails because the stack is down, nothing in the package is affected:
the test is skipped unless `KEIRO_UI_LIVE=1` is set. If a milestone must be abandoned
midway, delete the uncommitted files under `packages/client-core/src` and `test`; no other
package depends on this one until EP-11 and EP-12 start.


## Interfaces and Dependencies

Libraries whose choice matters: `@tanstack/react-query` 5 (cache, `useQuery`,
`useInfiniteQuery`, `refetchInterval` as a function, `invalidateQueries`), `zod` 4
(`z.object`, `z.union`, `.transform`, `.brand`), React 19 (context and hooks only),
`msw` 3 (HTTP and WebSocket interception in tests), `ws` (node WebSocket server for
scripted feed tests), `vitest` 5 with `jsdom` and `@testing-library/react` for hook tests.
No UI dependency: this package never imports `@keiro-ui/ui` or `react-aria-components`.

Prerequisites from the parent plan: EP-7 (`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`)
must be Complete — it provides the workspace, the `packages/client-core` manifest and
`tsconfig.json`, the root vitest/oxlint/oxfmt configuration, and the Vite proxy with the
fixed prefixes and ports. EP-9 (`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`)
is a soft prerequisite: its fixtures replace `test/samples` and its running stack enables
the live check; this plan completes without it, recording the live check as pending in
Progress if the stack is not yet available and re-running it when it is.

Public interface other plans depend on (module paths relative to `packages/client-core/src/`):

```typescript
// surface.ts
export type Surface = "kiroku" | "pgmq" | "shibuya" | "keiro"
export const surfaces: readonly Surface[]

// int64.ts
export type Int64 = bigint & { readonly __brand: "Int64" }
export const supportsJsonSource: boolean
export function setJsonSourceSupport(enabled: boolean): void
export function parseJsonLossless(text: string): unknown
export function parseJsonLosslessFallback(text: string): unknown
export function serializeJson(value: unknown): string
export function int64(): z.ZodType<Int64, unknown>
export function toInt64(value: number | bigint | string): Int64
export function formatInt64(value: bigint | number, options?: { grouping?: boolean }): string

// errors.ts
export class ApiError extends Error {
  readonly surface: Surface; readonly status: number; readonly code: string
  readonly details?: unknown; readonly raw: unknown; readonly headers: Headers
}
export function normalizeError(surface: Surface, status: number, bodyText: string, headers: Headers): ApiError
export function isApiError(value: unknown, code?: string): value is ApiError

// http.ts
export type QueryValue = string | number | bigint | boolean | undefined | ReadonlyArray<string | number | bigint | boolean>
export type Query = Record<string, QueryValue>
export interface RequestOptions { query?: Query; signal?: AbortSignal; headers?: Record<string, string>; okStatuses?: readonly number[] }
export interface HttpClient {
  readonly surface: Surface; readonly baseUrl: string
  url(path: string, query?: Query): string
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>
  post<T = unknown>(path: string, options?: RequestOptions & { body?: unknown }): Promise<T>
}
export function createHttpClient(options: { surface: Surface; baseUrl: string; fetch?: typeof fetch; headers?: Record<string, string> }): HttpClient

// pages.ts
export interface Page<T, C = string> { items: T[]; nextCursor?: C }
export function pageSchema<I extends z.ZodTypeAny, C extends z.ZodTypeAny, E extends z.ZodRawShape = {}>(
  item: I, cursor: C, extra?: z.ZodObject<E>
): z.ZodType<Page<z.output<I>, z.output<C>> & z.output<z.ZodObject<E>>, unknown>
export function useCursorPages<T, C>(options: {
  surface: Surface; queryKey: readonly unknown[]
  fetchPage(cursor: C | undefined, signal: AbortSignal): Promise<Page<T, C>>
  enabled?: boolean; poll?: number | false
}): UseInfiniteQueryResult<InfiniteData<Page<T, C>>, ApiError> & { items: T[]; hasMore: boolean }

// query-keys.ts
export type QueryKeyPart = string | number | boolean | null | Record<string, unknown>
export function keyPart(value: unknown): QueryKeyPart
export function surfaceKey(surface: Surface, ...parts: QueryKeyPart[]): readonly [Surface, ...QueryKeyPart[]]
export const queryKeys: Record<Surface, (...parts: QueryKeyPart[]) => readonly [Surface, ...QueryKeyPart[]]>

// feed.ts
export type Frame = { type: string } & Record<string, unknown>
export type FeedStatus = "connecting" | "open" | "reconnecting" | "closed"
export interface Dialect<SubscribeArgs = void> { /* as defined in Milestone 3 */ }
export interface FeedHandle<SubscribeArgs = void> {
  readonly status: FeedStatus
  send(frame: Frame): void; subscribe(args: SubscribeArgs): void; unsubscribe(args: SubscribeArgs): void; close(): void
}
export function openFeed<SubscribeArgs = void>(options: {
  url: string; dialect: Dialect<SubscribeArgs>; subscriptions?: SubscribeArgs[]
  onSnapshot(frame: Frame): void; onDelta(frame: Frame): void; onExtra?(frame: Frame): void
  onError?(frame: Frame): void; onResync(reason: { code: string; frame?: Frame }): void
  onStatus?(status: FeedStatus, detail?: { serverGoodbye: boolean }): void
  WebSocket?: typeof WebSocket; backoff?: { initialMs?: number; maxMs?: number; resetAfterMs?: number }
}): FeedHandle<SubscribeArgs>

// live.ts
export function LivenessProvider(props: { children: React.ReactNode; initialPaused?: boolean }): JSX.Element
export function useLiveness(): { paused: boolean; pausedSince: Date | null; pause(): void; resume(): void; refreshAll(): Promise<void> }
export const surfacePollDefaults: Record<Surface, number>
export function adaptiveInterval(baseMs: number, lastFetchMs: number): number
export function useSurfaceQuery<TData, TError = ApiError>(
  options: UseQueryOptions<TData, TError> & { surface: Surface; poll?: number | false }
): UseQueryResult<TData, TError>
export function useFeedSubscription<SubscribeArgs = void>(options: {
  enabled?: boolean; url: string; dialect: Dialect<SubscribeArgs>; subscriptions?: SubscribeArgs[]
  applyToCache(queryClient: QueryClient, frame: Frame, kind: "snapshot" | "delta" | "extra"): void
  invalidate: readonly unknown[]
}): { status: FeedStatus }
```

Consumers: `docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md` and
`docs/plans/12-implement-the-keiro-typed-client.md` build their clients and dialect
descriptors on `createHttpClient`, `pageSchema`, `int64()`, and `Dialect`; every screen
plan (`docs/plans/13-...` through `docs/plans/17-...`) uses `useSurfaceQuery`,
`useCursorPages`, `useFeedSubscription`, `useLiveness`, and `queryKeys`; the shell
(`docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`) renders
`useLiveness` in the bottom bar and computes per-surface base URLs that are passed to
`createHttpClient` as `baseUrl`.
