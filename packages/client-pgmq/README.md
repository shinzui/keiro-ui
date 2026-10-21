# @keiro-ui/client-pgmq

Typed client for `pgmq-inspect` 0.1.0.0 (mounted at `/pgmq`). Its types are generated from the
OpenAPI document the server publishes (`openapi/pgmq-inspect.openapi.json`, provenance in
`openapi/SOURCE.md`) into `src/generated/schema.d.ts` (`bun run --filter @keiro-ui/client-pgmq
generate`); the zod schemas in `src/schemas.ts` are the runtime contract, and
`test/openapi-parity.test.ts` proves their keys match the document's components.

| Method                                                                 | Route                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `service()` / `openapi()`                                              | `GET /`, `GET /openapi.json`                                      |
| `queues.list()` / `queues.get(name)` / `queues.metrics(name)`          | `/queues`, `/queues/{queue}`, `/queues/{queue}/metrics`           |
| `metrics.all()`                                                        | `/metrics`                                                        |
| `messages.page(queue, {from?, limit?})` / `messages.get(queue, msgId)` | `/queues/{queue}/messages[/{msg_id}]`                             |
| `archive.page(queue, {from?, limit?})` / `archive.get(queue, msgId)`   | `/queues/{queue}/archive[/{msg_id}]`                              |
| `bindings.forQueue(queue)` / `bindings.all()`                          | `/queues/{queue}/bindings`, `/bindings`                           |
| `routing.test(routingKey)`                                             | `/routing/test?routing_key=`                                      |
| `notify.throttles()`                                                   | `/notify/throttles`                                               |
| `health.live()` / `health.ready()`                                     | `/health/live`, `/health/ready` (`{status, body}`; 503 is a body) |

GET only: HEAD answers 405. `limit` is 1–500 (the server silently caps at 500, so asking for
more throws `RangeError`). Message ids, `read_ct`, and the metrics counters are `bigint`;
`msgId` arguments are bigints and travel as exact digits. Vocabulary: `queue_length` is
"total", `queue_visible_length` is "visible", `total_messages` is a lifetime counter (the
sequence high-water mark), and a null `default_partition_length` means unknown. Dead-letter
messages written by shibuya-pgmq-adapter carry `dead_letter_reason_code`,
`dead_letter_reason_detail`, and (opt-in) `read_count` inside `message`.

Hooks (inside `PgmqClientProvider` and the client core's `LivenessProvider`): `usePgmqService`,
`usePgmqQueues`, `usePgmqQueue`, `usePgmqQueueMetrics`, `usePgmqAllMetrics`, `usePgmqMessages`,
`usePgmqMessage`, `usePgmqArchive`, `usePgmqArchivedMessage`, `usePgmqBindings`,
`usePgmqAllBindings`, `usePgmqRoutingTest`, `usePgmqNotifyThrottles`, `usePgmqHealth`; metrics
poll every 5 s, pages every 10 s. `usePgmqQueueMetricsFeed(queue)` writes pushed `snapshot` and
`update` metrics into `usePgmqQueueMetrics(queue)`'s entry, re-reads it on `overflow`, and
reports the last frame's `source` (`poll`/`notify`) and `push`.

```bash
bun run --filter @keiro-ui/client-pgmq test
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-pgmq test   # plus pgmq-inspect on 9095
bun run --filter @keiro-ui/client-pgmq smoke
```
