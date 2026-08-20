# Keiro Runtime UI Prior-Art Survey

A survey of the operator UIs of comparable systems — durable-execution engines, event stores,
CQRS/event-sourcing platforms, message-log consoles, job-queue dashboards, and BEAM-ecosystem
telemetry dashboards — conducted **August 2026** to ground the direction of the keiro runtime
UI (see `ui-direction.md` beside this document). Restate was verified at source level; the
others were surveyed from documentation, repositories, and release notes.

**Caveat**: these tools move quickly. The claims below were accurate as surveyed; re-verify
any claim before making it load-bearing in new work. This document is a snapshot argued from,
not a maintained comparison.


## Restate

Restate is the user-named benchmark for durable execution, and it earned the position: it has
the strongest introspection-API story of anything surveyed. The React UI ships inside the
server binary and is served on the admin port — zero-install, one process, one origin.

The API is two-tier. Actions are typed admin REST verbs: cancel, kill, pause, resume,
restart-as-new, and purge are each a `PATCH /invocations/{id}/{op}` — a closed, discoverable
verb set rather than a generic mutation endpoint. Reads go through a **read-only SQL
introspection endpoint** (`POST /query`, an embedded DataFusion engine) whose system tables
serve the CLI, the UI, and end users alike: `sys_invocation` carries roughly fifty columns of
lifecycle, provenance, and failure detail; `sys_journal` projects each journal entry both raw
and as JSON; `sys_journal_events`, `state`, and per-queue blocked-on breakdowns round out the
schema. One canonical query surface means the UI can never show something a user cannot query
themselves — and the embedded SQL editor with predefined queries is the deliberate power-user
escape hatch.

Two design choices stand out. First, **auto-pause replaces the dead-letter queue**: when an
invocation exhausts its retries it freezes in place with its journal intact, awaiting human
action — the failure keeps its full context instead of being shipped to a side queue. Second,
**liveness is pure polling** even in a polished v1: invocation views poll at 2 s; the overview
polls adaptively at `clamp(10s, 10 × last fetch duration, 60s)`, so a slow backend
automatically slows the UI down instead of being hammered by it. Invocations hyperlink to each
other, rendering a "distributed call stack" across services.


## Temporal Web UI

Temporal's contribution is discipline about having exactly one API. The server, CLI, and web
UI all speak the same proto-annotated gRPC/HTTP surface; the UI's own server collapsed over
time into a thin gateway whose only real jobs are static serving and **write-gating
middleware** (`disableWriteActions` globally, plus per-action flags below it).

Its second contribution is event-history rendering at scale. Raw workflow histories are
clustered into **event groups** — logical operations like "activity scheduled/started/
completed" become one visual unit — and shown through multiple lenses (Timeline, Compact,
All, JSON) over one underlying store, virtualized so hundred-thousand-event histories render.
The live tail arrives by long-poll (`waitNewEvent=true`) rather than a push channel.

Two more patterns matter beyond workflows. The **codec-server pattern** separates payload
decryption from server access: the UI can be fully authorized to read event metadata while
payload plaintext requires a separately deployed, separately authorized codec service —
payload visibility as its own axis. And the typed, discoverable **search-attribute registry**
powers both a guided filter builder and a raw query editor, with filter state living in the
URL and saveable as named views.


## Inngest

Inngest's trace viewer draws **queue delay and execution time as distinct segments of one
span bar** — the most honest scheduler-versus-user-code visualization surveyed, and exactly
the distinction an operator needs when deciding whether the system or the handler is slow.

Its operational actions are shaped as **first-class jobs**: replay and bulk-cancel are named
objects with pre-flight impact estimates ("this will re-run N runs") and their own progress
pages, not fire-and-forget buttons. Rerun-from-step with editable input turns the trace
viewer into a REPL over history. Span outputs are fetched lazily by id, so large payloads
never bloat the trace tree.


## Kurrent / EventStoreDB

The event-store canon. The stream browser treats `$all` as just another browsable stream,
offers pause/resume of the live display, and models stream metadata as streams themselves —
uniformity that keeps the mental model small. Persistent-subscription dashboards show
in-flight and **parked counts with one-click replay-parked** — the closest surveyed analogue
to a dead-letter redrive built into a subscription view. The projection **step-debugger** runs
one event at a time against a projection beside its pending queue — the only surveyed tool
that lets an operator watch a fold happen.

Liveness rides the Atom protocol's immutability: long-poll on the mutable head, while
back-pages carry immutable-cache headers and cache forever — a pattern any position-addressed
log can copy.

Two cautionary tales. The bundled UI rotted on a deprecated protocol and had to be replaced
across three surfaces — a warning about coupling a UI to a transport rather than a contract.
And license-gating basic observability backfired with the community and was reversed —
inspection is table stakes, not an upsell.


## AxonIQ Platform

The closest thing to a full CQRS/event-sourcing console that ships today. Event processors
are first-class: per-segment status, lag, and position; **segment claim percentage as the
single ownership-health number** (100% claimed = healthy; less = orphaned work); and
split/merge/move segment actions in the UI.

Its **replay guardrail sequence** is the strongest mutation UX surveyed and the template for
anything replay-shaped: auto-pause all processor instances first, require a typed
confirmation that states irreversibility, offer an explicit reset-point choice (beginning,
tail, or timestamp), then show live progress during the replay. Its **DLQ models dead letters
as per-aggregate sequences** rather than loose messages — preserving order within the
aggregate that failed — with payloads hidden by default behind an explicit opt-in
(`dlq-mode`), keeping payload visibility separate from triage access. Aggregate stream length
with a recommended ceiling is a first-class metric — the only surveyed nod toward
aggregate-level health.


## Smaller event-sourcing tools

None of the smaller event-sourcing ecosystems ships a console comparable to the tools above,
which is itself a survey finding: the aggregate-centric operator experience is underserved
everywhere. Rails Event Store ships a mountable browser whose distinguishing feature is
**causation and correlation navigation** — from any event to what caused it and what it
caused — the seed of the transaction-DAG idea in the unclaimed-territory list. CritterWatch
and the other small event-store viewers surveyed stop at stream/event browsing; the
Elixir/Commanded and .NET/Marten ecosystems lean on their host platforms' dashboards rather
than shipping their own. The takeaway is consistent: stream browsers exist everywhere,
aggregate browsers essentially nowhere.


## Redpanda Console, Kafbat UI, and AKHQ

The Kafka-console family answers one hard question well: how to search an unbounded log
interactively. Redpanda Console runs message search as a **server-side streaming scan with
explicit phase/progress frames** — the client sees "scanning partition X, N matched, M
scanned" as it happens — and the completion frame carries a next-page token, making an
unbounded scan feel bounded. Push-down filters run over deserialized payloads; the safety
lesson comes from Kafbat, which deliberately replaced user-supplied JavaScript predicates
with sandboxed CEL expressions after the obvious injection/resource risks. AKHQ covers the
same ground with a conventional form-based UI.

The family's recognized gap is liveness: consumer-group lag views that do not auto-refresh
are a repeated complaint — a lag number that silently goes stale is worse than none.


## Oban Web

Oban Web (the Elixir job-queue dashboard) contributes the strongest **gating pattern**
surveyed: the host application implements one small **resolver** callback interface that
grants per-user read-only or per-action rights, applies payload redaction at render time, and
caps query cost — authorization, visibility, and resource protection in one seam owned by the
host, not the dashboard. Its qualifier search over nested JSON job arguments (with
autocompletion and scan caps) shows how to make structured search safe. Per-queue utilization
gauges and sparklines, and a user-selectable refresh interval (1/2/5/15 s or paused), round
out the pattern set.


## Sidekiq Web

Sidekiq Web's headline lesson is metric choice: **queue latency — the age of the oldest job —
is the health number**, with depth second. Depth alone lies (a deep queue draining fast is
healthy; a shallow queue whose head is old is not). Its dead set is a bounded **morgue** with
resurrect semantics — failed jobs age out unless resurrected, keeping the failure surface
finite. Liveness is two-tier polling with a user-facing slider, the simplest workable version
of user-controlled liveness.


## Phoenix LiveDashboard and BroadwayDashboard

BroadwayDashboard is shibuya's direct ancestor (shibuya is modeled on Broadway) and the
benchmark for the processor surface. It renders pipeline topology as a **layered stage graph**
(producers → processors → batchers) with per-stage **workload % = busy/(busy+idle)** — one
number per stage that says where the pipeline is saturated.

Its cost model is the one to copy: lock-free counters on the message hot path; a 1 Hz
server-side per-pipeline aggregator that pushes to subscribed viewers; and the aggregator
**auto-stops when nobody is watching**, so observation costs nothing when unobserved.
LiveDashboard's signed-token trick — tailing one tagged request's log lines live — shows how
to scope a live feed to one entity cheaply. The limitation to design around: it is
aggregates-only; it cannot answer "which message failed and why", which is exactly where a
DLQ-integrated design must go further.


## Briefs: DBOS, Prefect, Windmill, Trigger.dev

**DBOS** (Postgres-backed durable execution) demonstrates the same architectural bet the
keiro stack makes — the database is the engine — and its time-travel debugging story shows
what a journal-complete runtime can offer tooling. **Prefect** is a mature Python
orchestrator whose UI is strong on run states and retries but flow-centric rather than
entity-centric — a reminder that orchestration UIs and inspection UIs are different genres.
**Windmill** bundles scripts/flows/apps into one operational console; its breadth costs it
depth in any one inspection surface. **Trigger.dev** brings the Inngest-style run timeline to
TypeScript background jobs with solid replay ergonomics. None of the four adds a pattern the
tools above do not already exemplify; they corroborate the synthesis.


## Synthesis

### Information architecture

Every mature tool converges on the same skeleton: **entity list → detail → timeline
drill-down**, four to seven top-level navigation entries, an environment/cluster switcher,
filter state serialized in the URL (shareable, bookmarkable), cross-entity hyperlinks as the
primary navigation (not breadcrumbs), and a power-user escape hatch (Restate's SQL editor,
Temporal's raw query, Redpanda's push-down filters). Tools that deviate (deep nav trees,
modal-heavy flows) read as legacy.

### Live-update mechanisms

| Tool | Mechanism | Cadence / notes |
|------|-----------|-----------------|
| Restate | Pure polling | 2 s invocation views; overview `clamp(10s, 10× fetch, 60s)` |
| Temporal | Long-poll hybrid | `waitNewEvent=true` history tail over the canonical API |
| Inngest | Polling + lazy fetch | Span outputs fetched by id on demand |
| Kurrent/EventStoreDB | Long-poll on Atom head | Immutable back-pages cache forever |
| AxonIQ Platform | Polling | Live progress views during replay |
| Redpanda Console | Streaming scan frames | Explicit phase/progress/completion protocol |
| Oban Web | Polling, user dial | 1/2/5/15 s or paused |
| Sidekiq Web | Two-tier polling | User slider |
| LiveDashboard/Broadway | Server push (LiveView) | 1 Hz aggregator; auto-stops unwatched |

The transports differ; the winning properties repeat regardless of transport:
**user-controlled liveness** (pause toggles, refresh dials), **adaptive cadence** (Restate's
clamp), and **progress framing for unbounded work** (Redpanda's scan frames). Push, where
used, is an accelerator over an authoritative read — nobody surveyed treats a push stream as
the source of truth, which independently confirms the stack's own push-is-a-hint rule
(`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-3`).

### Introspection-API design

The recurring patterns, roughly from most to least general: **SQL passthrough** (Restate's
DataFusion tables — maximum power, needs read-only guarantees and cost caps); **one canonical
API** shared by UI/CLI/users (Temporal — prevents UI-only capabilities); a **filtering DSL
spectrum** from typed form builders through query languages to sandboxed expressions (Kafbat's
JS→CEL retreat marks the safety boundary); **cursor + long-poll** for tails over
position-addressed logs (EventStoreDB); **lazy payload fetching** by id so lists stay light
(Inngest); and **payload privacy as an API concern** (Temporal's codec seam, AxonIQ's
dlq-mode) rather than a UI afterthought.

### Actions and gating

The gating ladder, weakest to strongest:

1. **Nothing** — read-write UI with no gate (the historical default; nobody defends it).
2. **Global read-only flag** — Temporal's `disableWriteActions`; blunt but honest.
3. **Per-action flags** — Temporal's finer switches; AxonIQ's dlq-mode for visibility.
4. **Server-side discipline the UI merely renders** — Restate's typed verbs; keiro-ops-style
   preview/confirm belongs at this rung: the gate lives in the API, so every client inherits
   it.
5. **Host-app resolver callbacks** — Oban's per-user, per-action, per-payload seam; the
   strongest surveyed, because the deployment owns the policy.

Payload visibility is an independent axis at every rung (codec server, dlq-mode, render-time
redaction). Destructive bulk operations are safest as first-class jobs with impact preview
and progress (Inngest, AxonIQ replay) — never as a button that returns 200.


## Unclaimed territory

Four things no surveyed tool does well, all of which the keiro runtime already persists the
data for — the differentiation targets for this UI:

1. **Aggregate-centric drill-down.** Aggregate → its event stream and folded current state
   side by side → each projection's cursor relative to this aggregate's head. Nothing
   surveyed renders an aggregate as the first-class object; AxonIQ's stream-length metric is
   the closest gesture.
2. **Causation/correlation DAGs.** The full graph of one business transaction across
   aggregates, process managers, and workflows — Rails Event Store navigates edges one at a
   time; nobody draws the graph.
3. **Live process-manager state.** Journal-derived instance state, the "waiting on" panel,
   pending timers, and stuck-instance surfacing — process managers are invisible in every
   surveyed tool.
4. **Replay blast-radius preview.** Every replay UI warns about irreversibility; none
   estimates the event count, expected duration, and side-effect handlers that will refire
   before the operator commits. The runtime's positions and checkpoints make the estimate
   computable.
