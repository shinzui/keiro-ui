---
id: 4
slug: audit-shibuya-and-file-ui-endpoint-improvement-requests
title: "Audit shibuya and file UI endpoint improvement requests"
kind: exec-plan
created_at: 2026-08-20T03:01:42Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Audit shibuya and file UI endpoint improvement requests

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime UI initiative (see docs/masterplans/1-keiro-runtime-ui-foundations.md in this repository) is preparing a browser UI for applications built on the keiro runtime stack. Shibuya is the stack's supervised queue-processing library: it runs named consumer loops ("processors") that pull messages from an adapter-provided source, hand them to application handlers, and acknowledge results. The UI must be able to show what those processors are doing — throughput, state, in-flight load, queue context, dead letters — and eventually offer safe control actions such as pausing a processor.

Shibuya already exposes a metrics HTTP and WebSocket server, but it is missing most of what an inspection UI needs. The keiro-ui project does not get to add those endpoints itself: the initiative's core principle (recorded in the MasterPlan) is that endpoints live in the project that owns the concept, because shibuya is usable without keiro and may grow its own UI.

This plan is therefore a **requirements-filing plan**. After it completes, the shibuya repository and the shibuya-pgmq-adapter repository each contain new, validated OKF Improvement Request documents — the repositories' native mechanism for cross-repository asks — specifying the endpoint and introspection work the UI needs from them. No endpoint is implemented by this plan; implementation happens later, inside those repositories, under their own plans. Success is observable: the new request files exist in each repository's `docs/improvement-requests/` directory, each bundle's validation command passes, and this plan records the allocated request handles (`IR-N` identifiers) so other plans can cite them.


## Progress

- [x] Milestone 1: Audit re-confirmed against both working trees; findings recorded in this plan (2026-08-19: shibuya at `7158f3e`, adapter at `fee9b3a`, both clean; all absence greps silent — no test-suite, no CORS, no pause/resume, no duration histogram in shibuya-metrics; no `pgmq.metrics` usage in the adapter; baseline `okf validate` green in both bundles; `okf id next` reports IR-3 (shibuya) and IR-2 (adapter), matching the estimates)
- [x] Milestone 2: Shibuya improvement requests authored and filed (processor inspection depth; pause/resume control plane; browser-consumption hardening) (2026-08-19: IR-3, IR-4, IR-5)
- [x] Milestone 2: Shibuya bundle `log.md` updated (no `index.md` exists in this bundle — see Surprises & Discoveries); `okf validate` ("OK: 5 concepts") and `mori validate` pass in the shibuya repo (2026-08-19)
- [x] Milestone 2: Shibuya changes committed with the required trailers (2026-08-19: shibuya commit `bf2cff1`; `nix fmt` clean, treefmt hook passed)
- [x] Milestone 3: shibuya-pgmq-adapter improvement requests authored and filed (queue-context observability; DLQ browse/redrive) (2026-08-19: IR-2, IR-3)
- [x] Milestone 3: Adapter bundle `log.md` updated (no `index.md` exists in this bundle either); `okf validate` ("OK: 3 concepts") and `mori validate` pass in the adapter repo (2026-08-19)
- [x] Milestone 3: Adapter changes committed with the required trailers (2026-08-19: adapter commit `1d88223`; `nix fmt` clean)
- [x] Allocated `IR-N` handles for all filed requests recorded in this plan and reported to the MasterPlan (2026-08-19)

Allocated handles (all `status: proposed`, `origin: mori://shinzui/keiro-ui`):

- shibuya IR-3 — Expose processor progress, latency, and in-flight detail for inspection UIs (`mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-3`)
- shibuya IR-4 — Implement designed processor pause/resume and expose gated control endpoints (`mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-4`)
- shibuya IR-5 — Harden shibuya-metrics for browser clients — CORS, tests, and WS convention alignment (`mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-5`)
- shibuya-pgmq-adapter IR-2 — Surface queue depth and age context for processors consuming pgmq queues (`mori://shinzui/shibuya-pgmq-adapter/okf/improvement-requests/concepts/IR-2`)
- shibuya-pgmq-adapter IR-3 — Expose dead-letter-queue browse and redrive for adapter-managed DLQs (`mori://shinzui/shibuya-pgmq-adapter/okf/improvement-requests/concepts/IR-3`)


## Surprises & Discoveries

- Milestone 1 (2026-08-19): neither shibuya-family bundle has an `index.md` — unlike kiroku's and pgmq-hs's bundles, they hold only request files, `log.md`, and `profile.dhall`, and both validate cleanly that way under their pinned v0.5.0 profiles. The plan's instruction to update `index.md` therefore does not apply; filing updates `log.md` only, imitating the local convention exactly (see Decision Log).
- Both repos' `mori validate` emits the same pre-existing schema-hash warning kiroku shows (recorded hash predates the binary's embedded schema; "mori ignores this hash"), while still reporting the configuration valid. Milder than pgmq-hs's hard failure (see docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md); no repair needed to make validation pass, so none was made.
- EP-1 and EP-3 both completed before filing, so the requests cite real handles throughout: keiro-ui ADR-1..ADR-4 and the pgmq-hs set IR-1..IR-3. The backfill contingency for the adapter's queue-context request was not needed.


## Decision Log

- Decision: Requests are split by owning repository: processor-level and server-hardening asks go to `shibuya`; queue-context and dead-letter-queue asks go to `shibuya-pgmq-adapter`, because only the adapter holds pgmq connection settings, queue names, and the dead-letter payload contract.
  Rationale: Shibuya core deliberately knows nothing about queues, topics, or consumer groups — its only runtime noun is the processor. Filing queue-shaped asks against core would contradict its architecture.
  Date: 2026-08-19

- Decision: The kafka adapter (`shibuya-kafka-adapter`) receives no requests and its missing improvement-requests bundle is not bootstrapped.
  Rationale: MasterPlan decision — keiro consumes shibuya through the pgmq adapter; no UI-critical kafka-specific gap was identified in the audit. Revisit only if the UI later commits to kafka-backed views.
  Date: 2026-08-19

- Decision: The queue-context request asks the adapter to *source* queue depth and age from pgmq-owned surfaces (the pgmq-hs endpoints being requested in parallel by docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md) rather than to grow its own duplicate queue-metrics API, with direct `pgmq.metrics` queries acceptable only as an interim in-process source.
  Rationale: MasterPlan layer-ownership matrix — overlaps resolve toward the lower layer. pgmq-hs owns queue mechanics; the adapter owns the binding between a processor and its queues.
  Date: 2026-08-19

- Decision: All filed requests use `status: proposed` and `origin: mori://shinzui/keiro-ui`, and are authored against each repository's pinned improvement-request profile (okf-profiles v0.5.0) exactly as the existing records are — no profile pin upgrades in this plan.
  Rationale: MasterPlan decision: pins are per-repository maintenance with their own blast radius; a filing plan must not change them as a side effect.
  Date: 2026-08-19

- Decision: No `index.md` is created or updated in either shibuya-family bundle; filing touches only the request files and `log.md`.
  Rationale: Neither bundle has an `index.md` today and both validate cleanly without one; imitating the local convention exactly outranks the plan's (incorrect) assumption that one exists. Creating one would be an unrequested structural change to another repository's bundle.
  Date: 2026-08-19


## Outcomes & Retrospective

Completed 2026-08-19, all milestones in one session. Five requests filed across two repositories: shibuya gained IR-3 (processor inspection depth, with the hot/cold-path constraint stated as a hard requirement), IR-4 (pause/resume implementing the repository's own dormant design, gated off by default), and IR-5 (CORS + a first-ever test suite + additive WS convention alignment, explicitly non-overlapping with Shikigami's IR-1) in commit `bf2cff1`; shibuya-pgmq-adapter gained IR-2 (queue depth/age context sourced from pgmq-owned surfaces, citing the pgmq-hs IR-1..IR-3 handles EP-3 filed hours earlier) and IR-3 (DLQ browse and gated redrive, continuing the repository's own completed IR-1) in commit `1d88223`. Both bundles validate with log enforcement; estimates matched allocations exactly (IR-3/4/5 and IR-2/3).

The one convention correction: neither shibuya-family bundle has an `index.md`, so the plan's catalog step was dropped in favor of the local log-only convention (Decision Log). The EP-3 lesson (baseline-validate the target repo before touching it) paid off in reverse here — both baselines were green, so all validation noise afterward would have been attributable to this plan's files; none appeared.

No keiro-ui ADR change was needed: the requests apply ADR-1..ADR-4 rather than altering them. For EP-5's composition/non-duplication sections, the complete lower-layer handle inventory is now: kiroku IR-8..IR-13, pgmq-hs IR-1..IR-3, shibuya IR-3..IR-5, shibuya-pgmq-adapter IR-2..IR-3.


## Context and Orientation

### The repositories

This plan file lives in the **keiro-ui** repository. The work it directs happens in two *other* repositories, both part of the shibuya project family. At authoring time their working trees are:

- `shibuya` — /Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya
- `shibuya-pgmq-adapter` — /Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya-pgmq-adapter

If those paths have moved, resolve them from the Mori registry: `mori registry show shinzui/shibuya --full` and `mori registry show shinzui/shibuya-pgmq-adapter --full` print each project's current path. Two sibling directories must be left alone: `shibuya.dev` (a stale 0.1.0.0 snapshot predating the current API) and anything related to `shibuya-message-db-adapter` (out of the initiative's scope). The `shibuya-kafka-adapter` repository receives no changes (see Decision Log).

### What shibuya is

Shibuya is a supervised queue-processing framework for Haskell, modeled on Elixir's Broadway. It is a **consumer-side runtime**: an application defines processors, each fed by an *adapter* that owns all queue semantics. The core abstraction is deliberately tiny (`shibuya-core/src/Shibuya/Adapter.hs`):

```haskell
data Adapter es msg = Adapter
  { adapterName :: !Text
  , source      :: Stream (Eff es) (Ingested es msg)
  , shutdown    :: Eff es ()
  }
```

Messages flow `Adapter.source → Ingester → bounded inbox → Processor → Handler → AckDecision`. The runtime's first-class noun is the **`ProcessorId`** (a named consumer loop). Streams, topics, queues, and consumer groups are adapter *configuration*, invisible to core and to every existing endpoint. Ack decisions (`shibuya-core/src/Shibuya/Core/Ack.hs`) are `AckOk | AckRetry | AckDeadLetter | AckHalt`, with structured `DeadLetterReason` values carrying validated dotted `DeadLetterCode`s.

The package split matters to this plan: `shibuya-core` has no web or database dependency; the entire HTTP/WebSocket surface lives in the sister package **`shibuya-metrics`** — the only package in the family flagged as API-exposing. The capability record `docs/capabilities/metrics-endpoints.md` (CAP-10) states the rationale: "It is a separate package rather than part of the core precisely so that adopting Shibuya does not mean adopting a web server." That is the same principle this initiative enforces stack-wide, so every request filed here extends `shibuya-metrics` (or names new sister packages), never core.

### The existing endpoint surface (what a UI can already use)

`shibuya-metrics/src/Shibuya/Metrics/Server.hs` starts a WAI/Warp server (default port 9090, host `*`, hand-rolled routing — no servant anywhere in the repo). Routes: `GET /metrics` (all processors, JSON), `GET /metrics/<processorId>` (single processor, 404 JSON error if unknown), `GET /metrics/prometheus` (Prometheus text), `GET /health` (detailed), `GET /health/live`, `GET /health/ready` (both 200/503, readiness includes injectable dependency checks). A WebSocket at `ws://host:9090/ws` (`shibuya-metrics/src/Shibuya/Metrics/WebSocket.hs`, wire types in `shibuya-metrics/src/Shibuya/Metrics/Types.hs`) speaks a JSON protocol: client sends `{"type":"subscribe_all"}`, `{"type":"subscribe","processors":[…]}`, `{"type":"unsubscribe","processors":[…]}`, `{"type":"ping"}`; server sends `snapshot`, per-processor `update` frames (delta-only, default every 100 ms), `pong`, `goodbye`. Max 100 connections, 30 s server pings.

The data behind those endpoints comes from `shibuya-core/src/Shibuya/Core/Metrics.hs`: `ProcessorState` (`Idle | Processing InFlightInfo UTCTime | Failed Text UTCTime | Stopped`), `StreamStats` (received/processed/failed counters), `BatchStats`, composed into `ProcessorMetrics` and a `MetricsMap` keyed by `ProcessorId`. The write path is a hot/cold split — lock-free `AtomicCounter`s on the message path, a cold `TVar` for the rest — built that way after allocation-focused performance work (shibuya `docs/plans/26-…`, `30-…`, `31-…`). Any request for richer metrics must respect that constraint: nothing may add per-message allocation or contention on the hot path. `MasterMessage` (`shibuya-core/src/Shibuya/Internal/Runner/Master.hs`) is the runtime's internal control channel (currently only processor register/unregister) and is the designed extension point for control actions. In the pgmq adapter, `PgmqAdapterEnv` exposes `onAutoDeadLetter` and `onAckFailure` callbacks — untapped hooks a live dead-letter feed could use.

### What is missing (the audit findings this plan turns into requests)

Confirmed absent as of 2026-08-19, and to be re-confirmed in Milestone 1:

- No queue depth, consumer lag, or backlog age anywhere — neither adapter queries `pgmq.metrics()` or Kafka watermark offsets.
- No per-message processing-duration histograms (a `shibuya_message_processing_seconds` metric exists only in the design doc `docs/plans/METRICS_WEB_UI.md`, never implemented).
- No committed-offset/cursor exposure: `Cursor` rides on each `Envelope` but is never aggregated or exposed.
- No in-flight message identity: `InFlightInfo` is a count; individual message ids are not queryable.
- No DLQ browse or redrive anywhere: dead letters land in pgmq tables (with structured `dead_letter_reason_code`/`dead_letter_reason` JSON fields, from adapter plans 5 and 6); nothing reads them back.
- No pause/resume: fully designed in shibuya `docs/plans/PROCESSOR_PAUSE_DESIGN.md` (source-level pause chosen over inbox-level to avoid lease/visibility-timeout expiry) but never implemented — no `pause`/`resume` identifiers exist in `shibuya-core/src` or `shibuya-metrics/src`.
- No SSE endpoint (designed as Option 3 in `docs/plans/METRICS_WEB_UI.md`, not built).
- No auth, no CORS, no TLS on the metrics server, which binds `0.0.0.0`.
- `shibuya-metrics` has **zero tests** — no test-suite stanza at all; CAP-10's Limits section says "Treat the endpoints as working-but-unproven."
- Counters are per-process and reset on restart; aggregating across replicas is explicitly the caller's job (CAP-9).

### OKF improvement requests — the filing mechanism

An **OKF Improvement Request** is a Markdown document with YAML frontmatter, one file per request, living flat in a repository's `docs/improvement-requests/` directory (the "bundle"). The bundle is declared in the repository's `mori.dhall` under `okfBundles` and governed by a pinned profile (`docs/improvement-requests/profile.dhall`, importing `coordination.improvementRequests` from okf-profiles v0.5.0 in both target repos). Filenames are kebab-case slugs of the title — the `IR-N` handle lives in frontmatter, not the filename. Each bundle also has an `index.md` (catalog) and `log.md` (dated update journal), both of which must be updated when filing.

Existing requests to study before writing (frontmatter and section conventions are imitated exactly):

- shibuya: `docs/improvement-requests/expose-a-public-worker-probe-contract.md` (IR-1, proposed, origin `mori://shinzui/shikigami`) and `docs/improvement-requests/represent-application-defined-permanent-processing-failures-in-dead-letter-reasons.md` (IR-2, released).
- shibuya-pgmq-adapter: `docs/improvement-requests/preserve-application-defined-dead-letter-reasons-in-pgmq-dlq-payloads.md` (IR-1, completed).

The frontmatter shape used by these repositories (v0.5.0-profile era — note `timestamp`, not the newer `generated` family):

```yaml
---
type: Improvement Request
title: <Title>
description: >-
  <One folded sentence: what the requester needs and why it is safe/valuable.>
timestamp: 2026-08-19T00:00:00Z
requestId: IR-<N>
status: proposed
origin: mori://shinzui/keiro-ui
---
```

Body sections, in order: `# Improvement Request: <Title>` heading, then `## Status`, `## Context`, `## Requested Change`, `## Acceptance` (numbered, individually testable criteria), `## Requested Deliverables`. Dependencies and acceptance criteria stay in prose — no released profile accepts structured `dependencies`/`acceptanceCriteria` frontmatter.

Handles are allocated by the `okf` CLI, never by counting files: `okf id next docs/improvement-requests IR --profile docs/improvement-requests/profile.dhall` prints the next free handle (audit-time estimates: `IR-3` in shibuya, `IR-2` in the adapter — treat as estimates only). Cross-repository references inside request prose use canonical Mori URIs only, of the form `mori://shinzui/<project>/okf/improvement-requests/concepts/IR-<N>` — never bare `IR-N`, never file paths into other checkouts. The precedent chain to imitate is keiro IR-9 → shibuya IR-2 → shibuya-pgmq-adapter IR-1: a downstream need driven upstream one repository at a time, linked by handles.

### Related plans and conventions

The MasterPlan (docs/masterplans/1-keiro-runtime-ui-foundations.md) coordinates this plan with its siblings. Two matter here. docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md (EP-1) produces the cross-project conventions document `docs/architecture/inspection-api-conventions.md` in keiro-ui and seeds keiro-ui's `docs/adr/` bundle; this plan soft-depends on it — if EP-1 is complete when you file, cite its conventions document and any relevant `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N` handles inside the requests; if EP-1 is not complete, file anyway and reference the conventions work as pending by plan path (`mori://shinzui/keiro-ui` project URI plus `docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md`, noting the artifact-level URI is pending). docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md (EP-3) files the pgmq-hs queue-endpoint requests that the adapter's queue-context request defers to; same rule — cite filed handles if EP-3 has run, otherwise reference the plan and record a follow-up to backfill handles.

ADR status: the keiro-ui repository has no `docs/adr/` yet (EP-1 creates it), so **no local ADR exists for this plan**. Neither shibuya repository has any ADR corpus at all — there is no `docs/adr/` anywhere in the shibuya family. This plan does not create one there; instead, each filed request names, in its Requested Deliverables, the durable decisions the implementer should record (for example: the control-plane gating model for pause/resume, and the CORS posture of `shibuya-metrics`).

Terms used above: *WAI/Warp* — the standard Haskell web-server interface and server; *Prometheus text* — the plain-text metrics scrape format; *DLQ* — dead-letter queue, where messages that permanently fail processing are parked; *pgmq* — a PostgreSQL-native message-queue extension whose Haskell client is pgmq-hs.


## Plan of Work

### Milestone 1 — Re-confirm the audit in both working trees

The audit summarized above was taken on 2026-08-19. Repositories move; filing requests against stale facts wastes everyone's time. Before writing anything, re-verify in the `shibuya` working tree that: `shibuya-metrics` still has no test-suite stanza and no CORS handling; pause/resume is still absent from core and metrics sources; no processing-duration histogram exists; and the improvement-requests bundle still validates cleanly *before* your changes (so any later failure is attributable to your files). In the adapter tree, re-verify that no code queries `pgmq.metrics` and that nothing reads dead-letter queues back. Record deviations in Surprises & Discoveries and adjust the requests accordingly — if something has meanwhile been implemented, the corresponding request shrinks or disappears (note it in the Decision Log rather than filing a dead request).

At the end of this milestone nothing is written to either repository; the acceptance is a filled-in checklist of confirmations in this plan's Progress section and a green baseline validation run in both repos.

### Milestone 2 — Author and file the shibuya requests

Three requests, each its own file in `shibuya/docs/improvement-requests/`. Allocate handles one at a time with `okf id next` immediately before writing each file (the estimates IR-3/IR-4/IR-5 shift if the repo gained requests since the audit). For each request, write the frontmatter exactly per the template in Context and Orientation, then the five body sections. The content the UI initiative needs in each:

1. **Processor inspection depth** (suggested slug: `expose-processor-progress-latency-and-in-flight-detail-for-inspection-uis`). Context: the UI can render `ProcessorMetrics` today but cannot answer "how fast", "how far", or "on what is it stuck". Requested change: per-message processing-duration distribution (histogram or summary adequate for a latency panel), per-processor cursor/offset progress (the latest acknowledged `Cursor` per partition where the adapter supplies one), and an in-flight visibility story (at minimum, age of the oldest in-flight message; individual message identity only if the hot-path constraint allows). The request must state the constraint explicitly: the metrics write path is a hot/cold split over `AtomicCounter`s (shibuya plans 26/30/31); no per-message allocation or lock contention may be added, and designs should aggregate on the read side. Acceptance criteria phrased as observable endpoint behavior (for example: `GET /metrics/<processorId>` includes a duration distribution and, when the adapter supplies cursors, a progress field; the WebSocket `update` frame carries the same additions additively).
2. **Pause/resume as the first control plane** (suggested slug: `implement-designed-processor-pause-resume-and-expose-gated-control-endpoints`). Context: `docs/plans/PROCESSOR_PAUSE_DESIGN.md` fully designs source-level pause (chosen so leases/visibility timeouts do not expire mid-pause) including the `ProcessorState` extension, pause handle, `MasterMessage` extension, and a six-test plan; `docs/plans/METRICS_WEB_UI.md` already names control commands as the WebSocket's intended future. Requested change: implement that design and expose pause/resume through `shibuya-metrics` as explicitly gated control operations (disabled by default in configuration; the request proposes the gating model and asks the implementer to record the decision durably). Acceptance: pausing stops new message starts without expiring leases; state is visible as a distinct `ProcessorState`; control endpoints refuse when the gate is off.
3. **Browser-consumption hardening** (suggested slug: `harden-shibuya-metrics-for-browser-clients-cors-tests-and-ws-convention-alignment`). Context: `shibuya-metrics` has zero tests, no CORS (a browser UI on another origin cannot call it at all), and its WebSocket dialect predates the cross-project convention being defined by keiro-ui EP-1. Requested change: configurable CORS origins; a test suite covering every published route and the WS protocol frames; additive-only convergence with the cross-project WS convention (typed `type`-tagged frames, subscribe/unsubscribe, snapshot-then-delta, ping/pong, bounded queues with overflow signaling) — published frames must not break. Reference `mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-1` (the worker probe contract request from the Shikigami project): this request aligns with IR-1's package-boundary rule and must not duplicate its probe ask; say so in the Context section.

Then update the bundle catalog: add one line per new request to `docs/improvement-requests/index.md` in the style of the existing entries, and append a dated `## 2026-08-19`-style section (use the actual filing date) to `docs/improvement-requests/log.md` with one `* **Addition**: …` bullet per request. Run the validation commands (Concrete Steps), run `nix fmt` (required by shibuya's CLAUDE.md before committing), and commit with the trailers given below.

### Milestone 3 — Author and file the shibuya-pgmq-adapter requests

Two requests in `shibuya-pgmq-adapter/docs/improvement-requests/`, same mechanics, handles from `okf id next` in that repository (estimate IR-2/IR-3):

4. **Queue-context observability** (suggested slug: `surface-queue-depth-and-age-context-for-processors-consuming-pgmq-queues`). Context: an operator looking at a processor cannot see how deep the queue behind it is or how old its backlog is; the adapter is the only shibuya-family component that knows which pgmq queues a processor consumes and holds the connection to reach them. Requested change: expose, per configured queue, depth and oldest-message age alongside the processor that consumes it — *sourcing* those numbers from pgmq-owned surfaces per the MasterPlan's layer-ownership rule. The request must name the pgmq-hs requests filed by keiro-ui EP-3 as the preferred source (cite their `mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-N` handles if EP-3 has filed them; otherwise reference EP-3 by plan path and record in this plan's Progress a follow-up to backfill the handles into the filed request), with direct `pgmq.metrics($1)` queries acceptable only as an interim in-process source.
5. **DLQ browse and redrive** (suggested slug: `expose-dead-letter-queue-browse-and-redrive-for-adapter-managed-dlqs`). Context: the adapter routes permanently failed messages to dead-letter queues with structured `dead_letter_reason_code`/`dead_letter_reason` JSON payload fields (adapter plans 5 and 6), and `PgmqAdapterEnv.onAutoDeadLetter`/`onAckFailure` callbacks fire on the way — but nothing reads a DLQ back or returns a message to its source queue. Requested change: a read surface over adapter-managed DLQs (list entries with reason code, reason, attempt count, original queue; fetch one entry) and an explicit, gated redrive operation, plus optionally a live dead-letter feed built on the existing callbacks. Acceptance phrased against observable behavior on a real pgmq database (the adapter's test harness already provisions one).

Update that bundle's `index.md` and `log.md`, validate, `nix fmt`, and commit. Finally, record every allocated handle in this plan (Progress and, if renumbered from the estimates, the Decision Log), and update the MasterPlan registry row for EP-4.


## Concrete Steps

All commands are non-destructive except file creation and `git commit`. Resolve repo paths first if needed:

```bash
mori registry show shinzui/shibuya --full | grep 'Path:'
mori registry show shinzui/shibuya-pgmq-adapter --full | grep 'Path:'
```

Milestone 1, in the shibuya working tree (`/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya`):

```bash
grep -n 'test-suite' shibuya-metrics/shibuya-metrics.cabal          # expect: no output
grep -rniE 'cors|access-control-allow' shibuya-metrics/src           # expect: no output
grep -rniE '\bpause\b|\bresume\b' shibuya-core/src shibuya-metrics/src   # expect: no output
grep -rn 'processing_seconds\|duration' shibuya-metrics/src          # expect: no histogram code
okf validate docs/improvement-requests \
  --profile docs/improvement-requests/profile.dhall \
  --profile-enforce --log-enforce                                    # expect: success, baseline
okf id next docs/improvement-requests IR \
  --profile docs/improvement-requests/profile.dhall                  # note the printed handle
```

In the adapter tree (`/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya-pgmq-adapter`):

```bash
grep -rn 'metrics' shibuya-pgmq-adapter/src | grep -vi prometheus    # expect: no pgmq.metrics usage
okf validate docs/improvement-requests \
  --profile docs/improvement-requests/profile.dhall \
  --profile-enforce --log-enforce                                    # expect: success, baseline
okf id next docs/improvement-requests IR \
  --profile docs/improvement-requests/profile.dhall                  # note the printed handle
```

Milestones 2 and 3, per request: run `okf id next` (as above) immediately before creating each file; create `docs/improvement-requests/<slug>.md` with the frontmatter template from Context and Orientation and the five body sections; add the `index.md` line and the `log.md` entry; then re-validate:

```bash
okf validate docs/improvement-requests \
  --profile docs/improvement-requests/profile.dhall \
  --profile-enforce --log-enforce
mori validate
nix fmt
```

Expected validation output is a clean pass; a typical failure names the offending file and rule (for example, a `requestId` collision or a missing required key) — fix and re-run. Commit per repository (conventional commits; cross-repo Mori-URI trailers because the plan lives in keiro-ui):

```text
docs(okf): file keiro-ui inspection improvement requests

Add IR-<N>..IR-<M>: processor inspection depth, pause/resume control
plane, and browser-consumption hardening for shibuya-metrics.

MasterPlan: mori://shinzui/keiro-ui/masterplans/1-keiro-runtime-ui-foundations
ExecPlan: mori://shinzui/keiro-ui/plans/4-audit-shibuya-and-file-ui-endpoint-improvement-requests
```

Commits that update this plan file itself (in keiro-ui) use repository-relative trailers instead:

```text
MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/4-audit-shibuya-and-file-ui-endpoint-improvement-requests.md
```

No `Intention:` trailer is used anywhere in this initiative.


## Validation and Acceptance

The plan is complete when all of the following hold, each observable by running a command:

1. In the shibuya repo, `ls docs/improvement-requests/` shows three new kebab-case files; `grep -h 'requestId' docs/improvement-requests/*.md` shows three new unique `IR-N` handles with no collisions; `okf validate docs/improvement-requests --profile docs/improvement-requests/profile.dhall --profile-enforce --log-enforce` exits 0; `mori validate` exits 0.
2. The same holds in the shibuya-pgmq-adapter repo for its two new files.
3. Each new request's frontmatter carries `status: proposed` and `origin: mori://shinzui/keiro-ui`; each body has the five conventional sections with numbered, testable acceptance criteria; every cross-repository reference in the prose is a canonical `mori://` URI (verify spot-checks with `mori path <uri>` where resolvable).
4. `git log --oneline -n 3` in each repo shows the filing commits, and `git log -1 --format=%B` shows both Mori-URI trailers.
5. This plan file records the allocated handles, and the MasterPlan's registry and Progress reflect EP-4 completion.

Nothing here requires building any Haskell code; the deliverables are documents plus catalog/journal updates, and their validators are the acceptance gates.


## Idempotence and Recovery

Every step is safely repeatable. `okf id next` is read-only and returns one more than the highest allocated handle — re-running it after a partial filing simply reflects the handles you already consumed; never reuse or back-fill a handle. If validation fails mid-filing, the bundle is only files on disk: fix or delete the offending file, re-run validation. If a handle was allocated in a file that you then delete before committing, prefer renumbering the remaining new files downward only if nothing has been committed; once committed, handles are permanent and gaps are acceptable (the profile forbids gap-filling). If EP-3's pgmq-hs handles were unavailable at filing time, the adapter's queue-context request references the EP-3 plan by project URI and path; when the handles exist, amend the filed request in a follow-up commit (an **Update** entry in `log.md`) rather than rewriting history.


## Interfaces and Dependencies

This plan produces documents, not code, but the documents pin interfaces other work depends on:

- Five improvement-request files whose handles (`IR-N` in each repository's bundle) become the canonical references `mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-<N>` and `mori://shinzui/shibuya-pgmq-adapter/okf/improvement-requests/concepts/IR-<N>`. The keiro filing plan (docs/plans/5-audit-keiro-and-file-ui-endpoint-improvement-requests.md) and the UI direction plan (docs/plans/6-set-the-general-direction-for-the-keiro-runtime-ui.md) cite these handles.
- Tooling: the `okf` CLI (validate, id next) and `mori` CLI (validate, registry show, path) must be on PATH in both working trees; both repos provide them via their Nix dev shells (`nix develop`). `nix fmt` must pass before each commit per shibuya's CLAUDE.md.
- Referenced-but-not-modified interfaces the requests constrain: `Shibuya.Core.Metrics` (`ProcessorMetrics`, hot/cold write path), `Shibuya.Metrics.Types` (WS frames — additive evolution only), `Shibuya.Internal.Runner.Master.MasterMessage` (control-channel extension point), `Shibuya.Adapter.Pgmq.Config.PgmqAdapterEnv` (`onAutoDeadLetter`, `onAckFailure`), and the pgmq DLQ payload contract fields `dead_letter_reason_code`/`dead_letter_reason`.
