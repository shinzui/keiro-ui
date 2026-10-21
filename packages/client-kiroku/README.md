# @keiro-ui/client-kiroku

Typed client for kiroku-metrics 0.3.0.1 (`kiroku-inspect`, mounted at `/kiroku`). Contract:
`docs/guides/building-an-inspection-ui.md` and `docs/user/metrics.md` in
`mori://shinzui/kiroku`. Built on `@keiro-ui/client-core`; every response is validated by the
zod schemas in `src/schemas.ts`.

| Method                                                                          | Route                                      | Notes                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| `capabilities()`                                                                | `GET /capabilities`                        | which routes are mounted; CORS state                            |
| `metrics.all()` / `metrics.subscription(name)`                                  | `GET /metrics`, `/metrics/<name>`          | legacy string error envelope (`legacy_error`)                   |
| `health.live()` / `ready()` / `combined()`                                      | `/health/live`, `/health/ready`, `/health` | `{status, body}`; 503 is a body, not an error                   |
| `subscriptions.live()` / `liveOne(name)`                                        | `/subscriptions`, `/subscriptions/<name>`  | process-local registry; the standalone server answers `[]`      |
| `checkpoints.inventory()`                                                       | `/subscription-checkpoints`                | durable truth; `store_position` is the store head               |
| `deadLetters.page(subscription, {member?, from?, limit?})`                      | `/subscriptions/<name>/dead-letters`       | newest first; cursor `"<position>:<id>"` (opaque)               |
| `streams.page({category?, prefix?, from?, limit?})` / `streams.get(name)`       | `/streams`, `/streams/<name>`              | byte-ordered names; `truncate_before` 0 = nothing truncated     |
| `streams.events(name, {from?, limit?, direction?})`                             | `/streams/<name>/events`                   | `from=0` = start (forward) or newest (backward)                 |
| `categories.page({from?, limit?})` / `categories.events(name, {from?, limit?})` | `/categories`, `/categories/<name>/events` | category names keep the database collation; events forward only |
| `events.all({from?, limit?, direction?})` / `events.get(uuid)`                  | `/events`, `/events/<uuid>`                | the `$all` log                                                  |

Limits are 1–1000; anything else throws `RangeError` before a request. Cursors are
`KirokuNameCursor` (strings) and `KirokuPositionCursor` (bigint positions), produced only by
decoding a page. Event records keep kiroku's camelCase keys plus `original_stream_name`;
positions and versions are `bigint`. `lag` is kiroku's own field name and is kept; console
screens label head-versus-position differences "global position distance".

Hooks (inside `KirokuClientProvider` and the client core's `LivenessProvider`): one per read
(`useKirokuCapabilities`, `useKirokuMetrics`, `useKirokuHealth`, `useKirokuLiveSubscriptions`,
`useKirokuCheckpoints`, `useKirokuDeadLetters`, `useKirokuStreams`, `useKirokuStream`,
`useKirokuStreamEvents`, `useKirokuCategories`, `useKirokuCategoryEvents`,
`useKirokuAllEvents`, `useKirokuEvent`), polling browse reads every 10 s and state every 5 s;
and two feeds:

- `useKirokuEventTail({enabled?, fromPosition?, category?, limit = 500, onOverflow?, onError?})`
  holds a bounded, position-ordered ring of events. On `event_stream_overflowed` (whose
  message is display-only) or any reconnect it re-reads `/events` (or the category route)
  forward from the last seen position until the cursor is absent.
- `useKirokuMetricsFeed()` writes each `/ws/metrics` snapshot into `useKirokuMetrics()`'s entry.

```bash
bun run --filter @keiro-ui/client-kiroku test                 # fixtures through MSW
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-kiroku test # plus kiroku-inspect on 9091
bun run --filter @keiro-ui/client-kiroku smoke                # live /capabilities and store head
```
