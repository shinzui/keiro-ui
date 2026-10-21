# @keiro-ui/client-keiro

Typed client for keiro-ops-http (mounted at `/keiro`). keiro has no hand-written route table
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-53`): a path is keiro-ops command words plus
positional arguments, each `snake_case` query key is a `--kebab-case` flag, reads are GET and
mutations POST. `commandRoute(words, positionals, flags)` builds requests that way and refuses
the reserved keys (`json`, `force`, `database_url`, `allow_schema_drift`, `help`) and
non-snake_case keys before sending. Contracts: `docs/guides/serve-keiro-ops-over-http.md` and
`docs/guides/stream-keiro-inspection-views.md` in `mori://shinzui/keiro`.

## Reads (`createKeiroClient({baseUrl, fetch?})`)

| Namespace                      | Methods → routes                                                                                                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health`                       | `get()` → `/health`; 503 bodies (`schema_drift`, `unavailable`, `inspection_busy`) are answers, not errors                                                                                                                                                                               |
| `workflows`                    | `list(filters)` → `/wf/inspect/list` (`status_class[]`, `workflow_name`, `created_since/before`, `updated_since/before`, `ordering`, `limit`, `after`); `header`, `journal`, `steps`, `children`, `awakeables` → `/wf/inspect/<kind>/{name}/{id}` (journal and steps carry `generation`) |
| `timers`                       | `pending({manager?, correlation?, after?, limit?})`; `stuck({min_age?, min_attempts?})` returns a bare array                                                                                                                                                                             |
| `projections`                  | `status({after?, limit?})` (ADR-35 frozen contract); `position({subscription})` → `store_position`, `visible_store_head`, `minimum_checkpoint_position`, `maximum_global_position_distance` (bigint, keiro's names)                                                                      |
| `shards`                       | `list()`, `status({subscription})`                                                                                                                                                                                                                                                       |
| `streams`                      | `show(stream, {from?, limit?})`, `causation(eventId)`, `subscriptions()`                                                                                                                                                                                                                 |
| `outbox` / `inbox`             | `backlog()`, `list({source, ...})`, `show(...)`                                                                                                                                                                                                                                          |
| `aggregates` (hook-gated)      | `types()`, `list({name, limit?, after?})`, `show({name, id})`, `snapshot({name, id})`; type and id are **query flags**                                                                                                                                                                   |
| `processManagers` (hook-gated) | `list({name, ...})`, `show({name, correlation, timer_limit?})`, which resolves to `null` for an unknown correlation                                                                                                                                                                      |

Limits are 1–500. Cursors are opaque strings branded per read kind (`WorkflowListCursor`,
`JournalCursor`, ...). Errors are `ApiError` with keiro's codes, plus `RouteUnavailable` (a
host without AppHooks answers `/aggregate/*` and `/pm/*` with 400 `invalid_request`; no
runnable host mounts them today, see keiro IR-55) and `CursorMismatch` (409
`cursor_generation_mismatch`: restart paging). Helpers: `isRouteUnavailable`,
`isCursorMismatch`, `isMutationsDisabled`, `isSchemaDrift`, `isInspectionBusy`, `isTooLarge`.
`keiroKeys` addresses the cache entries; `KeiroClientProvider`/`useKeiroClient` provide the client.

## Feeds (`@keiro-ui/client-keiro/feeds`)

`useWorkflowsFeed(filters, {enabled?, onResync?})`, `useTimersFeed(filters, ...)`, and
`useProjectionGroupsFeed(...)` merge `snapshot`/`update` frames into the first page's entry
(`keiroKeys.workflows.list(filters)`, `keiroKeys.timers.pending(filters)`,
`keiroKeys.projections.status()`) with `mergeFeedFrame(current, frame, keyOf, compare?)`, which
re-sorts in the read's own order; `queue_overflow`, a `sequence` gap, or a reconnect re-reads
that entry. They return `{status: "live" | "reconnecting" | "read_failed" | "off"}`. The
`workflows` feed accepts only `status_class`, `workflow_name`, and `limit`; a list with a time
window, ordering, or cursor is poll-only (status `off`).

## Mutations (`@keiro-ui/client-keiro/mutations`)

`keiroMutations(client)` returns `timers.requeue(id)`, `timers.cancel(id)`, and
`pgmq.dlqRedrive({queue, limit?})` (the logical job queue name; a `_dlq` name throws), each
with `preview()` (POST, no body) and `execute()` (POST `{"confirm":"execute"}`). Results:
`TimerMutationPreview` (`disposition`: `not_found`, `not_firing`, `already_terminal`,
`would_requeue`, `would_cancel`), `TimerMutationResult` (`outcome`: `transitioned`,
`not_transitioned`), `DlqRedrivePreview` (`available`, `would_affect_at_most`),
`DlqRedriveResult` (`affected`). Refusals: `MutationsDisabled`, `SchemaDrift` (`drift`),
`InvalidConfirmation`, `MutationOutcomeUnknown` (re-read before retrying),
`OriginNotAllowed`, `UnsupportedMediaType`. Only plan 19 imports this entry point.

```bash
bun run --filter @keiro-ui/client-keiro test
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test       # plus keiro-ops-http on 9093
bun run --filter @keiro-ui/client-keiro smoke
```
