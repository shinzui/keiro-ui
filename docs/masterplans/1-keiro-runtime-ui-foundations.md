---
id: 1
slug: keiro-runtime-ui-foundations
title: "Keiro runtime UI foundations"
kind: master-plan
created_at: 2026-08-20T03:01:06Z
---

# Keiro runtime UI foundations

This MasterPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Vision & Scope

The keiro runtime is a composable Haskell stack for event-sourced systems: **keiro** (the framework: commands, aggregates, read models and projections, process managers, routers, timers, durable workflows, outbox/inbox) sits on **kiroku** (the append-only PostgreSQL event store with durable subscriptions), **keiki** (pure transition semantics), **shibuya** (supervised queue processing with explicit acks, backpressure, and batching), and **pgmq-hs** (the PostgreSQL-native work queue client). An application links these libraries and runs against its own PostgreSQL database; there is no central server.

Today an operator of such an application has OpenTelemetry traces and three partial HTTP surfaces (`kiroku-metrics`, `shibuya-metrics`, and the `keiro-ops` CLI), but no way to point a browser at the system and *see* it: which aggregates exist and what state they hold, which workflows are running or stuck, what a process manager last did, how deep the queues are, where every subscription's checkpoint sits, which projections are fresh, and what is in the dead-letter queues.

This initiative prepares the ground for a web UI (React; component library deliberately undecided between IntentUI and shadcn/ui) that any application using the keiro runtime can embed or run beside its deployment. When this MasterPlan is complete:

1. Each runtime repository — kiroku, pgmq-hs, shibuya (and shibuya-pgmq-adapter), and keiro — carries **OKF Improvement Requests in its own `docs/improvement-requests/` bundle** that specify exactly the HTTP and WebSocket endpoints (and the missing library-level read APIs beneath them) that the UI needs from that project. Each request is grounded in an audit of what already exists, follows the repository's pinned `coordination.improvementRequests` profile, and validates with that repository's own `okf` tooling.
2. This repository (keiro-ui) carries a **cross-project inspection API and WebSocket conventions document** plus a seeded `docs/adr/` corpus recording the durable boundary decisions, so the four repositories' independently implemented endpoints compose into one coherent UI instead of four dialects.
3. This repository carries a **general-direction document for the UI itself**: information architecture, screen inventory mapped to runtime concepts, the data layer and live-update strategy, and the deployment/embedding story — informed by a survey of prior art (Restate's durable-execution UX in particular, plus Temporal, AxonIQ Console, Kurrent/EventStoreDB, Redpanda Console, and job-queue dashboards).

The **core principle** the whole initiative enforces: *every endpoint lives in the project that owns the concept it exposes.* Each library is usable without keiro and may grow its own UI; keiro composes their surfaces rather than reaching into their private schemas. This is not a new invention — it is already the stack's stated architecture (shibuya CAP-10: "a separate package rather than part of the core precisely so that adopting Shibuya does not mean adopting a web server"; kiroku masterplan 5 created `kiroku-metrics` so `kiroku-store` never depends on a web framework; keiro ADR-28 forbids operator surfaces from bypassing owning-library APIs).

Explicitly **excluded** from this MasterPlan: implementing any endpoint (each repository will do that under its own plans, driven by the improvement requests filed here); building the React application; choosing the UI component library; adding authentication/authorization designs beyond recording the current gaps; and modernizing the `keiro-runtime-jitsurei` example application.


## Decomposition Strategy

The initiative decomposes **by repository ownership boundary**, which in this stack coincides with functional concern: queues belong to pgmq-hs, supervised processors to shibuya, streams/events/subscriptions to kiroku, and aggregates/workflows/process managers/projections/timers/ops to keiro. An alternative decomposition by UI concept (one plan for "queues", one for "workflows", …) was rejected because improvement requests must be filed per-repository against per-repository OKF bundles, profiles, and conventions; a per-concept split would force every plan to touch every repository and to repeat every repository's authoring contract. A single monolithic audit-everything plan was rejected because the four audits are independently verifiable, have no ordering constraints among themselves, and would exceed any reasonable single-plan scope.

Two cross-cutting concerns get their own plans. Conventions (EP-1) come first because four repositories filing endpoint requests independently will otherwise diverge on wire format, WebSocket protocol shape, pagination, and naming — the audits found two existing WebSocket dialects (shibuya-metrics and kiroku-metrics) that already differ. The UI general direction (EP-6) comes last because the user's stated sequence is audit → improvement requests → direction, and because a direction document written before the endpoint surfaces are specified would guess at its own data layer.

Pre-plan audits of all four repositories (run during MasterPlan creation, August 2026) ground the decomposition:

- **kiroku** already ships `kiroku-metrics` (Warp/WAI, port 9091): JSON metrics, Prometheus, health, live `/subscriptions` registry, and a replayable WebSocket event tail (`/ws/events` with `from_position` and category filter). Missing for a UI: any REST read API (list/search streams, browse categories, events by id), public dead-letter reads, durable cross-process checkpoint inventory over HTTP, CORS. Its IR bundle is the established "keiro needs kiroku to expose X" channel — six of seven existing IRs originate from keiro.
- **pgmq-hs** is entirely greenfield on the transport side: libraries only, zero executables, no wai/warp/websockets in the dependency closure, no OKF improvement-requests bundle (only `capabilities`), and no `docs/adr/` (durable notes live in `docs/design/`). It also lacks the library primitives a queue browser needs: non-destructive peek, archive reads, message-by-id, and JSON instances on domain records.
- **shibuya** ships `shibuya-metrics` (port 9090): JSON metrics, Prometheus, health probes, and a WebSocket with subscribe/snapshot/delta protocol. The runtime's only noun is `ProcessorId` — no queue depth, lag, in-flight message lists, DLQ browsing, latency histograms, or control actions. Two designs exist but were never implemented (SSE in `docs/plans/METRICS_WEB_UI.md`, pause/resume in `docs/plans/PROCESSOR_PAUSE_DESIGN.md`). `shibuya-metrics` has no tests, no auth, and no CORS.
- **keiro** has no HTTP/WS surface at all, by explicit stance (`docs/why-keiro.md`: "There is no parallel 'workflow engine UI' to maintain" — observability routes through OTel into the operator's own dashboards). Its operational surface is `keiro-ops`, an embeddable CLI with a typed command tree, a stable JSON envelope (`OpsResult`), a read/write classifier (`isMutation`), and preview/force discipline — the natural seam for an HTTP layer. Aggregate browsing, process-manager state, and subscription positions have no keiro-owned read APIs today.

ADR context. This repository has no `docs/adr/` and no OKF bundles; **no local ADR exists** — EP-1 creates the corpus. The cross-repository decisions that constrain this initiative, cited by canonical Mori handle:

- `mori://shinzui/keiro/okf/adrs/concepts/ADR-28` — operator commands wrap supported library APIs and respect schema ownership. Any keiro endpoint layer must sit on owning-library APIs, never ad-hoc SQL into another library's private tables; it also fixes reporting vocabulary (`store_position`, `visible_store_head`, "global position distance" — never "lag" or "backlog" for keiro surfaces).
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-35` — projection group status is a frozen owner-rights SQL contract (`keiro_read.projection_group_status_v1`); external readers never get the private `keiro` or `kiroku` schemas.
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-36` — external readers use versioned guarded SQL contracts in `keiro_read`.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` — stream names resolve via an on-demand batch lookup, not a `RecordedEvent` field; every UI surface showing fan-in events must plan a second resolution step.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-3` — all kiroku objects live in a dedicated schema; the schema name also scopes the LISTEN notification channel.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-6` — database-native integration surfaces are owner-published, frozen, versioned relations (the precedent for `kiroku.subscription_checkpoints_v1`).


## Exec-Plan Registry

| # | Title | Path | Hard Deps | Soft Deps | Status |
|---|-------|------|-----------|-----------|--------|
| 1 | Define cross-project inspection API and WebSocket conventions | docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md | None | None | Complete |
| 2 | Audit kiroku and file UI endpoint improvement requests | docs/plans/2-audit-kiroku-and-file-ui-endpoint-improvement-requests.md | None | EP-1 | Complete |
| 3 | Audit pgmq-hs and file UI endpoint improvement requests | docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md | None | EP-1 | Complete |
| 4 | Audit shibuya and file UI endpoint improvement requests | docs/plans/4-audit-shibuya-and-file-ui-endpoint-improvement-requests.md | None | EP-1 | Complete |
| 5 | Audit keiro and file UI endpoint improvement requests | docs/plans/5-audit-keiro-and-file-ui-endpoint-improvement-requests.md | None | EP-1, EP-2, EP-3, EP-4 | Complete |
| 6 | Set the general direction for the keiro runtime UI | docs/plans/6-set-the-general-direction-for-the-keiro-runtime-ui.md | EP-1 | EP-2, EP-3, EP-4, EP-5 | Not Started |


## Dependency Graph

EP-1 (conventions) has no dependencies and should run first. EP-2, EP-3, and EP-4 (kiroku, pgmq-hs, shibuya) depend on EP-1 only softly: an improvement request states a need, not a final wire format, so the audits and even the request drafts can proceed before the conventions land — but requests filed after EP-1 can cite the conventions document as shared acceptance context, and requests filed before it must be revisited. Running EP-1 to completion first is the cheapest ordering; EP-2/3/4 may then proceed **in parallel with each other** because they touch disjoint repositories.

EP-5 (keiro) softly depends on EP-2, EP-3, and EP-4 because keiro composes the lower layers: its improvement requests must reference the endpoint surfaces the other repositories will own (by their canonical `mori://…/okf/improvement-requests/concepts/IR-N` handles) rather than duplicating those concepts behind keiro-owned endpoints. The dependency is soft, not hard — keiro's own audit and its framework-level requests (workflow inspection, aggregate reads, ops-over-HTTP) are meaningful regardless — but the composition and non-duplication sections of its requests need the other plans' filed IR handles.

EP-6 (UI direction) hard-depends on EP-1 because its data-layer and live-update direction is an application of the conventions (WebSocket protocol shape, pagination, error envelope, CORS posture); writing it against unsettled conventions would produce a direction document that contradicts the contract the endpoints will actually follow. It softly depends on EP-2 through EP-5: the screen inventory becomes concrete by citing the filed improvement requests, but the prior-art survey and information-architecture work can begin at any time.

Nothing in this MasterPlan blocks on any other repository accepting or implementing a filed improvement request; acceptance and implementation are downstream of this initiative.


## Integration Points

**The conventions document and the keiro-ui ADR corpus** (owner: EP-1; consumers: EP-2–EP-6). EP-1 writes `docs/architecture/inspection-api-conventions.md` in this repository and seeds `docs/adr/` as a profiled OKF bundle (`documentation.architectureDecisions` from okf-profiles, pinned at the current release tag, registered in this repository's `mori.dhall` under `okfBundles`), giving the boundary decisions stable cross-repo handles of the form `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`. Improvement requests filed by EP-2–EP-5 cite those handles; until EP-1 completes, later plans must not invent the handles. The conventions document itself is cited cross-repo as the canonical project URI plus repository-relative path (`mori://shinzui/keiro-ui`, `docs/architecture/inspection-api-conventions.md`) with the artifact-level URI noted as pending.

**The layer-ownership matrix** (owner: EP-1 as an ADR; consumed by every other plan). Which concept's endpoints live where: queue-level views (queue list, depth/age metrics, peek, archive browsing, message-by-id) belong to **pgmq-hs**; processor/pipeline supervision views (processor state, throughput, batching, in-flight, pause/resume) to **shibuya**, with queue-backed context (depth behind a processor, DLQ contents) to the **shibuya adapters**; store-level views (streams, events, categories, `$all` tail, durable subscription checkpoints, store dead letters) to **kiroku**; framework-level views (aggregates, process managers, durable workflows, timers, projections and rebuilds, outbox/inbox, job semantics on queues) to **keiro**; and cross-cutting composition (one process serving all mounted surfaces, plus the browser app) to **keiro** (mounting) and **keiro-ui** (the app). Overlaps are resolved toward the lower layer: keiro's queue screens consume pgmq-hs-owned endpoints for queue mechanics and add only job-level semantics (`Job`, DLQ redrive policy) that pgmq-hs cannot know.

**The WebSocket protocol convention** (owner: EP-1; consumers: EP-2, EP-4, EP-5, EP-6). Two live dialects exist: shibuya-metrics (`shibuya-metrics/src/Shibuya/Metrics/Types.hs`: `subscribe_all`/`subscribe`/`unsubscribe`/`ping` → `snapshot`/`update`/`pong`/`goodbye`, 100 ms delta pushes) and kiroku-metrics (`kiroku-metrics/src/Kiroku/Metrics/WebSocket.hs`: `subscribe_metrics`/`subscribe_events` with `from_position` and `category` → `snapshot`/`event`/`event_stream_started`/`error`/`goodbye`, bounded DropOldest queues). EP-1 defines the convention as a superset compatible with both (typed JSON frames with a `type` tag, explicit subscribe/unsubscribe, snapshot-then-delta, ping/pong, bounded queues with overflow signaling, replay cursors where the domain has them); EP-2 and EP-4 file convergence requests only where alignment is additive, never breaking published protocols.

**Postgres LISTEN/NOTIFY as the live-update substrate** (plans: EP-2, EP-3, EP-5; informative for EP-6). Three implementations exist or are implied: kiroku's `kiroku.notify_events()` trigger on channel `<schema>.events` with a dedicated LISTEN connection and reconnect/backoff (`kiroku/docs/architecture/notifier.md`), keiro's `Keiro.Wake` consuming the same mechanism, and pgmq's `enable_notify_insert` throttled notifications (pgmq-hs `docs/design/015-notification-delivery-contract.md`). The shared constraint every plan must carry: **NOTIFY is a best-effort wake-up hint — every live endpoint needs a polling fallback and must never treat push as the source of truth.**

**The OKF improvement-request authoring contract** (all of EP-2–EP-5). Every request is authored against the **repository's own pinned profile** (they differ: keiro/kiroku/shibuya pin okf-profiles v0.5.0 for improvement requests, whose records use `timestamp`-era frontmatter; newer bundles use the `generated` family), with the ID taken from `okf id next <bundle> IR --profile <bundle>/profile.dhall` at filing time — never derived by counting. Filing updates the bundle's `index.md` and `log.md` and must pass the repository's own validation (`okf validate <bundle> --profile <bundle>/profile.dhall --profile-enforce --log-enforce`, plus each repo's `just`/CI recipes where they exist). Audit-time next-free IDs (kiroku IR-8, shibuya IR-3, shibuya-pgmq-adapter IR-2, keiro IR-26, pgmq-hs IR-1 after EP-3 bootstraps the bundle) are estimates, not allocations. Structured `dependencies`/`acceptanceCriteria` frontmatter does not exist in any released profile — dependency and acceptance prose stays in the body.

**Cross-repo request linking** (EP-2–EP-5). Requests reference each other and this initiative only by canonical Mori URIs (`mori://shinzui/<project>/okf/improvement-requests/concepts/IR-N`), with `origin: mori://shinzui/keiro-ui` on every request this initiative files. The precedent chain to imitate: keiro IR-9 → shibuya IR-2 → shibuya-pgmq-adapter IR-1 (a downstream need driven upstream, one repo at a time, linked by handles).

Candidate ADRs this MasterPlan expects to produce (in keiro-ui unless noted): the endpoint-ownership principle and layer matrix; the WebSocket protocol convention; the push-is-a-hint/poll-is-truth live-update rule; the decision to keep the UI's backend surface out of the four runtime repos' core packages (sister-package pattern). Repositories may additionally distill their own ADRs when implementing (e.g., kiroku has no ADR covering HTTP/WS wire-format stability today — EP-2 should request one).


## Progress

- [x] EP-1: Conventions document drafted (transport, JSON, pagination, error envelope, WS protocol, CORS/auth posture) (2026-08-19)
- [x] EP-1: keiro-ui `docs/adr/` bundle seeded, registered in `mori.dhall`, and validating; initial ADRs recorded (2026-08-19: ADR-1..ADR-4, strict validation and `mori validate` pass)
- [x] EP-2: kiroku audit confirmed against working tree; endpoint gap list finalized (2026-08-19: tree at the audited commit c2d0328, gap list held verbatim)
- [x] EP-2: kiroku improvement requests filed and validating in kiroku's bundle (2026-08-19: IR-8..IR-13, kiroku commit 8f03c19, profile+log enforcement pass)
- [x] EP-3: pgmq-hs improvement-requests bundle bootstrapped and validating (2026-08-19: pgmq-hs commit 32b3c1e, pinned+frozen at okf-profiles v0.10.0, wired into `just docs-check`)
- [x] EP-3: pgmq-hs improvement requests filed and validating (2026-08-19: IR-1..IR-3, pgmq-hs commit 590a46f)
- [x] EP-4: shibuya audit confirmed; improvement requests filed and validating in shibuya's bundle (2026-08-19: IR-3..IR-5, shibuya commit bf2cff1)
- [x] EP-4: shibuya-pgmq-adapter improvement requests filed and validating (2026-08-19: IR-2..IR-3, adapter commit 1d88223)
- [x] EP-5: keiro audit confirmed; improvement requests filed and validating in keiro's bundle (2026-08-19: IR-26..IR-32, keiro commit b0645cd4, "OK: 32 concepts")
- [x] EP-5: composition/non-duplication request cross-links verified against EP-2/3/4 filed handles (2026-08-19: IR-28/IR-29 delegate to kiroku IR-8; IR-31 cites kiroku IR-8..IR-13, pgmq-hs IR-1..IR-3, shibuya IR-3..IR-5; all handles concrete at authoring time)
- [ ] EP-6: prior-art survey distilled into the direction document
- [ ] EP-6: general-direction document complete (information architecture, data layer, deployment story)
- [ ] MasterPlan: ADR distillation pass across all child plans


## Surprises & Discoveries

- EP-1 (2026-08-19): confirmed concretely that the okf-profiles v0.10.0 ADR profile rejects the `timestamp` frontmatter field under strict validation and requires the `generated` object (`generated.by` required, actor format such as `human:nadeem`; `generated.at` recommended, RFC3339 UTC). Consequence for EP-3: the pgmq-hs improvement-requests bundle it bootstraps at v0.10.0 must author records with `generated`, not `timestamp`. EP-2/EP-4/EP-5 are unaffected — their repositories' v0.5.0-era pins still use the `timestamp` family. Evidence and the authoritative doc pointers are in EP-1's Surprises & Discoveries (docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md).
- EP-2 (2026-08-19): kiroku's filed handle set is **IR-8..IR-13** (`mori://shinzui/kiroku/okf/improvement-requests/concepts/IR-8` REST browsing read API; IR-9 dead-letter reads; IR-10 durable checkpoints over HTTP; IR-11 CORS; IR-12 WebSocket convergence; IR-13 wire-format ADR) — the handles EP-5's composition/non-duplication sections must cite. kiroku IR-2 turned out to be `completed` (the checkpoint inventory shipped in kiroku-store 0.4.0.0), so IR-10 requests only the HTTP surface — a pattern worth reusing: audits should check whether a needed library primitive already shipped under an old IR before requesting it.
- EP-3 (2026-08-19): pgmq-hs's filed handle set is **IR-1..IR-3** (`mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-1` non-destructive inspection reads; IR-2 JSON codecs; IR-3 the pgmq-metrics sister package) — for EP-5's cross-linking. Unplanned but necessary: pgmq-hs's `mori.dhall` pinned a mori-schema commit the installed mori binary can no longer parse, so `just docs-check` was broken on the pristine tree; EP-3 repaired it via `mori schema migrate --apply` plus the `versionConstraint` helper field (details in that plan's Surprises & Discoveries). Lesson for EP-4/EP-5: run the target repo's own validation recipe before touching anything — kiroku showed a milder form of the same skew (a hash warning), and other repos may need the same migration.
- EP-4 (2026-08-19): shibuya's filed handle set is **IR-3..IR-5** (inspection depth; gated pause/resume; CORS/tests/WS-convention hardening) and shibuya-pgmq-adapter's is **IR-2..IR-3** (queue depth/age context; DLQ browse + gated redrive) — for EP-5's cross-linking. Convention drift among bundles: the shibuya-family bundles have no `index.md` (log-only), unlike kiroku's and pgmq-hs's — filing plans must imitate each bundle's actual file set, not assume a uniform shape. Both repos show the benign mori schema-hash warning (config still valid); no repair needed, unlike pgmq-hs. **The complete lower-layer handle inventory for EP-5 is now: kiroku IR-8..IR-13, pgmq-hs IR-1..IR-3, shibuya IR-3..IR-5, shibuya-pgmq-adapter IR-2..IR-3.**
- EP-5 (2026-08-19): keiro's filed handle set is **IR-26..IR-32** (`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-26` HTTP ops layer; IR-27 Wake-driven WS feeds; IR-28 aggregate reads; IR-29 process-manager reads; IR-30 workflow paging primitives; IR-31 composed mounting; IR-32 the stance ADR). keiro's bundle is also log-only (no `index.md`), confirming the per-repo convention drift as the rule rather than the exception. **The initiative's full endpoint-request inventory for EP-6 is 21 requests: kiroku IR-8..IR-13, pgmq-hs IR-1..IR-3, shibuya IR-3..IR-5, shibuya-pgmq-adapter IR-2..IR-3, keiro IR-26..IR-32.** Registry lag note: freshly committed concepts are not immediately resolvable via `mori path`; `mori registry reregister` refreshes, but canonical URIs remain the reference regardless.


## Decision Log

- Decision: Decompose by repository ownership boundary (one audit-and-file plan per repo family) rather than by UI concept.
  Rationale: Improvement requests are per-repository artifacts with per-repository profiles, IDs, and validation; a per-concept split would make every plan touch every repository. Repo boundaries coincide with functional concerns in this stack.
  Date: 2026-08-19

- Decision: Endpoints live in the project that owns the concept; keiro composes, keiro-ui consumes. Recorded as the initiative's core principle and slated for a keiro-ui ADR in EP-1.
  Rationale: User directive, and already the stack's demonstrated architecture (shibuya CAP-10, kiroku masterplan 5, keiro ADR-28).
  Date: 2026-08-19

- Decision: Do not choose the UI component library (IntentUI vs shadcn/ui) anywhere in this initiative; EP-6 must remain library-agnostic.
  Rationale: Explicit user directive; the direction document constrains architecture, not styling.
  Date: 2026-08-19

- Decision: No intention is linked to this MasterPlan; commits carry `MasterPlan:`/`ExecPlan:` trailers only.
  Rationale: User selected Skip when asked.
  Date: 2026-08-19

- Decision: The conventions document and the initiative's ADR corpus live in keiro-ui, not in any runtime repo.
  Rationale: keiro-ui is the only repository whose concern is the composed UI; runtime repos must stay independently usable and should not host cross-project UI contracts. Cross-repo citation works via `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N` once EP-1 registers the bundle.
  Date: 2026-08-19

- Decision: Author improvement requests against each repository's pinned profile version and validate with that repository's own tooling; do not upgrade profile pins as a side effect of filing.
  Rationale: Pins differ across repos (v0.5.0 improvement-request pins in keiro/kiroku/shibuya; pgmq-hs has none yet) and several are stale against okf-profiles v0.10.0; a pin upgrade is separate maintenance work with its own blast radius.
  Date: 2026-08-19

- Decision: EP-3 bootstraps pgmq-hs's improvement-requests bundle pinned at okf-profiles v0.10.0 (the newest release tag), frozen with `dhall freeze`.
  Rationale: New bundles should start current; only existing bundles keep their pins.
  Date: 2026-08-19

- Decision: EP-4 covers shibuya and shibuya-pgmq-adapter; the kafka adapter gets requests only if a UI-critical gap is identified there, and bootstrapping its missing IR bundle is out of scope otherwise. shibuya-message-db-adapter is out of scope entirely.
  Rationale: keiro consumes shibuya through the pgmq adapter; kafka support serves the outbox/inbox path whose UI surface is owned by keiro. Scope stays proportional to the UI's needs.
  Date: 2026-08-19

- Decision: The prior-art survey (Restate first among equals for durable execution; AxonIQ Console and Kurrent/EventStoreDB for event sourcing; Temporal, Redpanda Console, Oban/Sidekiq, Phoenix LiveDashboard as secondary references) is an input to EP-6, not a separate child plan.
  Rationale: User steer ("look at restate and similar tooling for inspiration"; "restate has nice UI for durable execution"). The survey informs direction; it produces no repository artifact of its own beyond EP-6's document.
  Date: 2026-08-19

- Decision: EP-5 must explicitly confront keiro's recorded stance that there is "no parallel workflow engine UI to maintain" (docs/why-keiro.md), positioning the UI as a state-inspection and operations console that complements OTel metrics dashboards rather than replacing them, and must propose recording the boundary in a keiro ADR alongside any accepted request.
  Rationale: Silently contradicting a stated architectural stance in a filed request invites rejection; the reframing is honest — OTel covers metrics/traces, not state browsing or safe operator actions.
  Date: 2026-08-19


## Outcomes & Retrospective

(To be filled during and after implementation.)
