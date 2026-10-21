# @keiro-ui/client-shibuya

Typed client for shibuya-metrics (mounted at `/shibuya`). Contract: `docs/architecture/METRICS.md`
in `mori://shinzui/shibuya`. Processor records are camelCase and frozen; the error envelope is
flat (`{"error": "<text>", "code": "<snake_case>", ...context}`), which `ApiError` normalizes.

| Method                                     | Route                                      | Notes                                                                                             |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `metrics.all()`                            | `GET /metrics`                             | map keyed by processor id                                                                         |
| `metrics.processor(id)`                    | `GET /metrics/<id>`                        | a processor named `prometheus` is shadowed by `/metrics/prometheus`; read it from `metrics.all()` |
| `health.live()` / `ready()` / `combined()` | `/health/live`, `/health/ready`, `/health` | `{status, body}`; 503 is a body                                                                   |
| `control.status()`                         | `GET /control`                             | `{enabled, operations}`; off by default. Pause/resume arrive with plan 19                         |

`state` is a union on `status`: `idle`, `processing` (`inFlight`, `maxConcurrency`,
`lastActivity?`, `lastProgress?`), `paused` (`pausedAt`, ...), `failed` (`error`, `timestamp`),
`stopped`. `latency`, `oldestInFlight`, and `progress` exist only when the host configures
`MetricsDetailed` (absent, never null); the local baseline (the shibuya-pgmq-adapter example
on Hackage 0.10.0.x) serves none of them and no `/control`. `extrapolateAge(oldestInFlight,
receivedAt, now)` ticks an in-flight age between frames, because updates omit age-only changes.

Hooks: `useShibuyaProcessors` (2 s), `useShibuyaProcessor`, `useShibuyaHealth` (5 s),
`useShibuyaControlStatus`, and `useShibuyaProcessorsFeed({enabled?, processors?})`, which writes
the snapshot into `useShibuyaProcessors()`'s entry, merges updates by id, applies `terminal`
frames (returned as `terminal[id]`), re-reads `/metrics` on `queue_overflow` or reconnect, and
returns `receivedAt[id]` for age extrapolation.

```bash
bun run --filter @keiro-ui/client-shibuya test
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-shibuya test   # plus the baseline on 9090
bun run --filter @keiro-ui/client-shibuya smoke
```
