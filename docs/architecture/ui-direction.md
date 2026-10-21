# Keiro Runtime UI — General Direction

This document sets the general direction for the keiro runtime UI: the browser console that
any application built on the keiro runtime stack — **keiro** (event-sourcing framework and
workflow engine), **kiroku** (append-only PostgreSQL event store), **shibuya** (supervised
queue processing), and **pgmq-hs** (PostgreSQL-native queues) — can run beside its deployment
to inspect aggregates, workflows, process managers, timers, projections, streams,
subscriptions, queues, and dead letters.

It is the anchor a future "build the console" MasterPlan starts from. It is argued from the
prior-art survey in `ui-prior-art-survey.md` (August 2026) and constrained by the
cross-project conventions in `inspection-api-conventions.md` and the decisions in this
repository's `docs/adr/` bundle (`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-1` through
`ADR-4`). Every endpoint the screens consume is specified by an improvement request filed in
the owning repository; the screen inventory cites each by canonical handle. No application
code exists yet; this document ships direction, not code.


## Purpose and audience

The UI is an **inspection and operations console** for operators and developers of any
application on the keiro runtime. It is explicitly not a metrics-and-traces dashboard: keiro's
observability posture routes spans, gauges, and histograms through OpenTelemetry into
whatever dashboards the operator already runs, and the UI's sanctioned boundary — state
browsing and safe operator actions over supported APIs, nothing OTel already does — is the
subject of the stance ADR requested from keiro
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-32`).

The console answers the questions dashboards cannot: which aggregates exist and what state do
they hold; which workflow instances are running, stuck, or awaiting a signal, and what does
their journal say; what did a process manager last do and what is it waiting on; how fresh is
each projection against `visible_store_head`; what is in this queue, how old is its head, and
why did these messages dead-letter.

It runs beside a deployment in one of two ways (detailed in Deployment and embedding): as
static assets served by the composed single-port mount requested from keiro
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-31`), or as a standalone static
app pointed at the individual per-project surfaces.


## Information architecture

Top-level navigation follows the surveyed skeleton (entity list → detail → timeline
drill-down; four to seven entries), with seven entries:

1. **Overview** — headline health: queue latency (age of the oldest ready message, per
   Sidekiq's lesson — latency first, depth second), workflow status counts, projection
   freshness as global position distance, processor states.
2. **Aggregates** — the differentiation surface; see the screen inventory.
3. **Workflows** — durable execution: instances, journals, awakeables, children.
4. **Process Managers & Timers** — instances, waiting conditions, pending timers, shards.
5. **Projections & Read Models** — freshness, rebuild operations.
6. **Streams & Subscriptions** — kiroku's store: browsing, tails, checkpoints, store dead
   letters.
7. **Queues & Processors** — pgmq queues and shibuya pipelines, including queue dead letters
   and redrive.

**Cross-entity hyperlinks are the primary navigation**: a workflow links to its journal
stream; a dead letter links to its source queue and to the originating stream position; an
aggregate links to the projections consuming its category; a processor links to the queue
behind it. Filter state lives in the URL so every view is shareable and bookmarkable. An
**environment/connection switcher** selects which deployment's surfaces the app points at;
connection profiles are client-side configuration.

A **power-user escape hatch** is noted as a candidate, not a commitment: a predefined-query
browser over the stack's guarded SQL contracts (the `keiro_read` views such as
`keiro_read.projection_group_status_v1`, and `kiroku.subscription_checkpoints_v1`), in the
spirit of Restate's embedded SQL editor. It would require its own endpoint work and its own
request; nothing in this document depends on it.


## Screen inventory

Every screen names the endpoint surface it consumes by canonical improvement-request handle.
Handles resolve under `mori://shinzui/<project>/okf/improvement-requests/concepts/<IR-N>`;
all cited requests are filed (none awaited). The live-update mechanism for every screen is
the poll-first pattern of the Data layer section; screens with a WebSocket accelerator name
it.

**Aggregate browser** — the unclaimed-territory screen no surveyed tool has. List aggregates
by category, drill into one: its **event stream and folded current state side by side**, with
snapshot metadata and each consuming projection's cursor rendered relative to this
aggregate's head. Depends on keiro IR-28 (aggregate list/hydrate/snapshot reads and
endpoints) for state, and delegates raw event pages to kiroku IR-8 (stream/category/event
browsing), which also owns the stream-name resolution step that
`mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` requires for fan-in reads. Live: poll;
workflow-grade liveness is unnecessary here.

**Workflow list and detail** — the durable-execution centerpiece, in Restate's mold. The
list pages instances by status class, type, and age over the `keiro_workflows` wake ledger
(keiro IR-30's cursor-paged reads); the detail renders the journal as a timeline with event
grouping and multiple lenses (Temporal's pattern), drawing queue-delay and execution time as
distinct segments (Inngest's pattern), paging journal, steps, children, and awakeables
incrementally (IR-30). Actions — cancel, resurrect, lease operations — ride keiro IR-26's
gated ops-over-HTTP verbs with preview-then-confirm. Live: the workflow feed of keiro IR-27
accelerates the list and the open instance's header.

**Process-manager instances** — journal-derived instance state, a "waiting on" panel, pending
timers, stuck-instance surfacing, and shard-ownership views. Depends on keiro IR-29; raw
journal browsing delegates to kiroku IR-8. Live: poll, with IR-27 feeds as they cover PM
state.

**Projection status and rebuild** — freshness for every projection group as **global
position distance** against `visible_store_head` (the ADR-28 vocabulary: `store_position`,
`visible_store_head`, never "lag" or "backlog" on keiro surfaces), over the projection domain
of keiro IR-26 (wrapping the frozen `keiro_read.projection_group_status_v1` contract,
`mori://shinzui/keiro/okf/adrs/concepts/ADR-35`). Rebuild follows AxonIQ's guardrail sequence
— pause, typed confirmation stating irreversibility, reset-point choice, live progress — and
adds the **blast-radius preview** differentiator: estimated event count and duration computed
from positions before the operator commits.

**Stream browser** — `$all` and per-stream tails, category browsing, event detail, and
causation/correlation navigation (the transaction-DAG differentiator grows here). Reads ride
kiroku IR-8; the live tail rides kiroku-metrics' existing WebSocket
(`{"type":"subscribe_events","from_position":N,"category":"..."}` with snapshot-then-`event`
frames, replay cursors, and drop-oldest overflow signaled in-band — the shipped dialect the
conventions froze), with additive convergence per kiroku IR-12. The UI treats
`from_position` as an opaque resumption cursor.

**Subscription and checkpoint dashboard** — the durable checkpoint inventory as truth
(kiroku IR-10: cross-process, includes `store_position`), the live in-process registry as
annotation, and store dead letters with reasons (kiroku IR-9), following EventStoreDB's
parked-messages pattern. Redrive of store-level dead letters is *not* offered until an
owning-repository request specifies it; the screen is read-only.

**Queue dashboard** — queue list, latency headline and depth (total versus visible labeled
distinctly), non-destructive peek, archive browsing, message-by-id: pgmq-hs IR-3's endpoints
over IR-1's reads (IR-2's codecs beneath). Queue-behind-processor context comes from
shibuya-pgmq-adapter IR-2; the **DLQ morgue with gated redrive** — reason code, structured
reason, attempt count, original queue — from shibuya-pgmq-adapter IR-3. Live: pgmq IR-3's
NOTIFY-driven feed accelerates depth and inserts; polling remains authoritative.

**Processor pipeline view** — BroadwayDashboard's layered stage graph with per-stage
workload %, plus per-processor duration distributions, cursor progress, and oldest-in-flight
age from shibuya IR-3, delivered live over shibuya-metrics' WebSocket
(`subscribe_all`/`subscribe` → `snapshot` then delta `update` frames — the shipped dialect)
as hardened by shibuya IR-5. Pause/resume appears as a gated action per shibuya IR-4, gate
state rendered honestly.

**Overview** — composes the headline numbers of all of the above from the same endpoints; it
introduces no data dependency of its own.


## Data layer

**One typed TypeScript client package per endpoint surface**, mirroring repository ownership:
`@keiro-ui/client-kiroku`, `@keiro-ui/client-shibuya`, `@keiro-ui/client-pgmq`,
`@keiro-ui/client-keiro`. There is **no backend-for-frontend**: the UI consumes each
project's own endpoints directly (or through the composed mount, which is routing, not
aggregation). This is the survey's strongest architectural lesson — Temporal's UI server
collapsed into a thin gateway over the one canonical API; Restate's UI never does anything
the public API cannot — and a bespoke aggregation server would recreate the four-dialect
problem the conventions exist to prevent. Recorded as
`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-5`.

Clients are hand-written against `inspection-api-conventions.md` first (cursor pagination:
`from` exclusive + `limit`, `items` + `next_cursor` with omission as the end signal, cursors
opaque; the structured error envelope under one `error` key; snake_case fields), and
regenerated from machine-readable specs if the runtime repositories later publish them.

**Server state lives in TanStack Query.** Polling is the baseline for every view, with
per-surface defaults and adaptive intervals — Restate's
`clamp(10s, 10 × last fetch duration, 60s)` pattern by name — so slow backends slow the UI
rather than being hammered by it. **WebSocket feeds are cache-updating subscriptions layered
over the poll baseline, never replacing it**: a frame updates the query cache; a missed frame
costs latency, not correctness, because the poll path is authoritative
(`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-3` — push is a hint, poll is truth; and the
overflow `error` frames the WS convention mandates trigger a refetch). One shared WS client
core implements the convention's structural shape (`type`-tagged frames,
subscribe/unsubscribe, snapshot-then-delta, ping/pong, `goodbye`, overflow handling) and is
parameterized per dialect with frame names —
`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-2` is what makes one core sufficient.

Every live view exposes a **user-visible pause/refresh control** (the survey's universal
pattern). Error rendering consumes the conventions' envelope: `code` switches behavior,
`message` displays verbatim, `details` expands. The ADR-28 vocabulary rules are applied at
the display layer for keiro surfaces: the clients pass `store_position` and
`visible_store_head` through untranslated, and no keiro-facing screen labels a position
distance "lag".


## Application architecture

React + TypeScript + Vite, in a bun workspace in this repository (originally planned as
pnpm; switched to bun on 2026-10-21, see `docs/masterplans/2-build-the-keiro-runtime-console.md`):

- `apps/console` — the application shell, routing, screens.
- `packages/client-kiroku`, `packages/client-shibuya`, `packages/client-pgmq`,
  `packages/client-keiro` — the typed clients (published names `@keiro-ui/client-*`).
- `packages/ui-adapter` — the design-system adapter.

The **design-system adapter is the library-agnosticism mechanism**
(`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-6`): screens import UI primitives — table,
dialog, form controls, toast, tabs, badge — exclusively from the adapter's own interface,
never from a component library directly. The component-library choice (IntentUI versus
shadcn/ui) is explicitly out of this initiative's scope and stays open; when it is made, the
adapter gains exactly one implementation and no screen changes. Both candidates cover the
needed primitives, so the adapter interface is small and honest rather than a
lowest-common-denominator abstraction.

State beyond server caches stays in the URL (filters, cursors, selected entities) and
component state until proven otherwise — no global state library is adopted speculatively.
Charting is a separate, later choice; the direction requires only sparkline, gauge, and
timeline capabilities of whatever is chosen.


## Actions and gating

**Read-only first.** The first release ships no mutations. Mutations arrive only as the
owning repositories ship their gated endpoints, and every mutation the UI ever offers rides
an owning-repository endpoint that is itself gated — the UI adds honesty, never capability
(`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-7`):

- keiro operations ride IR-26's preview/confirm flow over the `isMutation` classifier: the
  UI always shows the preview response before offering confirmation, and renders schema-drift
  refusals as refusals.
- shibuya pause/resume (IR-4) and adapter DLQ redrive (shibuya-pgmq-adapter IR-3) appear only
  when their server-side gates are enabled; a disabled gate renders as a visibly disabled
  action with the reason, not a hidden feature.
- Anything replay-shaped follows AxonIQ's guardrail sequence: pause first, typed confirmation
  stating irreversibility, explicit reset-point choice, live progress — plus the
  blast-radius preview where positions make it computable.
- Destructive bulk operations are deferred until they can be **first-class jobs** with
  pre-flight impact estimates and progress pages (Inngest's pattern) — never a button that
  returns 200.

**Payload visibility is an axis independent of action rights**: the client packages carry
redaction/opt-in hooks at the render boundary (Temporal's codec seam and AxonIQ's dlq-mode
are the named precedents), so a deployment can grant triage access without payload plaintext.

Who may act is delegated to the deployment: the conventions' recorded auth posture is a
trusted network or an authenticating reverse proxy in front of the surfaces, and the UI adds
no authentication theater on top. If the surfaces later grow per-action authorization, Oban's
resolver pattern — one host-owned callback seam for rights, redaction, and cost caps — is the
named aspiration.


## Deployment and embedding

**Primary: one origin.** The console's static assets are served beside the composed mount
requested from keiro (IR-31): one process, one port, path prefixes per surface
(`/kiroku/…`, `/shibuya/…`, `/pgmq/…`, `/keiro/…`), the app served from the same origin — no
CORS involved at all. This is the deployment the stack's embeddable-WAI packaging
(`mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-4`) exists to make cheap.

**Secondary: separate origins.** The app is served from anywhere and pointed at the
individual per-surface origins via the connection switcher. This requires the CORS work
requested from each repository (kiroku IR-11, shibuya IR-5, pgmq-hs IR-3's day-one CORS,
keiro IR-26) with the app's origin on each allowlist.

The trade-off, stated: the primary path needs the composed mount to exist and couples the
console's serving to the application process; the secondary path works with today's
per-surface servers the moment CORS lands, but multiplies origins, allowlists, and TLS
endpoints. Both are supported; documentation leads with the primary.


## Out of scope

Restated from the MasterPlan (`docs/masterplans/1-keiro-runtime-ui-foundations.md`): choosing
the component library (IntentUI versus shadcn/ui); designing authentication or authorization
beyond recording the current gaps; implementing any endpoint (each runtime repository does
that under its own plans, driven by the filed improvement requests); and building the React
application itself — that work starts from this document under a future MasterPlan.
