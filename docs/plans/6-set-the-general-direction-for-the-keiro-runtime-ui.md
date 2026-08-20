---
id: 6
slug: set-the-general-direction-for-the-keiro-runtime-ui
title: "Set the general direction for the keiro runtime UI"
kind: exec-plan
created_at: 2026-08-20T03:01:42Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Set the general direction for the keiro runtime UI

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime UI initiative (docs/masterplans/1-keiro-runtime-ui-foundations.md in this repository) prepares a web UI that any application built on the keiro runtime — the Haskell stack of keiro (framework), kiroku (event store), shibuya (queue processing), and pgmq-hs (Postgres queues) — can run beside its deployment to inspect aggregates, workflows, process managers, timers, projections, streams, subscriptions, queues, and dead letters. The initiative's other plans define cross-project endpoint conventions (docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md) and file improvement requests for the endpoints in each runtime repository (docs/plans/2- through 5-).

This plan writes the **general direction** for the UI itself: what screens exist and how they are organized, how the React application is structured so the still-open component-library choice (IntentUI versus shadcn/ui) stays open, how the data layer talks to four independently owned endpoint surfaces, how live updates work, and how the UI treats actions that mutate a running system. It also distills a prior-art survey of comparable tools (Restate, Temporal, Inngest, Kurrent/EventStoreDB, AxonIQ Platform, Redpanda Console, Oban Web, Sidekiq Web, Phoenix LiveDashboard/BroadwayDashboard, and others, surveyed August 2026) into a durable reference document, because the direction is argued from that evidence.

After this plan completes, keiro-ui contains `docs/architecture/ui-prior-art-survey.md` and `docs/architecture/ui-direction.md`, plus the durable decisions recorded as ADRs in the `docs/adr/` bundle created by docs/plans/1. You can see it working by reading the two documents, checking that every screen in the direction document names the endpoint surface (and, where filed, the improvement-request handle) it depends on, and running the OKF validation over `docs/adr/` and seeing it pass with the new records.

No application code is written by this plan. Building the React app is future work that starts from the direction document.


## Progress

- [x] Milestone 1: `docs/architecture/ui-prior-art-survey.md` written from the survey findings embedded in this plan. (2026-08-19: per-tool sections for every named tool, the live-update mechanism table, the five-rung gating ladder, and the four-item unclaimed-territory list are all present; dated with the re-verify caveat.)
- [x] Milestone 2: `docs/architecture/ui-direction.md` written (information architecture, screen inventory mapped to endpoint surfaces and filed improvement requests, data layer, live-update strategy, action gating, deployment and embedding). (2026-08-19: eight `##` parts; every screen cites concrete filed handles — no awaited plan-path references, so no backfill items; `subscribe_events`, `store_position`, and `next_cursor` references all consistent with the conventions document.)
- [x] Milestone 3: Durable decisions recorded as ADRs in `docs/adr/`; MasterPlan registry and Progress updated; cross-links to filed IR handles verified or recorded as follow-ups. (2026-08-19: ADR-5 no backend-for-frontend, ADR-6 the design-system adapter, ADR-7 read-only first with owning-repository gates — allocated via `okf id next`, indexed, logged; strict validation reports "OK: 7 concepts". All IR cross-links were concrete at authoring time; `mori path` resolves the spot-checked handles after `mori registry reregister`.)


## Surprises & Discoveries

- All soft dependencies were hard by execution time: EP-2..EP-5 had filed every request, so the screen inventory cites all 21 handles concretely and the plan's plan-path fallback and Progress backfill mechanism went unused.
- Freshly committed OKF concepts are not immediately `mori path`-resolvable; `mori registry reregister` refreshes the registry (verified: `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-26`, `mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-1`, and `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-1` all resolve to on-disk paths afterward). The reregister run also flagged an unrelated project (`tan/registration-service-protos`) with an outdated mori schema — not touched, noted here only so the warning is not later misattributed to this initiative's changes.
- The ADR handles cited prospectively in the direction document (ADR-5..ADR-7) matched the allocator exactly, since the bundle held ADR-1..ADR-4; citing unallocated handles in a document committed in the same change as their allocation is safe only under that same-change discipline — worth keeping as a practice note.


## Decision Log

- Decision: Restate is the benchmark for the durable-execution and workflow surfaces; AxonIQ Platform and Kurrent/EventStoreDB are the benchmarks for the event-sourcing surfaces; BroadwayDashboard is the benchmark for the shibuya processor surface; Sidekiq/Oban are the benchmarks for the queue surface.
  Rationale: User steer ("look at restate and similar tooling for inspiration"; "restate has nice UI for durable execution" while unsure any tool does event sourcing well) plus the August 2026 survey: Restate has the strongest introspection-API story surveyed; AxonIQ is the only shipped console covering processor lag, guarded replay, and DLQ triage for an event-sourcing framework; no surveyed tool has a good aggregate-centric view — which becomes this UI's differentiation target.
  Date: 2026-08-19

- Decision: The UI is React + TypeScript; the component library remains deliberately unchosen, and all screens are specified against a thin design-system adapter layer so IntentUI and shadcn/ui remain equally installable later.
  Rationale: Explicit user directive. The direction document constrains information architecture and data flow, not styling; both candidate libraries cover the needed primitives (tables, forms, dialogs, toasts, charts come from a separate charting choice anyway).
  Date: 2026-08-19

- Decision: No backend-for-frontend. The UI consumes each project's own endpoints directly (or through the composed single-port mount requested from keiro), with one typed client package per endpoint surface.
  Rationale: The strongest architecture lesson of the survey — Temporal's UI server collapsed into a thin gateway over the one canonical API, and Restate's UI never does anything the public admin API cannot; a bespoke aggregation server would recreate the four-dialect problem the conventions plan exists to prevent and would violate the initiative's endpoint-ownership principle.
  Date: 2026-08-19

- Decision: Liveness is polling-first with WebSocket acceleration, honoring the cross-project "push is a hint, poll is truth" rule; every live view has a user-visible pause/refresh control and adaptive polling intervals.
  Rationale: Restate ships a polished v1 UI on pure polling (2 s invocations, adaptive `clamp(10s, 10× fetch duration, 60s)` overview); the stack's own NOTIFY contracts are best-effort by design; user-controlled liveness (Temporal's pause toggle, Oban's refresh dial) is a recurring pattern in every mature tool.
  Date: 2026-08-19

- Decision: Read-only first. Every mutating action rides an owning-repository endpoint that is itself gated (keiro-ops preview/force discipline, shibuya's gated control plane), the UI states irreversibility in confirmations, and bulk/destructive operations are deferred until they can be first-class jobs with progress.
  Rationale: Survey consensus: the UI never does anything the public API cannot; the best-gated tools separate read access, action rights, and payload visibility into independent axes (Temporal codec server, Oban resolver, AxonIQ dlq-mode). The runtime repos' own safety disciplines already exist and must not be bypassed.
  Date: 2026-08-19


## Outcomes & Retrospective

Completed 2026-08-19, all three milestones in one session. Delivered `docs/architecture/ui-prior-art-survey.md` (ten tool sections plus four briefs, the live-update mechanism table, the five-rung gating ladder, the unclaimed-territory list), `docs/architecture/ui-direction.md` (eight parts; every screen names its endpoint surface and canonical improvement-request handle; consistent with the conventions document on WS frames, pagination, error envelope, and ADR-28 vocabulary), and ADR-5..ADR-7 in the strict-validating bundle.

The direction rests on an unusually solid base because the initiative ran in dependency order: the conventions and ADR corpus existed before the requests, and all 21 requests existed before the direction — so the document contains no "pending" references at all. The survey's sharpest finding shaped the direction most: no surveyed tool renders the aggregate as a first-class object, so the aggregate browser (stream and folded state side by side, projection cursors relative to the aggregate's head) is the console's declared differentiation, alongside causation/correlation DAGs, live process-manager state, and replay blast-radius previews.

What remains is deliberately out of scope: building the app (a future MasterPlan starts from `ui-direction.md`), choosing the component library (ADR-6 keeps it open), and the runtime repositories' acceptance and implementation of the filed requests. The keiro-ui foundations MasterPlan is complete with this plan.


## Context and Orientation

### This repository and the sibling plans

keiro-ui (`/Users/shinzui/Keikaku/bokuno/keiro-ui`, `shinzui/keiro-ui` in the Mori registry) is the coordination repository for the initiative and the future home of the React application. At authoring time it holds only planning documents and agent skills. This plan **hard-depends on docs/plans/1** (EP-1), which creates `docs/architecture/inspection-api-conventions.md` (transport, JSON, pagination, error envelope, WebSocket protocol, CORS, auth posture, versioning, vocabulary) and seeds `docs/adr/` as a profiled OKF bundle whose records are citable as `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`. Do not start this plan before EP-1 is complete: the data-layer direction is an application of those conventions, and Milestone 3 records ADRs into the bundle EP-1 creates.

It **soft-depends on docs/plans/2 through 5** (EP-2 kiroku, EP-3 pgmq-hs, EP-4 shibuya, EP-5 keiro), which file the improvement requests for the endpoints each screen consumes. Where those handles exist at implementation time, the screen inventory cites them canonically (`mori://shinzui/<project>/okf/improvement-requests/concepts/IR-N` — discover with `mori registry concepts --search '<title>' --json` and copy the `ref` exactly; never construct one by guessing). Where they do not, the inventory names the source plan by path and the follow-up is recorded in Progress.

ADR context: keiro-ui's own ADRs (from EP-1) are the local corpus — read them before writing, especially the endpoint-ownership/layer-matrix record and the WebSocket-convention record. The constraining cross-repository decisions are the same ones the MasterPlan cites: `mori://shinzui/keiro/okf/adrs/concepts/ADR-28` (owning-library wrapping and the vocabulary rules: `store_position`, `visible_store_head`, "global position distance" — never "lag"/"backlog" on keiro surfaces), `mori://shinzui/keiro/okf/adrs/concepts/ADR-35` and `ADR-36` (frozen guarded external read contracts), and `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` (stream names resolve via batch lookup — every event-listing screen budgets a resolution step or consumes an endpoint that already resolved names).

### What the four endpoint surfaces offer (summary; details in the sibling plans)

kiroku ships `kiroku-metrics` (port 9091: metrics, health, in-process subscription registry, and a replayable WebSocket event tail with `from_position` and category filter); EP-2 requests stream/category/event browsing, dead-letter reads, durable checkpoint inventory over HTTP, CORS, and additive WS convergence. pgmq-hs has no server; EP-3 requests library read primitives (non-destructive peek, archive reads, message-by-id), JSON codecs, and a `pgmq-metrics` sister package. shibuya ships `shibuya-metrics` (port 9090: per-processor metrics, health, delta-pushing WebSocket); EP-4 requests latency/progress/in-flight depth, pause/resume as a gated control plane, CORS and tests, and queue-context plus DLQ browse/redrive in the pgmq adapter. keiro has no HTTP surface; EP-5 requests an ops-over-HTTP sister package reusing the `keiro-ops` JSON envelope and read/write classifier, WebSocket live feeds over `Keiro.Wake`, aggregate and process-manager read APIs, workflow-inspection completeness, a composed single-port mounting story, and an ADR sanctioning the UI boundary.

### The prior-art survey findings this plan turns into documents

The survey (August 2026; Restate verified at source level, others from docs/repos/release notes) is the evidence base for the direction. The essentials the two documents must carry:

**Restate** (durable execution; the user-named benchmark). Ships its React UI inside the server binary on the admin port. Two-tier API: typed admin REST verbs (cancel/kill/pause/resume/restart-as-new/purge as `PATCH /invocations/{id}/{op}`) plus a **read-only SQL introspection endpoint** (embedded DataFusion; `POST /query`) whose system tables (`sys_invocation` with ~50 lifecycle/provenance/failure columns, `sys_journal` with dual raw+JSON entry projections, `sys_journal_events`, `state`, per-queue blocked-on breakdowns) serve CLI, UI, and users alike. Auto-pause after retry exhaustion replaces a DLQ: the invocation freezes with journal intact awaiting human action. Liveness is pure polling: 2 s for invocations, adaptive `clamp(10s, 10× last fetch duration, 60s)` for the overview. Invocations hyperlink to each other as a "distributed call stack"; an embedded SQL editor with predefined queries is the power-user escape hatch.

**Temporal Web UI** (workflow history rendering). One canonical proto-annotated API shared by server, CLI, and UI — the UI server is a thin gateway plus write-gating middleware (`disableWriteActions`, per-action flags). Event history rendering rests on **event groups** (raw events clustered into logical operations) shown through multiple lenses (Timeline / Compact / All / JSON) over one store, virtualized for huge histories; long-poll (`waitNewEvent=true`) supplies the live tail. The **codec-server pattern** separates payload-decryption capability from server access. A typed, discoverable search-attribute registry powers both a filter builder and a raw query editor, with filter state in the URL and saved views.

**Inngest**. Queue-delay versus execution time drawn as distinct segments of one span bar — the most honest scheduler-versus-user-code visualization surveyed. Replay and bulk-cancel are **named, first-class jobs** with pre-flight impact estimates and progress pages; rerun-from-step with editable input turns the trace viewer into a REPL over history. Span outputs are fetched lazily by id so big payloads never bloat the tree.

**Kurrent/EventStoreDB** (event-store canon). Stream browser with `$all`, pause/resume live display, metadata as streams; persistent-subscription dashboards with in-flight and **parked counts plus one-click replay-parked**; the projection **step-debugger** (run one event at a time against the projection beside its pending queue); liveness via long-poll on the immutable Atom head (back-pages cache forever). Cautionary tales: the bundled UI rotted on a deprecated protocol and had to be replaced across three surfaces; license-gating basic observability backfired and was reversed.

**AxonIQ Platform** (the closest full CQRS/ES console). Event processors with per-segment status/lag/position, segment claim percentage as the single ownership-health number, split/merge/move actions; the **replay guardrail sequence** — auto-pause all instances, typed confirmation stating irreversibility, reset-point choice (beginning / tail / timestamp), live progress during replay; **DLQ as per-aggregate sequences** (not loose messages) with payloads hidden by default behind an explicit opt-in; aggregate stream length with a recommended ceiling as a first-class metric.

**Redpanda Console / Kafbat**. Message search as a server-side streaming scan with explicit phase/progress frames and a next-page token in the completion frame; push-down filters over deserialized payloads — with the safety lesson that Kafbat deliberately replaced JavaScript predicates with sandboxed CEL expressions. Consumer-group lag views that do not auto-refresh are a recognized gap to avoid.

**Oban Web / Sidekiq Web** (queue dashboards). Sidekiq: **queue latency (age of the oldest job) as the headline health metric**, depth second; a bounded dead-set "morgue" with resurrect semantics; two-tier polling with a user slider. Oban: qualifier search over nested JSON args with autocompletion and scan caps; per-queue utilization gauges and sparklines; the **resolver gating pattern** — the host app implements one small callback interface granting per-user read-only or per-action rights, payload redaction at render time, and query-cost limits; user-selectable refresh (1/2/5/15 s or paused).

**Phoenix LiveDashboard / BroadwayDashboard** (the shibuya ancestor). Pipeline topology as a layered stage graph (producers → processors → batchers) with per-stage **workload % = busy/(busy+idle)**; the cost model to copy: lock-free counters on the hot path, a 1 Hz server-side per-pipeline aggregator pushed to subscribed viewers that **auto-stops when nobody is watching**; a signed-token trick to tail one tagged request's log lines live. Limitation to design around: aggregates only — it cannot answer "which message failed and why".

**Synthesis.** Every mature tool converges on *entity list → detail → timeline drill-down* with four to seven top-level nav entries, an environment switcher, filter state in the URL, cross-entity hyperlinks as primary navigation, and a power-user escape hatch. Liveness splits into polling (Restate, Inngest, Sidekiq), long-poll hybrids (Temporal, EventStore), and push (LiveView, RSocket, streaming RPC); the best designs share user-controlled liveness, adaptive cadence, and progress framing for unbounded scans regardless of transport. Action gating ranges from a global read-only flag through per-action flags to host-app resolver callbacks, with payload visibility as an independent axis. **Unclaimed territory no surveyed tool covers well**: aggregate-centric drill-down (aggregate → its stream + folded state + each projection's cursor relative to its head), causation/correlation DAGs of a business transaction, live process-manager state with pending timers and stuck instances, and replay **blast-radius preview** (every replay UI warns; none estimates the event count, duration, and side-effect handlers that will refire). These are where the keiro UI can surpass everything surveyed, because the runtime already persists the data they need.


## Plan of Work

### Milestone 1 — The prior-art survey document

Create `docs/architecture/ui-prior-art-survey.md` from the findings in Context and Orientation, expanded to full prose: one section per tool (Restate, Temporal, Inngest, Kurrent/EventStoreDB, AxonIQ Platform, CritterWatch and the smaller event-sourcing tools, Redpanda Console/Kafbat/AKHQ, Oban Web, Sidekiq Web, Phoenix LiveDashboard/BroadwayDashboard, and one-paragraph briefs for DBOS, Prefect, Windmill, Trigger.dev), then a synthesis section covering the four cross-cutting comparisons: information-architecture patterns, live-update mechanisms (as a table with mechanism and cadence per tool), introspection-API design patterns (SQL passthrough, one-canonical-API, filtering DSL spectrum, cursor-plus-long-poll, lazy payload fetching, payload privacy), and action inventories with gating patterns ordered weakest to strongest. Close with the "unclaimed territory" list. Write it as a durable reference: dated (surveyed August 2026), with the caveat that the tools move and claims should be re-verified before being load-bearing.

Acceptance: the file exists; each named tool has a section; the synthesis contains the live-update table and the gating ladder; the unclaimed-territory list is present.

### Milestone 2 — The direction document

Create `docs/architecture/ui-direction.md`. It is the anchor a future "build the app" MasterPlan starts from, and it must stand alone. Required content, in order:

1. **Purpose and audience.** The UI is an inspection and operations console for operators and developers of any application on the keiro runtime — not a replacement for OTel metrics/traces dashboards (keiro's sanctioned boundary, per the stance ADR requested by docs/plans/5). It runs beside a deployment, either as the composed single-port mount requested from keiro or as a static app pointed at the individual surfaces.

2. **Information architecture.** Top-level navigation (about seven entries, following the surveyed skeleton): *Overview* (headline health: queue latency per Sidekiq's lesson, workflow status counts, projection freshness, processor states); *Aggregates*; *Workflows* (durable execution); *Process Managers & Timers*; *Projections & Read Models*; *Streams & Subscriptions* (kiroku); *Queues & Processors* (pgmq + shibuya, including dead letters). Cross-entity hyperlinks are the primary navigation (workflow → its journal stream; dead letter → its source queue and originating stream position; aggregate → the projections consuming it). Filter state lives in the URL. An environment/connection switcher selects which deployment's surfaces the app points at. A power-user escape hatch is noted as a candidate (predefined-query browser over the stack's SQL contracts — `keiro_read` views, `kiroku.subscription_checkpoints_v1` — in the spirit of Restate's SQL editor) without committing the endpoint work.

3. **Screen inventory.** One subsection per screen: what it shows, which endpoint surface and improvement request it depends on (canonical handle or source plan path), the live-update mechanism, and the prior-art pattern it follows. The set must cover at minimum: aggregate browser (list by category → key → **event stream and folded state side by side**, with each projection's cursor relative to this aggregate's head — the unclaimed-territory screen; depends on EP-5's aggregate-reads request plus EP-2's browsing API); workflow list and detail (journal timeline with event grouping and multiple lenses per Temporal; queue-delay versus execution segments per Inngest; Restate's verb set as actions, gated); process-manager instances (journal-derived state, "waiting on" panel, pending timers, stuck-instance surfacing); projection status and rebuild (freshness against `visible_store_head` using ADR-28 vocabulary; the AxonIQ replay guardrail sequence as the rebuild UX; blast-radius estimate as a differentiator); stream browser ($all and per-stream tails over the kiroku WS with replay; category browsing; causation/correlation navigation per Rails Event Store); subscription/checkpoint dashboard (durable inventory as truth, live registry as annotation; parked/dead letters with replay actions per EventStore); queue dashboard (latency headline, depth, peek, archive browsing, DLQ morgue with redrive per Sidekiq/Oban); processor pipeline view (layered stage graph with workload %, per BroadwayDashboard, fed by shibuya's WS deltas).

4. **Data layer.** One typed TypeScript client package per endpoint surface (`@keiro-ui/client-kiroku`, `@keiro-ui/client-shibuya`, `@keiro-ui/client-pgmq`, `@keiro-ui/client-keiro`), mirroring repository ownership — no backend-for-frontend (Decision Log). Clients are hand-written against the conventions document first and regenerated from machine-readable specs if the runtime repos later publish them. Server state via TanStack Query with polling defaults per surface and adaptive intervals (Restate's clamp pattern named); WebSocket feeds implemented as cache-updating subscriptions layered over the poll baseline, never replacing it (the push-is-a-hint rule); every live view exposes a pause/refresh control. Error handling renders the conventions' error envelope; vocabulary rules from ADR-28 are applied at the display layer for keiro surfaces.

5. **Application architecture.** React + TypeScript + Vite, pnpm workspace in this repository (`apps/console`, `packages/client-*`, `packages/ui-adapter`). The **design-system adapter** (`packages/ui-adapter`) is the library-agnosticism mechanism: screens import primitives (table, dialog, form controls, toast, tabs, badge) from the adapter's own interface only; the adapter gets exactly one implementation once IntentUI versus shadcn/ui is decided, and that decision is explicitly out of this initiative's scope. State beyond server caches stays in URL and component state until proven otherwise. Charting is a separate later choice; the direction only requires sparkline/gauge/timeline capabilities.

6. **Actions and gating.** Read-only first release. Mutations arrive only as the owning repositories ship their gated endpoints (keiro's preview/force over `isMutation`; shibuya's gated pause/resume; adapter redrive), and the UI renders the gate honestly: previews shown before confirmation, irreversibility stated in dialogs (AxonIQ's guardrail sequence for anything replay-shaped), destructive bulk operations deferred until they can be first-class jobs with progress. Payload visibility is designed as an axis separate from action rights (redaction/opt-in hooks in the clients, following Temporal's codec seam and AxonIQ's dlq-mode). The host-side authorization model (who may act) is delegated to deployment (reverse proxy / network trust per the conventions' auth posture) with the Oban resolver pattern named as the aspiration if the surfaces later grow per-action authorization.

7. **Deployment and embedding.** Primary: static assets served beside the composed mount (EP-5's mounting request) on one origin — no CORS needed. Secondary: the app pointed at separate per-surface origins, requiring the CORS work requested from each repo. The document states both and names the trade-off.

8. **Explicitly out of scope**, restated from the MasterPlan: component-library choice, auth design, implementing any endpoint, building the app.

Acceptance: the document exists with all eight parts; every screen names its data dependency; no part contradicts `docs/architecture/inspection-api-conventions.md` (spot-check the WS protocol, pagination, error envelope, and vocabulary references against it).

### Milestone 3 — ADRs and MasterPlan closeout

Record the durable decisions as ADRs in `docs/adr/` (the bundle EP-1 created), following the same allocation and validation discipline EP-1 documents (allocate with `okf id next`, file named `NNNN-<kebab-title>.md`, frontmatter per the pinned profile, `index.md` and `log.md` updated, strict validation green). The decisions that are durable rather than task-local: (a) no backend-for-frontend — one typed client per surface, consuming owning-project endpoints; (b) the design-system adapter as the library-agnosticism mechanism, with the component-library decision explicitly deferred; (c) read-only-first with owning-repo gating and payload visibility as an independent axis. (The push-is-a-hint and WS-convention decisions are already EP-1 ADRs; cite, do not duplicate.)

Then update the MasterPlan: mark EP-6's registry row and Progress entries, record in its Surprises & Discoveries anything the survey changed about earlier assumptions, and — since this is the initiative's last child plan — perform the MasterPlan's ADR distillation pass and fill its Outcomes & Retrospective per the master-plan skill.

Acceptance: `okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce` passes with the new records; the MasterPlan registry shows EP-6 Complete; the distillation pass is recorded in the MasterPlan.


## Concrete Steps

All commands run from `/Users/shinzui/Keikaku/bokuno/keiro-ui`.

```bash
ls docs/architecture/   # expect: inspection-api-conventions.md exists (EP-1 complete) before starting
"$EDITOR" docs/architecture/ui-prior-art-survey.md    # Milestone 1, per Plan of Work
"$EDITOR" docs/architecture/ui-direction.md           # Milestone 2, per Plan of Work
grep -c '^## ' docs/architecture/ui-direction.md      # expect >= 8 top-level parts
```

Cross-link verification for the screen inventory (repeat per sibling plan's filed requests; copy `ref` values exactly):

```bash
mori registry concepts --search 'non-destructive queue inspection' --json | grep '"ref"'
mori registry concepts --search 'aggregate inspection read' --json | grep '"ref"'
```

Milestone 3, per ADR (allocation and validation exactly as EP-1's Concrete Steps document):

```bash
okf id next docs/adr --profile docs/adr/profile.dhall ADR
"$EDITOR" docs/adr/<NNNN>-<kebab-title>.md
"$EDITOR" docs/adr/index.md
okf log add docs/adr -m "Add ADR-<n>: <title>" --kind Addition --date "$(date -u +%F)"
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
```

Commit at each milestone boundary (Conventional Commits, repo-relative trailers; no `Intention:` trailer anywhere in this initiative):

```text
docs(architecture): set the general direction for the keiro runtime UI

MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/6-set-the-general-direction-for-the-keiro-runtime-ui.md
```


## Validation and Acceptance

The plan is complete when, from the repository root:

1. `docs/architecture/ui-prior-art-survey.md` exists with per-tool sections, the live-update table, the gating ladder, and the unclaimed-territory list.
2. `docs/architecture/ui-direction.md` exists with the eight required parts; searching it for `subscribe_events` or the WS frame vocabulary finds references consistent with `docs/architecture/inspection-api-conventions.md`, and searching for `store_position` finds the vocabulary rule applied to keiro-facing screens.
3. Every screen in the inventory names either a canonical `mori://…/improvement-requests/concepts/IR-N` handle or the sibling plan path it awaits, and the awaited ones are mirrored as unchecked Progress items here.
4. `okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce` exits zero with the Milestone 3 records present, and `okf id list docs/adr --profile docs/adr/profile.dhall` shows them.
5. The MasterPlan registry marks EP-6 Complete, its Progress entries are checked, and — this being the last child plan — its Outcomes & Retrospective and ADR distillation pass are filled in.

Content bar: a reader who has only the two documents and the conventions document can sketch the app's package layout, name every screen and its data source, and explain why each major direction choice was made — without access to this plan or the survey agents' raw output.


## Idempotence and Recovery

Everything here is document work and safe to repeat. Re-running validation and `okf id next` is read-only; abandoned ADR drafts leave no allocation. If sibling-plan handles are still missing at implementation time, file the documents with plan-path references and keep the backfill items unchecked in Progress — updating a shipped direction document with real handles later is an ordinary edit plus a revision note, per the exec-plan revision protocol. If EP-1's conventions change after this plan writes the direction (a revision there), reconcile the direction document in the same change and note it in both plans' revision notes.


## Interfaces and Dependencies

Inputs this plan consumes: `docs/architecture/inspection-api-conventions.md` and the keiro-ui ADR bundle (EP-1, hard); filed improvement-request handles from EP-2 through EP-5 (soft); the prior-art survey findings embedded in Context and Orientation (self-contained — no external agent output is required to execute this plan).

Outputs and their consumers: `docs/architecture/ui-prior-art-survey.md` (durable reference for future UI work); `docs/architecture/ui-direction.md` (the anchor for the future "build the console" MasterPlan in this repository); new `docs/adr/` records (constraints on all future keiro-ui application work).

Tools: `okf`, `mori`, `git`, an editor. No Node, React, or Haskell tooling is required — this plan ships direction, not code.
