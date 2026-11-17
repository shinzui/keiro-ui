# @keiro-ui/client-keiro

Typed client for keiro-ops-http (mounted at `/keiro`). keiro has no hand-written route table
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-53`): a path is keiro-ops command words plus
positional arguments, each `snake_case` query key is a `--kebab-case` flag, reads are GET and
mutations POST. `commandRoute(words, positionals, flags)` builds requests that way and refuses
the reserved keys (`json`, `force`, `database_url`, `allow_schema_drift`, `help`) and
non-snake_case keys before sending. Contracts: `docs/guides/serve-keiro-ops-over-http.md` and
`docs/guides/stream-keiro-inspection-views.md` in `mori://shinzui/keiro`.

## Reads (`createKeiroClient({baseUrl, fetch?})`)

| Namespace                      | Methods → routes                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health`                       | `get()` → `/health`; 503 bodies (`schema_drift`, `unavailable`, `inspection_busy`) are answers, not errors                                                                                                                                                                                                                                           |
| `workflows`                    | `counts({workflow_name?}, signal?)` → `/wf/inspect/counts`; `list(filters)` → `/wf/inspect/list` (`status_class[]`, `workflow_name`, `created_since/before`, `updated_since/before`, `ordering`, `limit`, `after`); `header`, `journal`, `steps`, `children`, `awakeables` → `/wf/inspect/<kind>/{name}/{id}` (journal and steps carry `generation`) |
| `timers`                       | `pending({manager?, correlation?, after?, limit?})`; `stuck({min_age?, min_attempts?})` returns a bare array                                                                                                                                                                                                                                         |
| `projections`                  | `consumers({category, limit?, after?}, signal?)` → `/projection/consumers`; `status({after?, limit?})` (ADR-35 frozen contract); `position({subscription})` → `store_position`, `visible_store_head`, `minimum_checkpoint_position`, `maximum_global_position_distance` (bigint, keiro's names)                                                      |
| `shards`                       | `list()`, `status({subscription})`                                                                                                                                                                                                                                                                                                                   |
| `streams`                      | `show(stream, {from?, limit?})`, `causation(eventId)`, `subscriptions()`                                                                                                                                                                                                                                                                             |
| `outbox` / `inbox`             | `backlog()`, `list({source, ...})`, `show(...)`                                                                                                                                                                                                                                                                                                      |
| `snapshots`                    | `show({stream})`, the raw stored row, which resolves to `null` when the stream or its snapshot is missing                                                                                                                                                                                                                                            |
| `aggregates` (hook-gated)      | `types()`, `list({name, limit?, after?})`, `show({name, id})`, `snapshot({name, id})`; type and id are **query flags**                                                                                                                                                                                                                               |
| `topology` (hook-gated)        | `summary()` → `/topology/summary`; `show()` → `/topology/show` as exact bytes with their digest; `load()` → the verified, validated, indexed document (see below)                                                                                                                                                                                    |
| `processManagers` (hook-gated) | `types()`, `list({name, ...})`, `show({name, correlation, timer_limit?})`, which resolves to `null` for an unknown correlation                                                                                                                                                                                                                       |

Limits are 1–500. Cursors are opaque strings branded per read kind (`WorkflowListCursor`,
`JournalCursor`, ...). Errors are `ApiError` with keiro's codes, plus `RouteUnavailable` (a
host without AppHooks answers `/aggregate/*` and `/pm/*` with 400 `invalid_request`; the local
stack's `jitsurei-ops-http` mounts them,
`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55`) and `CursorMismatch` (409
`cursor_generation_mismatch`: restart paging). Helpers: `isRouteUnavailable`,
`isCursorMismatch`, `isMutationsDisabled`, `isSchemaDrift`, `isInspectionBusy`, `isTooLarge`.
`keiroKeys` addresses the cache entries; `KeiroClientProvider`/`useKeiroClient` provide the client.

`workflows.counts` returns seven nonnegative bigint totals of retained current headers and
`observed_at`. Only the optional exact, case-sensitive workflow name scopes counts; list
filters do not. `projections.consumers` describes mounted configuration with independent
projection/durable coverage, required nullable binding identities, exact source declarations,
and an opaque `CategoryConsumersCursor` normalized as `nextCursor`. Category names must be
nonempty with no surrounding whitespace. The server defaults to 100 consumer items (maximum
500), including every binding within each item. Both reads accept abort signals.
`isInspectionReadUnavailable(error, "workflow-counts" | "category-consumers")` recognizes
only the call's command refusal; other failures retain their original `ApiError`.

## The service topology (`src/topology.ts`)

The service topology is the JSON document `keiro-dsl topology` writes from a service's
specification: every declaration as a node, every relation between them as an edge
(`mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`). A keiro host that mounts a
committed copy serves it unchanged. The client treats it as a declaration to verify, not as
runtime state ([ADR-16](../../docs/adr/0016-a-served-declaration-document-is-verified-and-rejected-whole-when-unknown.md)).

- `topology.summary()` returns the header: `schema_id`, `service`, `generator_version`,
  `document_bytes` (bigint), `document_sha256`, `members`, `node_counts` and `edge_counts`
  (bigint values, only kinds and relations that occur) and optional `source`.
- `topology.show()` reads the document through `http.getRaw` and returns `{bytes, digest,
  document}`: the exact bytes served, `sha256:` plus their lowercase hex SHA-256 computed
  here (`topologyDigest`, a pure implementation that works without `crypto.subtle`), and the
  validated document.
- `topology.load()` returns `{summary, digest, document, index}` and implements the read
  order. It reads the summary; throws `UnsupportedTopologySchema` without requesting the
  document when `schema_id` is not `keiro-dsl/service-topology/1` or `/2`; returns the
  document it already holds when the digest is unchanged (one summary request, no document
  request); otherwise reads the document and requires its digest to equal the summary's. On
  a mismatch it reads the pair once more, and throws `TopologyChanging` (with both digest
  pairs in `attempts`) if that also disagrees. The verified document is kept per client
  instance, so it never crosses deployments.

Validation (`parseTopologyDocument`) passes unknown object fields through and rejects the
whole document, as `TopologyDocumentInvalid` with a `reason` naming the first offence, when a
node kind, an edge endpoint kind or a relation is not in the schema id's vocabulary
(`TOPOLOGY_NODE_KINDS`, `TOPOLOGY_RELATIONS_V1`, `TOPOLOGY_RELATIONS_V2`; `feeds` exists only
under `/2`), a (`kind`, `name`) pair repeats, or an edge names a node that is not there. The
schema id is checked first.

`indexTopology(document)` gives `node(key)`, `byKind(kind)`, `outgoing(key)` and
`incoming(key)`, all in document order; `topologyNodeKey(kind, name)` is `kind:name`.
`aggregateDetails`, `processDetails`, `workflowDetails` and `projectionOwnerDetails` return a
typed view of a node's `details`, or `undefined` when they do not match. An aggregate's
`category` and `machine` are optional: documents from older keiro-dsl versions lack them.

Errors: a host that mounts no document and a host too old to know the route both answer 400
`invalid_request`, surfaced as `RouteUnavailable` with `word` `"topology"`; the two cannot be
told apart. `isTooLarge` (413: the document or the summary exceeds the host's response
limit), `isSchemaDrift` and `isInspectionBusy` apply as for every read. Cache keys:
`keiroKeys.topology.summary()` and `keiroKeys.topology.loaded()`.

Test data: `@keiro-ui/testing` exports `topologyGolden(name)` (keiro's five golden documents
as exact bytes) and `syntheticTopologySummary(bytes, overrides?)`, the summary a host would
serve for given bytes. That summary is computed, not recorded; the recorded pair is
`fixtures/keiro/topology-summary.json` and `topology-show.json`.

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
