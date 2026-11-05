---
id: 25
slug: inspect-registers-and-stored-snapshots-on-aggregates
title: "Inspect registers and stored snapshots on aggregates"
kind: exec-plan
created_at: 2026-11-05T01:05:55Z
master_plan: "docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md"
provenance:
  created_by:
    model: "claude-opus-5-5"
    harness: "claude-code"
    at: 2026-11-05T01:05:55Z
  revisions:
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-11-05T03:35:49Z
      mode: "implement"
      note: "Register table, stored snapshot read, comparison, and ADR-7 rule implemented"
---

# Inspect registers and stored snapshots on aggregates

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

A state machine in keiro carries registers: named, typed values kept alongside its control state, such
as a credit balance or an active flag. An aggregate may also store a snapshot, which is an advisory
cached copy of an earlier fold of its events, so stored values can differ from current ones. Operators
debugging an aggregate want to compare the two. The console shows the current state as one JSON tree
and the snapshot only as health numbers: version, age, compatibility. It cannot show what the snapshot
actually contains.

keiro now documents how to read both: `GET /aggregate/show` for current values and
`GET /snapshot/show?stream=NAME` for the stored contents. After this plan, an aggregate's page shows a
table of named registers when the state carries them. An operator can also press **Read stored
snapshot** to see the stored values beside the current ones, with the versions they belong to. You can
see it on the local stack by opening a `credit-limit` aggregate: `balance` 25 and `active` false appear
in the register table, and the stored snapshot shows the same values at stream version 1.


## Progress

- [x] M1 (2026-11-04): `keiro.snapshots.show({ stream })` parses `snapshot-show-credit-limit.json` and
  `snapshot-show-missing.json` (to `null`), and `/aggregates/credit-limit/<id>` shows a register table for
  that aggregate and none for an `order`, proven by `aggregates.test.tsx`.
- [x] M2 (2026-11-04): **Read stored snapshot** makes no request until pressed, then shows contents, a comparison, and
  the raw-data warning, proven by component tests, Playwright, and the live stack. Docs and
  [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) are updated.


## Surprises & Discoveries

- 2026-11-04: ADR-7 item 4 says the client packages carry redaction hooks at the render boundary, but
  no such code exists: `grep -rniE 'redact|reveal'` over `apps/console/src`, `packages/client-core/src`,
  and `packages/ui/src` finds nothing, and event and queue payloads render directly. This plan does not
  build that seam (see Decision Log); the parent MasterPlan records the gap.


- 2026-11-04: `useSurfaceQuery` refetched on Resume even for a disabled query, because TanStack's `refetch` ignores
  `enabled`. Pressing Resume anywhere on an aggregate page would have read the raw stored snapshot without the press this
  plan requires, and every other `enabled`-gated read had the same flaw. Fixed in
  `packages/client-core/src/live.ts`, with a test in `packages/client-core/test/live.test.tsx` that fails without the fix.

- 2026-11-04: Stored bodies also carry `observed_at` and `age_seconds`; they pass through the schema's `.passthrough()`
  and are not displayed, because `updated_at` and the health card already answer the question. "Refresh all" and Resume
  re-read an already pressed card, since those are explicit operator actions on data already on screen.


## Decision Log

- Decision: Stored snapshot contents are read only after an explicit press, are never polled, and show a
  sentence saying this is raw persisted data that can include fields the application's display omits.
  Rationale: the keiro guide warns that `/snapshot/show` returns persistence JSON independently of the
  application's display callback, so an application that redacts a field in `aggregate show` can still
  expose it here. The route has no server-side gate to render. An explicit press keeps sensitive data
  off the screen by default and matches ADR-7's separation of payload visibility from action rights,
  at a size proportionate to one panel. A deployment-wide payload policy is a separate decision and
  would have to cover event and queue payloads too.
  Date: 2026-11-04

- Decision: Registers are displayed only when `state.registers` is a JSON object with at least one key,
  labelled as what this application reports, with the full JSON viewer kept as the authority. The
  console assumes no field types.
  Rationale: the guide states `state.registers` is the contract of the example's display encoder and
  keiro's default snapshot codec; a custom codec can use another shape, and typed tables need an
  application-owned contract. Anything else falls through to the generic viewer, so nothing is hidden.
  Date: 2026-11-04

- Decision: Stored contents appear on the aggregate page only, not on `/streams/$name`.
  Rationale: the route needs no hooks, so a stream page could use it too, but the comparison that makes
  it useful requires a current fold, which only the aggregate page has. Adding it elsewhere is new scope.
  Date: 2026-11-04


## Outcomes & Retrospective

Complete on 2026-11-04. A `credit-limit` aggregate shows `balance` 25 and `active` false in a Registers table, with the JSON
viewer kept as the authority. **Read stored snapshot** makes no request until pressed, then shows the stored row and a
comparison headed by both versions, with changes marked in words and never presented as an error. An incident shows no
table, and its stored read says there is none. Values above 2^53 keep every digit. Proven by component tests,
`apps/console/e2e/aggregates/aggregates.spec.ts`, and the live config. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md)
records the opt-in rule and no longer claims a redaction seam that does not exist. No friction was recorded under this plan.


## Context and Orientation

The aggregate page is `apps/console/src/routes/_shell/aggregates/$type/$id.tsx`, calling `useAggregate(type,
id)` from `apps/console/src/features/aggregates/queries.ts`. It renders
`apps/console/src/features/aggregates/FoldedStatePane.tsx`, which shows `state_version`, `stream_version`,
a `JsonViewer` (`apps/console/src/components/JsonViewer.tsx`) over `view.state`, and
`SnapshotCard` (`apps/console/src/features/aggregates/SnapshotCard.tsx`) over `view.snapshot`. The
snapshot object has `stored.stream_version`, `stored.compatibility`, and `stored.events_since`, and the
client's `AggregateView` schema also carries `stream_name`. `packages/client-keiro/src/client.ts`
turns command words into GETs through `read`, and no `snapshot` namespace exists there yet.

The upstream contract comes from `mori://shinzui/keiro/plans/329-expose-keiki-register-values-through-the-existing-inspection-apis`
and is documented in `docs/guides/serve-keiro-ops-over-http.md` of `mori://shinzui/keiro`, artifact-level
URI pending. `GET /aggregate/show?name=credit-limit&id=<id>` returns current values at `state_version`.
`GET /aggregate/snapshot` is the application-aware health view, where the top-level `stream_version` is
the observed head and `stored.*` describes the cached row. `GET /snapshot/show?stream=<stream_name>`
returns the stored row, or JSON `null` with HTTP 200 when the stream or snapshot is missing:

```json
{"stream":"creditLimit-<id>","stream_version":1,"state":{"state":"credit_reviewed","registers":{"active":false,"balance":25}},"state_codec_version":1,"regfile_shape_hash":"...","state_shape_hash":"...","state_bytes":60,"created_at":"...","updated_at":"..."}
```

Use the aggregate response's `stream_name` as the `stream` parameter; never build it from the type, since
the inspector name `credit-limit` differs from the physical category `creditLimit`. `snapshot show` is an
ordinary database read, not hook-gated. Each request has its own observation time, and these responses
are not an atomic bundle: stored data can be older than current data, and that is normal. Reads do not
refresh snapshots. Incompatible snapshots stay visible through this route; only `aggregate snapshot`
evaluates codec compatibility. An unwritten register slot in an application's encoder surfaces as HTTP
500 `internal_error`.

[ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md) requires 64-bit integers to stay exact,
so register values and `stream_version` must go through `int64()` and `JsonViewer`'s value rendering, not
`Number()`. [ADR-11](../adr/0011-one-error-shape-over-three-envelopes.md) gives one `ApiError` for every
failure. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps payload visibility
separate from action rights. The mock server serves anything in `packages/testing/fixtures/_meta.json`.


## Plan of Work

### Milestone 1: client read and register table

In `packages/client-keiro/src/schemas.ts`, add `StoredSnapshot`: `stream` string, `stream_version` via
`int64()`, `state` unknown, `state_codec_version` number, `regfile_shape_hash` and `state_shape_hash`
nullable strings if the recorded body allows it, `state_bytes` number, and `created_at` and `updated_at`
timestamps, with `.passthrough()`. In `src/client.ts`, add
`snapshots: { show: (query: { stream: string }, signal?) => read(StoredSnapshot.nullable(), ["snapshot",
"show"], [], query, signal) }`. Add `keiroKeys.snapshots.show(stream)` in `src/query-keys.ts` and a row in
the README's table.

Create `apps/console/src/features/aggregates/registers.ts` with a pure `registersOf(state: unknown)` that
returns the `registers` object when `state` is an object whose `registers` is a non-array object with at
least one key, and `undefined` otherwise. Create `RegistersTable.tsx` showing name and value, sorted by
name, with values rendered through the same formatting `JsonViewer` uses. Render it in `FoldedStatePane`
above the JSON viewer, with the caption "Registers reported by this application". Keep the JSON viewer.

### Milestone 2: stored snapshot contents

Create `apps/console/src/features/aggregates/StoredSnapshotCard.tsx` and render it under `SnapshotCard`.
Before pressing, show the **Read stored snapshot** button and the sentence "Shows the raw persisted JSON,
which can include fields this application's display omits." Add `useStoredSnapshot(stream, enabled)` in
`queries.ts`, using `useSurfaceQuery` with `poll: false` and `enabled`, keep the pressed state in component
state keyed by `stream_name` so navigating to another aggregate resets it, and offer **Read again**.

After reading, show one of these. A `null` body shows "No stored snapshot for this stream." A failure shows
the `ApiError` message and code. A body shows its version with `PositionBadge`, `updated_at`, codec
version, shape hashes, bytes, and the JSON viewer over `state`. When both current and stored have registers
(`registersOf` on each), show a comparison table with columns Register, Current, and Stored, with changed
rows visibly marked in text and not by colour alone, using the union of names so a missing name shows `—`.
Head the table with the two versions: "current at state version N, stored at stream version M". Add a note
that the stored values are an advisory cache and can be older, and that the two were read at different
times. Do not call a difference an error.

Add tests to `apps/console/src/features/aggregates/aggregates.test.tsx` for no request before pressing, the
`null` body, a difference, `state` with no registers, and a failure, plus `apps/console/e2e/aggregates/`.
Update `docs/capabilities/aggregate-inspection.md` and the Aggregates part of
`docs/user/console-reference.md` with log entries. In
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md), add this rule and correct item 4 to
say the redaction seam does not yet exist, advancing `timestamp` and appending to `docs/adr/log.md`.


## Concrete Steps

Run from the repository root in `nix develop`, with the stack from the prerequisite plan running.

```bash
ID=$(curl -fsS 'http://127.0.0.1:9093/aggregate/list?name=credit-limit&limit=1' | jq -r '.items[0].aggregate_id')
curl -fsS "http://127.0.0.1:9093/aggregate/show?name=credit-limit&id=$ID" | jq '{state_version, stream_name, state}'
curl -fsS "http://127.0.0.1:9093/snapshot/show?stream=creditLimit-$ID" | jq '{stream_version, state}'
bun run --filter @keiro-ui/client-keiro test
bun run --filter @keiro-ui/console test -- aggregates
bun run check
bun run test
bun run test:e2e
cd apps/console && bunx playwright test --config playwright.live.config.ts
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
```

The two `curl` reads show `"balance": 25` and `"active": false`. If the list is empty, run `just
stack-seed`, whose `all` scenario seeds this example.


## Validation and Acceptance

With the stack and `bun run dev` running, open `/aggregates/credit-limit` and select an instance. A
Registers table shows `active false` and `balance 25` above the JSON viewer. The network panel shows no
`/snapshot/show` request. Press **Read stored snapshot**: exactly one request appears, and the card shows
stream version 1, the same values, no row marked changed, and the raw-data sentence. Open an `incident`
aggregate: no Registers table appears, because its `registers` is empty, and a stored read shows "No stored
snapshot for this stream." since its policy is `never`.

Component tests prove what the seed cannot show at will: current `balance` 30 against stored 25 marks that
row changed and shows both versions, and a register value above 2^53 keeps every digit.


## Idempotence and Recovery

Everything here is a read. Pressing the button repeatedly only re-reads. `just jitsurei-registers` in the
keiro checkout creates another credit-limit instance without disturbing data, if a second example is
useful. Revert with `git revert` of this plan's commits; only the ADR text and documents need checking.


## Interfaces and Dependencies

Prerequisite: `docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md` must
be Complete. It supplies these under `packages/testing/fixtures/keiro/`: `aggregate-show-credit-limit.json`,
`aggregate-snapshot-credit-limit.json`, `snapshot-show-credit-limit.json`, and `snapshot-show-missing.json`,
plus a stack whose port 9093 mounts aggregates.

This plan adds these to `@keiro-ui/client-keiro`, for the console only:

```typescript
client.snapshots.show(query: { stream: string }, signal?: AbortSignal): Promise<StoredSnapshot | null>
keiroKeys.snapshots.show(stream: string)
```

No mutating route is used, and `snapshot delete` remains out of scope. This plan owns the
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) amendment named in the parent MasterPlan
`docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md`.
