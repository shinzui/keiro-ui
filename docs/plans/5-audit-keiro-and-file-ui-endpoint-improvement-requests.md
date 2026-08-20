---
id: 5
slug: audit-keiro-and-file-ui-endpoint-improvement-requests
title: "Audit keiro and file UI endpoint improvement requests"
kind: exec-plan
created_at: 2026-08-20T03:01:42Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Audit keiro and file UI endpoint improvement requests

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime UI initiative (see `docs/masterplans/1-keiro-runtime-ui-foundations.md` in this repository, keiro-ui) is preparing a React web UI that lets an operator of any application built on the keiro runtime inspect aggregates, process managers, durable workflows, timers, projections, queues, subscriptions, and streams from a browser. The initiative's core principle is that every HTTP or WebSocket endpoint lives in the repository that owns the concept it exposes, because each runtime library is usable without keiro and may grow its own UI.

This plan covers the keiro framework repository itself, which lives on this machine at `/Users/shinzui/Keikaku/bokuno/keiro`. After this plan is complete, keiro's cross-repository improvement-request bundle (`docs/improvement-requests/` inside the keiro repository) contains a set of new, validated Improvement Request documents — one per endpoint capability the UI needs from keiro — each written against keiro's own conventions, each citing the constraining keiro architecture decisions, and each traceable back to this initiative via its `origin` field and Mori URIs. Filing the requests is the entire deliverable: implementing any endpoint is keiro's downstream work, planned and executed inside the keiro repository after the requests are accepted.

You can see the result working by running keiro's own OKF validation over the bundle (exact commands in Concrete Steps) and by resolving each new request's canonical URI, for example `mori path mori://shinzui/keiro/okf/improvement-requests/concepts/IR-26`, which prints the on-disk path of the new request file.


## Progress

- [ ] Milestone 1: Audit re-confirmed against the current keiro working tree (no-server absence, `keiro-ops` surface, schema tables, bundle profile, next free IR id).
- [ ] Milestone 2: All seven improvement-request documents drafted in `docs/improvement-requests/` in the keiro repository and passing profile validation locally.
- [ ] Milestone 2: `index.md` and `log.md` in the bundle updated.
- [ ] Milestone 3: Requests committed in the keiro repository with the cross-repository trailers; allocated `IR-N` handles recorded back into this plan (Surprises & Discoveries or an appended note) and into the MasterPlan registry notes.
- [ ] Milestone 3: Cross-links to the kiroku / pgmq-hs / shibuya requests (from `docs/plans/2-…`, `3-…`, `4-…` in keiro-ui) inserted where those handles exist, or their absence recorded for follow-up.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: File seven requests (HTTP ops layer, WebSocket live feeds, aggregate reads, process-manager reads, workflow-inspection completeness, composition/mounting, stance ADR) rather than one omnibus "add a UI API" request.
  Rationale: keiro's bundle convention is one concern per request with its own acceptance (see the existing IR-22); an omnibus request could not be accepted or implemented incrementally, and the seven concerns have different owners inside keiro (ops surface, library reads, composition).
  Date: 2026-08-19

- Decision: Confront keiro's recorded "no parallel workflow engine UI" stance explicitly, in a dedicated request that proposes an ADR, instead of leaving the tension implicit.
  Rationale: `docs/why-keiro.md` in the keiro repository states the stance as a selling point; filing endpoint requests that silently contradict it invites rejection. The honest reframing is that OpenTelemetry covers metrics and traces while the requested surface covers state browsing and safe operator actions, which OTel dashboards cannot do.
  Date: 2026-08-19

- Decision: Sequence every read capability library-first: each request asks for the library-level read API in the owning keiro package first, and only then for the endpoint that wraps it.
  Rationale: keiro ADR-28 (canonical handle `mori://shinzui/keiro/okf/adrs/concepts/ADR-28`) requires operator surfaces to wrap supported library APIs; requesting endpoints without the underlying primitives would specify something unimplementable under keiro's own rules.
  Date: 2026-08-19

- Decision: Delegate concept ownership downward: stream/event browsing to kiroku, queue mechanics to pgmq-hs, processor supervision to shibuya. keiro requests cover only framework-level concepts and the composition story.
  Rationale: MasterPlan layer-ownership matrix (`docs/masterplans/1-keiro-runtime-ui-foundations.md`, Integration Points). Duplicating lower-layer concepts behind keiro endpoints would violate the initiative's core principle and keiro ADR-28's schema-ownership rule.
  Date: 2026-08-19

- Decision: Author against the bundle's pinned profile (okf-profiles v0.5.0 via `mori/improvement-requests-profile.dhall`) and imitate the frontmatter of the newest existing record exactly; do not upgrade the pin.
  Rationale: MasterPlan decision (2026-08-19). Pin upgrades are separate maintenance with their own blast radius.
  Date: 2026-08-19


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

### The two repositories involved

This plan file lives in **keiro-ui** (`/Users/shinzui/Keikaku/bokuno/keiro-ui`), the coordination repository for the UI initiative. All the work the plan directs happens in **keiro** (`/Users/shinzui/Keikaku/bokuno/keiro`), a separate git repository. Audit facts below were captured on 2026-08-19 at keiro commit `15d00486` (version 0.13.0.0); Milestone 1 re-verifies them because keiro moves quickly.

### What keiro is

keiro is a Haskell event-sourcing framework and workflow engine. An application links keiro as a library and runs against its own PostgreSQL database; there is no keiro server process. It composes sibling libraries: kiroku (the append-only Postgres event store), keiki (pure transition semantics), shibuya (supervised queue workers), and the pgmq-hs family (Postgres-native work queues, consumed through keiro's `keiro-pgmq` package). The cabal workspace contains, among others: `keiro-core` (contracts), `keiro` (the runtime), `keiro-migrations` (schema migrations), `keiro-pgmq` (queue integration), `keiro-ops` (operational CLI), `keiro-dsl` (typed-spec toolchain), `keiro-test-support`, and `jitsurei` (examples).

### The audit findings this plan acts on

**keiro has no HTTP server, no WebSocket endpoint, and no network listener of any kind.** A repository-wide search for `servant`, `warp`, `websockets`, `wai` finds nothing in any cabal or source file. All six executables are CLI/batch tools. The absence is a stated stance, not an oversight: `docs/why-keiro.md` (around line 474 at audit time) says "There is no parallel \"workflow engine UI\" to maintain" — meaning keiro's spans, gauges, and histograms flow through OpenTelemetry into whatever dashboards the operator already runs. The requests this plan files must engage that stance (see Decision Log).

**`keiro-ops` is the reusable operational surface.** The package `keiro-ops` is an embeddable CLI, not just a binary: `keiro-ops/src/Keiro/Ops.hs` exports `mainWithHooks`, `AppHooks`, `opsCommandTree`, and `runOpsInvocation`, so an application mounts typed hooks (for example `workflowResume`, `projectionCatalog`) and reuses the parser and dispatcher in-process. Every command renders into a machine envelope, `OpsResult { headers :: [Text], rows :: [[Text]], jsonValue :: Value }` (`keiro-ops/src/Keiro/Ops/Render.hs`), with `--json` emitting `jsonValue` verbatim. A predicate `isMutation :: Command -> Bool` classifies every command as read or write. Mutations return `PreviewRequired` and refuse to run without `--force`, and every invocation fails closed on schema drift unless `--allow-schema-drift` is passed. Command domains: `wf` (workflow list/show/steps/journal/awakeable/cancel/resurrect/lease/gc), `timer`, `stream`, `outbox`, `inbox`, `pgmq` (DLQ read/redrive/archive/purge), `projection`, `shard`, `snapshot`, `rebuild`, `replay-audit`.

**Persisted framework state lives in a dedicated `keiro` PostgreSQL schema** (11 tables at schema version v18): `keiro_workflows` (the authoritative workflow instance "wake ledger": status, attempts, lease, next attempt), `keiro_workflow_steps` (journal step index), `keiro_workflow_children` (parent/child links), `keiro_awakeables` (durable promises awaiting external signals), `keiro_timers`, `keiro_snapshots` (advisory aggregate snapshots), `keiro_read_models`, `keiro_projection_dedup`, `keiro_subscription_shards` (bucket ownership leases), `keiro_outbox`, and `keiro_inbox`. Domain events themselves live in kiroku's schema; subscription checkpoints live in kiroku's `subscription_checkpoints_v1` view.

**The only push primitive is `Keiro.Wake`** (`keiro/src/Keiro/Wake.hs`): Postgres LISTEN/NOTIFY on channel `<schema>.events`, fired by kiroku on append, surfaced as `WakeSignal`/`WakeReason` (`WokenByNotify | WokenByTimeout`). NOTIFY is best-effort and unqueued for disconnected listeners — push is a wake-up hint, polling is the source of truth. Any requested live feed must say so.

**External reads are guarded SQL contracts.** keiro publishes versioned, frozen, execute-only functions and views in a `keiro_read` schema (for example `keiro_read.projection_group_status_v1`); external readers never receive rights on the private `keiro` or `kiroku` schemas.

**Coverage gaps the UI cares about:** there is no aggregate browser (aggregate state is folded from kiroku events, optionally accelerated by `keiro_snapshots`; no keiro read API lists aggregate streams or hydrates state for display), no process-manager read API (PM state is journaled into kiroku streams; only shard leases are tabled), and no keiro-owned view of subscription positions (they are kiroku's).

### Constraining architecture decisions (cite these in every relevant request)

No ADR corpus exists in keiro-ui yet (EP-1, `docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md`, creates it). The constraining decisions are keiro's and kiroku's, cited by canonical Mori handle:

- `mori://shinzui/keiro/okf/adrs/concepts/ADR-28` — every operator command wraps a supported, exported operation from the library that owns the affected state; no ad-hoc SQL against private tables; missing primitives are added to the owning library first. It also fixes reporting vocabulary: `store_position`, `visible_store_head`, and "global position distance" — never "lag", "backlog", or "events behind" on keiro surfaces.
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-35` — projection group status is a frozen, owner-rights SQL contract.
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-36` — external readers use versioned guarded SQL contracts in `keiro_read`.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` — a `RecordedEvent` carries a surrogate stream id; display names require a batch lookup step. Any requested endpoint returning fan-in events must budget that resolution.

### The improvement-request bundle and its conventions

"OKF" is the Open Knowledge Format: a bundle is a directory of Markdown concept files with YAML frontmatter, governed by a Dhall "profile" that pins required fields and ID rules, validated by the `okf` CLI. keiro's improvement-request bundle is `docs/improvement-requests/` (registered in keiro's `mori.dhall` under `okfBundles` with profile `mori/improvement-requests-profile.dhall`, pinned to okf-profiles v0.5.0). Records are flat kebab-case-slug files; the `IR-N` handle lives in frontmatter, not the filename. At audit time 25 requests existed (IR-1 … IR-25), so the next handle is expected to be IR-26 — but handles are allocated only by asking the CLI (`okf id next`), never by counting.

Imitate the frontmatter of the existing record `docs/improvement-requests/make-read-models-safely-readable-by-out-of-process-consumers.md` (IR-22) exactly:

```yaml
---
type: Improvement Request
title: Make read models safely readable by out-of-process consumers
description: >-
  Give a non-Haskell consumer reading a Keiro read model over SQL a way to observe the group
  fence, and give rebuilds a zero-downtime path, so an external reader can never mistake a
  truncated or partially replayed target for current truth.
timestamp: 2026-08-10T20:40:00Z
requestId: IR-22
status: proposed
origin: mori://shinzui/keiro
---
```

For this plan's requests, `origin` is `mori://shinzui/keiro-ui` (the project raising the request), `status` is `proposed`, and `timestamp` is the authoring time in RFC3339 UTC ending in `Z`. Do not add structured `dependencies` or `acceptanceCriteria` frontmatter — no released profile defines them; dependency and acceptance content is body prose. Body structure, imitating IR-22's register: a `# Improvement Request: <Title>` heading, then `## Status`, `## Context`, `## Requested Change`, `## Acceptance` (numbered, testable), `## Requested Deliverables`.

IR-22 is also the substantive precedent to cite: it is exactly the "someone outside the process needs to see keiro state safely" story, and it produced ADR-35/ADR-36. The cross-repository linking pattern to imitate is the chain keiro IR-9 → shibuya IR-2 → shibuya-pgmq-adapter IR-1, where a downstream need was driven upstream one repository at a time, linked by canonical handles.

### Related plans in this repository

- `docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md` (EP-1) produces `docs/architecture/inspection-api-conventions.md` in keiro-ui and the keiro-ui ADR bundle. Cite the conventions document in requests as: canonical project URI `mori://shinzui/keiro-ui` plus repository-relative path `docs/architecture/inspection-api-conventions.md`, noting the artifact-level URI is pending. Once keiro-ui ADR handles exist (`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`), cite those too.
- `docs/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests.md` (EP-2), `docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md` (EP-3), and `docs/plans/4-audit-shibuya-and-file-ui-endpoint-improvement-requests.md` (EP-4) file the lower-layer requests this plan's requests delegate to and cross-link.


## Plan of Work

### Milestone 1 — Re-confirm the audit against the current keiro tree

Scope: verify, in `/Users/shinzui/Keikaku/bokuno/keiro`, every fact this plan's requests assert, so no request ships a stale claim. At the end of this milestone you have a short evidence list (recorded under Surprises & Discoveries if anything changed) and the confirmed next IR handle.

Verify: (a) still no `servant`/`warp`/`websockets`/`wai` in any `.cabal` file; (b) `docs/why-keiro.md` still carries the "no parallel workflow engine UI" sentence (adjust the quoted line if it moved); (c) `keiro-ops/src/Keiro/Ops.hs` still exports `mainWithHooks`, `AppHooks`, `opsCommandTree`, `runOpsInvocation`, and `keiro-ops/src/Keiro/Ops/Render.hs` still defines `OpsResult`; (d) the bundle still validates cleanly before you touch it (run the validation command below — a pre-existing failure is a blocker to report, not to fix silently); (e) the next free handle via `okf id next`. If any of (a)–(c) changed materially, stop and record the change in Surprises & Discoveries and adjust the affected request drafts before proceeding.

Acceptance: all checks run; results recorded; next handle known.

### Milestone 2 — Author the seven requests

Scope: create seven new files in `/Users/shinzui/Keikaku/bokuno/keiro/docs/improvement-requests/`, update the bundle's `index.md` and `log.md`, and reach a clean validation. Assign `requestId` values in the order listed below, starting from the handle `okf id next` reported (expected IR-26 through IR-32; use whatever the CLI says).

Each request below is summarized here with its working slug, the problem it states, and what its Requested Change and Acceptance must cover. Write each as a full document in IR-22's register — Context grounded in the audit facts from Context and Orientation, Requested Change naming packages and modules, Acceptance as numbered, testable statements, Requested Deliverables naming concrete artifacts (library APIs, packages, docs, tests, an ADR where stated).

1. `serve-the-keiro-ops-surface-over-http` — **An HTTP inspection-and-operations package layered on keiro-ops.** Problem: the typed operational surface exists only as a CLI. Requested change: a sister package (working name `keiro-ops-http`; the request may propose `keiro-http`) that serves the read-only subset of `opsCommandTree` — derived mechanically from `isMutation` — as JSON endpoints reusing the `OpsResult` envelope; mutations are exposed only behind the existing preview/force discipline (a preview response, then an explicit confirmed call) and the fail-closed schema-drift handshake; applications embed the WAI application via the same `AppHooks` they already mount for the CLI; no web dependency enters any existing keiro package (the pattern kiroku-metrics and shibuya-metrics already follow in their repositories). Acceptance includes: read-only endpoints return the same `jsonValue` the CLI's `--json` emits for the same invocation; a mutation without confirmation returns the preview and performs nothing; schema drift yields a refusal, not partial output. Cite ADR-28 (wrapping, vocabulary) and the conventions document.
2. `publish-websocket-live-feeds-over-keiro-wake` — **WebSocket live feeds for framework state.** Problem: a UI needs live workflow/timer/projection status without polling storms. Requested change: WebSocket feeds in the same sister package, built on `Keiro.Wake`, following the cross-project WS convention from EP-1 (typed JSON frames, subscribe/unsubscribe, snapshot-then-delta, ping/pong, bounded queues with overflow signaling); the request must state the NOTIFY caveat verbatim: push is a best-effort hint, every feed pairs with a polling fallback, and the feed must never be presented as the source of truth. Acceptance includes: a subscriber receives a snapshot then deltas for a workflow status change; a killed LISTEN connection degrades to polling without client-visible corruption.
3. `expose-aggregate-inspection-read-apis` — **Aggregate inspection at the library level.** Problem: no supported way to list aggregate streams or view current aggregate state. Requested change: new read APIs in the owning packages (`keiro`/`keiro-core`) — list aggregate streams by category, hydrate current state for display via the existing snapshot-plus-fold machinery (the `Hydrated` path in `keiro/src/Keiro/Command.hs`), expose snapshot metadata from `keiro_snapshots` — and only then endpoints wrapping them. Explicitly delegate raw stream/event browsing to kiroku's requested endpoints (cite the kiroku IR handles filed by EP-2 when available; name the dependency in prose otherwise). Cite kiroku ADR-1 for name resolution.
4. `expose-process-manager-inspection-reads` — **Process-manager inspection.** Problem: PM state journals into kiroku streams and is invisible to operators. Requested change: library-level reads reconstructing a PM instance view from its journal streams, plus lease/ownership views over `keiro_subscription_shards`, plus per-PM timer listings; endpoints wrap those reads. Same delegation and ADR-28 discipline as request 3.
5. `complete-workflow-inspection-primitives-for-http` — **Workflow/durable-execution inspection completeness.** Problem: `keiro-ops wf` covers much of workflow inspection, but a UI needs cursor-paged listings and detail reads (journal, steps, children, awakeables) shaped for incremental rendering rather than one-shot CLI output. Requested change: whatever read primitives the HTTP layer still lacks, added to the owning library and exposed per request 1's envelope. Acceptance phrased against `keiro_workflows` as the authoritative wake ledger.
6. `mount-composed-runtime-inspection-surfaces` — **Composition/mounting.** Problem: an application composing keiro, kiroku, shibuya, and pgmq wants one process and one port serving all inspection surfaces. Requested change: keiro owns a mounting story — one WAI application composing keiro's inspection app with kiroku-metrics' and shibuya-metrics' WAI applications (and pgmq-hs's future surface) under per-surface path prefixes — because keiro is already the layer that composes the libraries. Reference EP-3 and EP-4's filed handles at filing time; name the dependency in prose if they are not yet filed.
7. `record-the-inspection-ui-boundary-in-an-adr` — **The stance ADR.** Problem: `docs/why-keiro.md` positions "no parallel workflow engine UI" as a design stance; the six requests above would silently erode it. Requested change: record in a keiro ADR that the inspection surface is a sanctioned, bounded exception — state browsing and safe operator actions over supported APIs, while metrics and traces stay in OTel dashboards — so acceptance of the other requests is an explicit architectural decision, not drift. Acceptance: the ADR exists, is validated in keiro's `docs/adr/` bundle, and `docs/why-keiro.md` is updated to point at it.

Update `docs/improvement-requests/index.md` (add one bullet per request in its `# Improvement Request` section, matching the existing `[Title](file.md) - description` format) and `log.md` (one dated `## YYYY-MM-DD` section with an `* **Addition**:` entry naming all seven).

Acceptance: validation passes (Concrete Steps), and each file's frontmatter matches the IR-22 shape with the correct `requestId` and `origin: mori://shinzui/keiro-ui`.

### Milestone 3 — File, cross-link, and record handles

Scope: commit the new records in the keiro repository, then propagate the allocated handles.

Record the final `IR-N` ↔ slug mapping in this plan (append a dated note; also add a line to the MasterPlan's Surprises & Discoveries if the numbering differed from the IR-26…IR-32 expectation). Where EP-2/EP-3/EP-4 have already filed their requests, edit requests 3, 4, and 6 to cite the concrete handles (this is an ordinary bundle update: adjust the files, refresh `log.md` with an `* **Update**:` entry, re-validate, re-commit). Where they have not, leave the prose dependency and record the follow-up as an unchecked Progress item here.

Acceptance: commits exist in keiro with the trailers below; `mori path` resolves each new handle; this plan and the MasterPlan reflect the real handles.


## Concrete Steps

All commands run from `/Users/shinzui/Keikaku/bokuno/keiro` unless stated otherwise.

Milestone 1 verification:

```bash
grep -rniE 'servant|warp|websockets|\bwai\b' --include='*.cabal' . ; echo "exit: $?"
```

Expected: no matches, `exit: 1`. Any match means the audit is stale — record it and reassess request 1.

```bash
grep -n 'workflow engine UI' docs/why-keiro.md
grep -n 'mainWithHooks\|opsCommandTree\|runOpsInvocation' keiro-ops/src/Keiro/Ops.hs | head -5
grep -n 'OpsResult' keiro-ops/src/Keiro/Ops/Render.hs | head -3
```

Expected: each grep prints at least one line. Then confirm the bundle is clean and get the next handle:

```bash
okf validate docs/improvement-requests --profile mori/improvement-requests-profile.dhall --profile-enforce --log-enforce
okf id list docs/improvement-requests --profile mori/improvement-requests-profile.dhall | tail -3
okf id next docs/improvement-requests IR --profile mori/improvement-requests-profile.dhall
```

Expected: validation reports success with zero errors; `okf id next` prints a single handle (expected `IR-26`). Note: keiro's `Justfile` has OKF recipes for other bundles; check `just --list` and prefer an improvement-requests recipe if one exists, otherwise the direct `okf validate` above is authoritative.

Milestone 2 authoring: create the seven files listed in Plan of Work, then re-run the same `okf validate` command. Expected: success with the seven new concepts counted. A profile violation names the file and field — fix and re-run; validation is read-only and safe to repeat.

Milestone 3 filing (in `/Users/shinzui/Keikaku/bokuno/keiro`, on its current branch, following keiro's own commit checks):

```bash
git add docs/improvement-requests
git commit -m "docs(okf): file keiro-ui inspection endpoint improvement requests" \
  -m "Seven proposed requests raised by the keiro runtime UI initiative: HTTP ops
surface, WebSocket live feeds, aggregate and process-manager reads, workflow
inspection completeness, composed mounting, and the inspection-UI boundary ADR.

MasterPlan: mori://shinzui/keiro-ui/masterplans/1-keiro-runtime-ui-foundations
ExecPlan: mori://shinzui/keiro-ui/plans/5-audit-keiro-and-file-ui-endpoint-improvement-requests"
```

The trailers use canonical Mori URIs because the commit lands in keiro while the plans live in keiro-ui; a repo-relative path would be ambiguous there. Commits that update this plan file itself land in keiro-ui and use repository-relative trailers instead (`MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md`, `ExecPlan: docs/plans/5-audit-keiro-and-file-ui-endpoint-improvement-requests.md`). No `Intention:` trailer is used anywhere in this initiative.

Then verify resolution (any directory):

```bash
mori path mori://shinzui/keiro/okf/improvement-requests/concepts/IR-26
```

Expected: prints the absolute path of the corresponding new file. If artifact-level resolution fails because registry data lags, record it in Surprises & Discoveries — the URI remains the canonical reference; do not substitute a bare path in any cross-repository document.


## Validation and Acceptance

The plan is complete when: (1) `okf validate docs/improvement-requests --profile mori/improvement-requests-profile.dhall --profile-enforce --log-enforce` passes in the keiro repository with the seven new records present; (2) each record's frontmatter carries `origin: mori://shinzui/keiro-ui`, `status: proposed`, and a CLI-allocated `requestId`; (3) `index.md` lists and `log.md` journals all seven; (4) the filing commit exists in keiro with both Mori-URI trailers; (5) this plan's Progress reflects reality and the handle mapping is recorded; (6) requests 3, 4, and 6 either cite concrete EP-2/EP-3/EP-4 handles or carry the recorded follow-up. Content acceptance: a reader of any single request who has never seen this plan can tell what keiro must add, why keiro's own ADRs permit it, and how acceptance would be tested — that is the self-containment bar IR-22 sets.


## Idempotence and Recovery

Everything here is additive and repeatable. `okf validate`, `okf id list`, `okf id next`, and `mori path` are read-only. `okf id next` allocates nothing — if other requests land in keiro between drafting and filing, re-run it and renumber your drafts before committing; handles must never be reused or gap-filled. If validation fails after authoring, fix the named file and re-run; nothing else depends on ordering. If a commit was made with wrong handles or trailers, do not rewrite published history in keiro — follow with a correcting commit carrying the same trailers. If EP-2/3/4 handles arrive after filing, updating the requests is a normal bundle edit (change files, add a `log.md` `* **Update**:` entry, re-validate, re-commit).


## Interfaces and Dependencies

Tools: the `okf` CLI (bundle validation and handle allocation), `mori` (URI resolution and registry checks), `git`, and keiro's `just` recipes where applicable. No Haskell is built or run by this plan.

Repositories: read/write `/Users/shinzui/Keikaku/bokuno/keiro` (only `docs/improvement-requests/`); read-only reference to `/Users/shinzui/Keikaku/bokuno/keiro-ui` (this plan, the MasterPlan, and — once EP-1 lands — `docs/architecture/inspection-api-conventions.md`).

Documents this plan depends on (soft): EP-1's conventions document and keiro-ui ADR handles (cite when present; prose-pending otherwise); EP-2/EP-3/EP-4's filed IR handles for requests 3, 4, and 6.

Interfaces the requests reference but this plan must not touch: `Keiro.Ops` (`mainWithHooks`, `AppHooks`, `opsCommandTree`, `runOpsInvocation`, `isMutation`), `Keiro.Ops.Render` (`OpsResult`), `Keiro.Wake` (`WakeSignal`, `WakeReason`), the `keiro` schema tables and `keiro_read` contracts named in Context and Orientation. They are cited as the implementation substrate the requests point keiro's own future plans at.
