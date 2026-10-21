# @keiro-ui/client-core

The one place where the cross-project inspection conventions
([`docs/architecture/inspection-api-conventions.md`](../../docs/architecture/inspection-api-conventions.md))
become code: HTTP with normalized errors, lossless 64-bit integers, cursor pages, bigint-safe
query keys, the WebSocket feed core, and the console's liveness rules. It has no UI; it never
imports `@keiro-ui/ui`.

## For client authors

A surface client (`@keiro-ui/client-kiroku`, `-pgmq`, `-shibuya`, `-keiro`) is built from four
pieces.

```typescript
import { createHttpClient, int64, pageSchema, type Dialect } from "@keiro-ui/client-core"
import { z } from "zod"

const http = createHttpClient({ surface: "pgmq", baseUrl: "/pgmq" })

const message = z.object({ msg_id: int64(), read_ct: z.number() })
const messagesPage = pageSchema(message, int64())

const page = messagesPage.parse(await http.get("/queues/orders/messages", { query: { limit: 50 } }))
page.items[0]?.msg_id // bigint, exact beyond 2^53
page.nextCursor // the wire's next_cursor, echoed back as `from`; undefined on the last page
```

- **`createHttpClient({surface, baseUrl, fetch?, headers?})`**: `get` and `post` with
  `query` (keys in caller order, arrays repeat the key, `undefined` omitted, bigint exact),
  `signal`, `headers`, and `okStatuses` (non-2xx statuses whose JSON body is returned, e.g.
  `[200, 503]` for health routes). `post` without `body` sends no body and no content type,
  which is how keiro's mutation preview is requested; `post` with `body` sends JSON through
  `serializeJson`. Every response is parsed with `parseJsonLossless`. A root-relative
  `baseUrl` resolves against the page origin.
- **`ApiError`** is every failure: `surface`, `status`, `code`, `message`, `details`, `raw`,
  `headers`. The nested envelope keeps its `code`/`message`/`details`; shibuya's flat
  `{"error","code",...}` keeps its code with the remaining keys as `details`; kiroku's legacy
  `{"error":"text",...}` is `legacy_error`; any other body is `http_<status>`; a network
  failure is status 0, `network_error`; an abort is rethrown unchanged. `isApiError(e, code?)`
  narrows.
- **`parseJsonLossless` / `serializeJson` / `int64()`**: integers beyond `Number`'s safe range
  become `bigint` (ES2025 reviver source text, or a tested scanning fallback); fields declared
  `int64()` are always `bigint`; everything else stays `number`. `toInt64` and `formatInt64`
  convert and display.
- **`pageSchema(item, cursor, extra?)`** reads `{items, next_cursor?}` into
  `{items, nextCursor?}` plus the page-level fields declared in `extra` (keiro's
  `observed_at`, `generation`, `visible_store_head`).
- **`Dialect`** describes one WebSocket dialect for `openFeed` (below). Descriptors live in the
  client packages, next to the surface's types.

## For screen authors

```typescript
import {
  queryKeys,
  useCursorPages,
  useFeedSubscription,
  useLiveness,
  useSurfaceQuery,
} from "@keiro-ui/client-core"

const queues = useSurfaceQuery({
  surface: "pgmq",
  queryKey: queryKeys.pgmq("queues"),
  queryFn: ({ signal }) => pgmq.listQueues(signal),
})
```

- **`useSurfaceQuery(options)`**: TanStack `useQuery` with the surface's default interval
  (`surfacePollDefaults`: kiroku 5 s, pgmq 5 s, shibuya 2 s, keiro 5 s) or `poll`
  (milliseconds, or `false`), stretched by `adaptiveInterval` after a slow fetch
  (`clamp(10 s, 10 × last fetch, 60 s)` once a fetch takes over 1 s), stopped while
  paused, refetched once on resume, and never retried for a 4xx.
- **`useCursorPages({surface, queryKey, fetchPage, enabled?, poll?})`**: "load more" over a
  cursor read; returns the infinite query plus `items` (flattened) and `hasMore`. Only
  `fetchPage` knows whether the cursor parameter is `from` (kiroku, pgmq) or `after` (keiro).
- **`queryKeys.<surface>(...parts)` / `surfaceKey` / `keyPart`**: keys begin with the
  surface, so `invalidateQueries({queryKey: [surface]})` refreshes one surface; bigint
  parts become decimal strings (the key hasher cannot serialize bigint).
- **`LivenessProvider` / `useLiveness()`**: `{paused, pausedSince, pause, resume, refreshAll}`.
  The shell's bottom bar toggle and palette action drive it; `apps/console/src/shell/liveness.tsx`
  re-exports it.
- **`useFeedSubscription({enabled?, url, dialect, subscriptions?, applyToCache, invalidate})`**:
  opens a feed while enabled and not paused, hands snapshot, delta, and extra frames to
  `applyToCache(queryClient, frame, kind)`, and invalidates `invalidate` whenever the feed
  says frames may be missing (an overflow code, a resync frame, or any reconnect). The poll
  stays the source of truth (ADR-3).

## The feed core

`openFeed({url, dialect, subscriptions?, onSnapshot, onDelta, onExtra?, onError?, onResync, onStatus?, WebSocket?, backoff?})`
connects immediately, sends `dialect.subscribe(args)` for each remembered subscription on
every (re)connect, dispatches frames by `type`, and reconnects with full-jitter exponential
backoff (500 ms doubling to 30 s, reset after 10 s open). After a reconnect it calls
`onResync({code: "reconnected"})`. `goodbye` only marks the next close as server-initiated
(`onStatus("reconnecting", {serverGoodbye: true})`); `pong` and unknown frame types are
ignored.

### Dialect fact sheets

Audited 2026-10-21 against the owning repositories; every server also pings at the
WebSocket protocol level every 30 s.

| Surface        | Path (dev proxy)     | Client frames                                                                                                   | Server frames                                                                                                                                                                                                                                                   | Overflow / resync                                                                                                                                       |
| -------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kiroku events  | `/kiroku/ws/events`  | `subscribe_events{from_position?,category?}` (no `from_position` = live from now), `unsubscribe_events`, `ping` | `event_stream_started{from_position}`, `event{event}` (camelCase event), `error{code?,message}`, `goodbye`, `pong`                                                                                                                                              | `event_stream_overflowed`; its message names a dropped batch count but carries no structured field — never parse it; re-read `/events?from=<last seen>` |
| kiroku metrics | `/kiroku/ws/metrics` | (snapshot on connect; `subscribe` is `null`), `subscribe_metrics`, `unsubscribe_metrics`, `ping`                | `snapshot{metrics}` (the `/metrics` body), `goodbye`, `pong`                                                                                                                                                                                                    | none; a reconnect is the resync                                                                                                                         |
| shibuya        | `/shibuya/ws`        | `subscribe_all`, `subscribe{processors}`, `unsubscribe{processors}`, `ping`                                     | `snapshot{metrics}`, `update{processor,metrics}` (camelCase records; age-only changes omitted, so extrapolate `ageSeconds`), `terminal{processor,status}` and for `failed` also `error`, `messageId` (string or null), `error{code,message}`, `goodbye`, `pong` | `queue_overflow`, followed immediately by a replacement snapshot; no replay cursor                                                                      |
| pgmq           | `/pgmq/ws`           | `subscribe{queue}`, `unsubscribe{queue}`, `ping`                                                                | `snapshot{queue,metrics,push}`, `update{queue,metrics,source: poll\|notify}`, `error{code,message,queue\|null}`, `goodbye`, `pong`; metrics only, never messages                                                                                                | `overflow` (with `queue: null`)                                                                                                                         |
| keiro          | `/keiro/ws`          | `subscribe{feed,...filters}` (feeds `workflows`, `timers`, `projection_groups`), `unsubscribe{feed}`, `ping`    | `snapshot{feed,sequence,trigger,observed_at,items}`, `update{feed,sequence,trigger,observed_at,changed,removed}`, `unsubscribed{feed}`, `error{code,message,feed?}`, `goodbye`, `pong`                                                                          | `queue_overflow`, or any gap in `sequence` (`isResync`); first page only                                                                                |

## Tests

```bash
bun run --filter @keiro-ui/client-core test
# MasterPlan early check 1, with the local stack (just stack-up) and `bun run dev` running:
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-core test -- test/contract.test.ts
```

The contract test parses every JSON fixture in `packages/testing/fixtures` (or
`test/samples` without them). The feed tests script a real `ws` server on an ephemeral port;
hook tests run under jsdom with the `ws` client standing in for the browser's `WebSocket`.
