---
id: 19
slug: add-gated-operator-actions
title: "Add gated operator actions"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
  revisions:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T15:56:48Z
      mode: "update"
      note: "Switch workspace tooling from pnpm to bun; vitest and Playwright kept on Node 22"
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      mode: "update"
      note: "Round 2: align to owning-plan spellings, correct audited upstream facts, e2e layout, light theme where applicable"
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-10-21T22:51:21Z
      mode: "implement"
      note: "M1-M4: shibuya control, MutationFlow and timer actions, DLQ redrive, refusal matrix and suites"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Add gated operator actions

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (the React application in `apps/console` of this repository) ships
its first release read-only: an operator can see every aggregate, workflow, process manager,
timer, projection, stream, subscription, queue, and processor, but cannot change anything.
This plan adds the first, deliberately small, set of **operator actions** — things the
console can do to a running system — and it adds them in exactly the way the repository's
safety decision requires: every action rides an endpoint the owning project itself gates, the
console shows a disabled gate as a disabled control with the server's reason, every keiro
mutation is previewed before it is confirmed, and every refusal the server returns is rendered
as a refusal rather than hidden or retried.

After this plan an operator can, from the browser: pause and resume a shibuya processor from
its detail page; requeue or cancel a keiro timer from the Timers list or the timer sheet; and
redrive a pgmq dead-letter queue through keiro's job-level redrive from the queue page. Each
action is visible only when the server says it is enabled, and each keiro action walks the
operator through a preview of what the server would do, a typed confirmation, and the
executed result. A session audit sheet lists what was executed, when, and with what outcome.

You can see it working by running the console against a stack where mutations are enabled
(`keiro-ops-http --enable-mutations` and shibuya-metrics with `enableControl = True`), opening
`/processors/orders`, pressing **Pause**, confirming, and watching the processor state card
turn to `paused` with a `pausedAt` timestamp; and by running the same console against the
default stack (mutations disabled) and seeing every one of those controls rendered disabled
with the server's reason beside it.

Nothing else mutates. Workflow cancel, resurrect, and lease operations; projection rebuild and
promotion; stream soft-delete, undelete, hard-delete, and truncation; outbox and inbox
maintenance; shard relinquish; and any bulk operation are explicitly out of scope and stay
out until the parent MasterPlan's successor decides otherwise.


## Progress

- [x] Early interaction check (2026-10-21): a second keiro-ops-http 0.21.0.0 with
  `--enable-mutations` on port 9193 against the jitsurei database answered an empty-body
  `POST /timer/requeue/<unknown id>` with `outcome: preview`, `disposition: not_found`, and the
  `cli_reinvocation`; `{"confirm":"execute"}` with `outcome: executed`, `not_transitioned`, no
  `exit_code`; `{"confirm":"yes"}` with 400 `invalid_confirmation`; the default host with 403
  `mutations_disabled`. Only state-free calls were made, and the instance was stopped.
  `packages/client-keiro/test/mutations.test.ts` pins the captured bodies.
- [x] M1 (2026-10-21): `client-shibuya` `control.pause/resume` (no body, no custom headers,
  `ControlResult`, `ShibuyaControlRefusal`); the processor Control card polls `/control`, shows
  disabled Pause/Resume with "Control operations are disabled on the server (enableControl =
  False)", confirms in an alert dialog, toasts the returned state, records the action, and
  registers palette commands when enabled; a host without `/control` says so. Evidence:
  `packages/client-shibuya/test/control.test.ts`, `features/processors/control-status.test.tsx`.
- [x] M2 (2026-10-21): `features/actions/` (`MutationFlow`, `useKeiroMutationsGate`,
  `RefusalView`, the session audit and its sheet and bottom-bar slot) and timer Requeue/Cancel
  from a `/timers` row menu and the timer sheet. Evidence: `features/timers/timer-actions.test.tsx`
  (disabled gate; preview → typed confirmation → executed with a re-read and an audit entry;
  no-change disposition with no Execute; `mutation_outcome_unknown` locks Execute and re-reads;
  `inspection_busy` retry), `features/actions/refusal.test.tsx` (every code in both matrices).
- [x] M3 (2026-10-21): the Dead letters card on `/queues/<name><suffix>` with the job-level
  sentence, the derived logical queue, a limit, and keiro's redrive through `MutationFlow`; the
  profile's `deadLetterQueueSuffix` (default `_dlq`) gains a settings input. Evidence:
  `features/queues/dead-letter-redrive.test.tsx` (the request carries `queue=console_demo` and
  `limit=25`; preview `available`/`would_affect_at_most`; result `affected` and `exit_code`).
- [x] M4 (2026-10-21): scripted mutation scenarios in `packages/testing/src/mutations.ts`;
  `e2e/actions/actions.spec.ts` → 4 passed (disabled gates; requeue preview → confirm →
  executed; `not_found` never offers Execute; `schema_drift` lists the drift);
  `docs/deployment.md` "Operator actions" with the shibuya `Origin` paragraph; the scope grep
  prints nothing. Live (default jitsurei stack): the Control card reports no control surface,
  `/timers` and `/queues/console_demo_dlq` show keiro's disabled-mutations reason, and no POST
  is sent. `e2e/actions/actions.live.spec.ts` exists and was skipped (no mutation-enabled stack
  was run). `bun run test` 576 passed; Playwright all projects green; `bun run check` clean.


## Surprises & Discoveries

- keiro's dead-letter redrive acts on pgmq inside keiro's own database. On the jitsurei stack
  that database has no `pgmq` schema (the queues live in `pgmq_dev`, read by pgmq-inspect), so a
  redrive preview answers 422 `command_failed` ("schema "pgmq" does not exist"). The console
  renders it as a refusal; a deployment where keiro and the queues share a database is needed
  for redrive to act.
- The jitsurei stack's shibuya host (the shibuya-pgmq-adapter example on Hackage
  shibuya-metrics 0.10.0.x) has no `/control` route and answers 404; the Control card states
  that the host has no control surface rather than calling the gate disabled.
- The mock had no detail or metrics for the dead-letter queue (only the pinned queue was
  recorded), so `/queues/console_demo_dlq` showed "No queue with this name" in mock mode and
  hid the card. `derive.ts` now takes both bodies from the recorded `/queues` and `/metrics`
  arrays.
- React Aria modals mark the rest of the page hidden from assistive technology; tests that read
  the bottom bar or the rows behind an open sheet query hidden elements on purpose.
- The read-only release's assertions ("no action button", "Operator actions arrive…") were
  superseded here and updated to the gated behaviour.


## Decision Log

- Decision: This plan adds exactly three actions — shibuya processor pause/resume, keiro
  timer requeue/cancel, keiro pgmq dead-letter redrive — and nothing else. All other mutations
  the surfaces expose (workflow lifecycle, projection rebuild/promote, stream deletion and
  truncation, outbox/inbox maintenance, shard relinquish, `/pgmq/dlq/archive|purge`) are out
  of scope here.
  Rationale: `docs/adr/0007-read-only-first-with-owning-repository-gates.md` admits mutations
  only behind owning-repository gates and defers replay-shaped or destructive operations until
  they can be first-class jobs; the three chosen actions are reversible, single-entity, and
  already gated server-side. The parent MasterPlan's Decision Log fixes this scope.
  Date: 2026-10-21

- Decision: Every keiro mutation requires a typed confirmation (the operator retypes the
  timer id or the queue name) between the preview and the execute step; shibuya pause/resume
  uses a plain confirmation dialog because the server's own semantics are reversible and the
  endpoint has no preview step.
  Rationale: the preview-then-force discipline of keiro-ops (`docs/architecture/inspection-api-conventions.md`,
  section 8) and ADR-7's "preview is always shown before confirmation" rule; typing the target
  prevents acting on the wrong row in a long list.
  Date: 2026-10-21

- Decision: Which pgmq queues count as dead-letter queues is decided by a name suffix stored
  on the connection profile (`deadLetterQueueSuffix`, default `_dlq`), not by inspecting
  message payloads.
  Rationale: neither pgmq-inspect nor keiro-ops-http exposes a "this queue is a DLQ" fact
  (shibuya-pgmq-adapter IR-2 and IR-3 remain `proposed` upstream); the suffix is the adapter's
  documented convention and the profile is the one place deployment-specific knowledge lives.
  Date: 2026-10-21

- Decision: The console sends mutation POSTs with no custom headers and no credentials, and
  the deployment documentation requires shibuya's `corsAllowedOrigins` to list the console's
  origin whenever `enableControl` is on, even for the single-origin deployment.
  Rationale: browsers attach an `Origin` header to every POST, including same-origin ones, and
  shibuya-metrics refuses a control POST whose `Origin` is not allow-listed even when CORS is
  otherwise disabled (`mori://shinzui/shibuya`, `docs/adr/0011-gate-control-endpoints-off-by-default-and-refuse-with-a-structured-error.md`,
  artifact-level URI pending). This is a server rule the console must document, not work
  around.
  Date: 2026-10-21

- Decision: `useKeiroMutationsGate()` reads keiro's `/health` through the shell's health probe
  (the same query the bottom bar polls) rather than a second `health.get()` query, so the gate
  and the health dot never disagree and keiro's inspection budget is not spent twice.
  Date: 2026-10-21

- Decision: When keiro's gate is closed, each `/timers` row shows its action menu button
  disabled (its accessible name carries the reason) and the page states the reason once above
  the table; the sheet and the redrive card state it beside their buttons.
  Rationale: a reason under every row would drown the table; a hidden menu would hide the gate.
  Date: 2026-10-21


## Outcomes & Retrospective

Complete (2026-10-21). The console offers exactly three actions, each behind its owning
server's gate: processor pause/resume (shibuya), timer requeue/cancel and dead-letter redrive
(keiro). Closed gates are visible as disabled controls with the server's reason; keiro actions
preview before any confirmation exists and execute only after the target is typed; every
refusal renders verbatim with its code; an unknown outcome re-reads and locks Execute; executed
actions are listed per session. Verified against scripted servers in vitest and Playwright and,
for the closed-gate states, against the live stack. The mutating live spec is written and
opt-in; it has not been run here because no mutation-enabled stack was started.

Distillation proposed for the MasterPlan's completion pass, the honest-gate rendering rules as
an application of ADR-7: (1) a disabled gate is a disabled control plus the server's reason,
never a hidden one; (2) a preview renders before any confirmation control exists, and a
no-change preview never offers Execute; (3) refusal codes render verbatim, and
`mutation_outcome_unknown` forces a re-read before any retry; (4) shibuya control requires the
console's origin in `corsAllowedOrigins`, even on one origin.


## Context and Orientation

**What exists when this plan starts.** The parent MasterPlan
(`docs/masterplans/2-build-the-keiro-runtime-console.md`) requires its **read-only release
gate** to be checked before this plan begins: child plans EP-13 through EP-18 are Complete,
the production build is served behind a composing reverse proxy, a release tag `v0.1.0`
exists, and no mutation control exists anywhere in the UI. Verify this by reading the
MasterPlan's Progress section and running `git tag --list 'v0.*'` in the repository root; if
the gate is unchecked, stop and finish the read-only work first.

The repository is a bun workspace. The pieces this plan touches, by path:

- `apps/console` — the console application (`@keiro-ui/console`). File-based TanStack
  Router routes live in `apps/console/src/routes/`; the application shell owns
  `apps/console/src/shell/` (status bar, right sheet, command palette registration) and
  `apps/console/src/settings/connection-profiles.ts` (the `ConnectionProfile` type and the
  `useSurfaceBaseUrl(surface)` hook); screen code lives in `apps/console/src/features/<area>/`.
- `packages/ui` — the shadcn/ui components generated on the React Aria base
  (`@keiro-ui/ui`). Screens import primitives only from `@keiro-ui/ui/components/<name>`.
  This plan uses `alert-dialog`, `dialog`, `button`, `input`, `badge`, `alert`, `sheet`,
  `kbd`, and `sonner` (the toast component). If one is missing, add it from inside
  `packages/ui` with `bunx shadcn@latest add <name>` and commit the generated file.
- `packages/client-core` — `createHttpClient({surface, baseUrl})` with `get` and `post`,
  the `ApiError {surface, status, code, message, details}` class that normalizes the three
  error envelopes on the wire, and the TanStack Query helpers (`useSurfaceQuery`,
  `useLiveness`, query-key factories).
- `packages/client-shibuya` — the typed shibuya-metrics client from
  `docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md`. This plan adds
  its `control` namespace.
- `packages/client-keiro` — the typed keiro-ops-http client from
  `docs/plans/12-implement-the-keiro-typed-client.md`. Its `./mutations` entry point
  already implements the preview/confirm wire protocol and exposes exactly three typed
  wrappers, bound to a client by `keiroMutations(client)` — `timers.requeue(timerId)`,
  `timers.cancel(timerId)`, and `pgmq.dlqRedrive({queue, limit?})` — each returning
  `{ preview(), execute() }` with the
  result types `TimerMutationPreview`, `TimerMutationResult`, `DlqRedrivePreview`,
  `DlqRedriveResult` — plus the refusal classes; its `health` namespace reads `/health`.
  **This plan calls those wrappers; it never re-implements the protocol or builds command
  paths by hand.**
- `packages/testing` — recorded fixtures and MSW (Mock Service Worker, a library that
  intercepts `fetch` in tests and in the browser) handlers from
  `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`;
  `startMockServer()` for vitest and the browser worker for Playwright.
- `docs/deployment.md` — the deployment recipes written by
  `docs/plans/18-package-the-console-for-deployment.md`. If that plan chose a different file
  name, edit the file it actually wrote.

**What the hard dependencies provide.** `docs/plans/14-build-the-queues-and-processors-screens.md`
provides the processor detail route `/processors/$id` with a **Control card** that today
renders only the processor's state, plus the queue detail route `/queues/$name` and its
message tabs. `docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md`
provides the `/timers` list rows and the `timer` right-sheet kind
(`registerSheet("timer", ...)`). `docs/plans/17-build-the-projections-and-overview-screens.md`
provides the keiro health card on the Overview that already displays `mutations_enabled`
from `GET /health`, and the per-surface health dots in the bottom bar.
`docs/plans/18-package-the-console-for-deployment.md` provides the released read-only build
and `docs/deployment.md`.

**Terms.** A *gate* is a server-side switch that decides whether a mutating endpoint does
anything: shibuya's `enableControl` configuration field (default `False`) and keiro's
`OpsHttpConfig.mutations` policy (default `MutationsDisabled`, enabled by the
`--enable-mutations` flag of the `keiro-ops-http` executable). A *refusal* is any non-2xx
response whose body is one of the stack's error envelopes. A *preview* is keiro's dry run of a
mutation: `POST <path>` with an empty body returns what the command would do without doing
it. *Executing* is the same `POST` with the body `{"confirm":"execute"}` and nothing else.
A *dead-letter queue* (DLQ) is a pgmq queue to which the shibuya pgmq adapter moves messages
that exhausted their attempts; *redrive* moves them back to their original queue.

**The shibuya control surface, as shipped** (shibuya-metrics working tree, Unreleased
changelog; module `shibuya-metrics/src/Shibuya/Metrics/Control.hs` in the shibuya
repository). `GET /control` returns `{"enabled": <bool>, "operations": ["pause","resume"]}`
and works even when control is disabled. `POST /control/processors/<id>/pause` and
`POST /control/processors/<id>/resume` take no body. Success bodies are
`{"processor": "<id>", "state": "paused", "pausedAt": "<UTC>"}` and
`{"processor": "<id>", "state": "running"}`; repeating an operation returns the same body with
the original `pausedAt`. Refusals use shibuya's **flat** envelope
`{"error": "<text>", "code": "<snake_case>", ...context}`:

```text
403  control_disabled               {"error":"Control operations are disabled","code":"control_disabled"}
403  origin_not_allowed             the POST carried an Origin header not in corsAllowedOrigins
404  processor_not_found            context: processor
409  processor_not_controllable     context: processor
409  processor_terminal             context: processor
409  processor_draining             context: processor
405  method_not_allowed             Allow: GET or Allow: POST header
```

Pausing stops intake at the adapter source; work already in flight completes
(`mori://shinzui/shibuya`, `docs/adr/0010-pause-processors-at-the-adapter-source-and-report-pause-as-operator-intent.md`,
artifact-level URI pending). The surface is reached under the `/shibuya` prefix in every
deployment shape the MasterPlan fixes, so the console calls `/shibuya/control/...`.

**The `Origin` rule.** Browsers send an `Origin` request header on every `POST`, including
same-origin ones. shibuya-metrics checks it on control POSTs against `corsAllowedOrigins`
even when CORS is otherwise disabled and refuses with 403 `origin_not_allowed`; requests with
no `Origin` header pass. Consequence: the console cannot pause anything unless the shibuya
host lists the console's origin (in development, `http://localhost:5173` — the Vite proxy
forwards the browser's `Origin` unchanged). This plan documents that in `docs/deployment.md`
and the local-stack recipe; it does not strip or spoof headers.

**The keiro mutation protocol, as shipped** (keiro-ops-http 0.21.0.0 working tree; module
`keiro-ops-http/src/Keiro/Ops/Http/Application.hs` in the keiro repository; guide
`docs/guides/serve-keiro-ops-over-http.md`, cited as `mori://shinzui/keiro` plus that path
with the artifact-level URI pending). Routes are the `keiro-ops` command words
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-53`): reads are `GET`, mutations are `POST`.
`GET /health` returns `{"status": "ok"|"schema_drift", "schema_drift": [...], "mutations_enabled": <bool>}`.
A mutation POST with an **empty body** is a preview and returns
`{"outcome":"preview","result":<json>,"cli_reinvocation":"keiro-ops ... --json --force"}`
without changing anything; the same POST with exactly `{"confirm":"execute"}` (at most
1 KiB; larger is 413 `inspection_request_too_large`) executes and returns
`{"outcome":"executed","result":<json>,"exit_code":<int>?}`; the exit code of a mutation is
reported only in that body field (the `Keiro-Ops-Exit-Code` header exists for reads only).
Refusals use the nested envelope `{"error":{"code","message","details"?}}`:

```text
403  mutations_disabled          gate off; returned before any schema work, even on a confirmed request
403  origin_not_allowed          (arriving with keiro MasterPlan 46) a cross-origin POST whose Origin is not allow-listed
409  schema_drift                details.drift lists the differences; applies to reads too
400  invalid_confirmation        body was neither empty nor exactly {"confirm":"execute"}
415  unsupported_media_type      (arriving with keiro MasterPlan 46) confirmation body is not JSON
413  inspection_request_too_large confirmation body over 1 KiB
422  command_failed              the command ran and failed (a store error); NOT how an unknown or ineligible timer answers
504  mutation_outcome_unknown    the deadline passed; the outcome is not known — re-read before retrying
503  inspection_busy             admission refused; retry later
```

The two timer mutations are `POST /timer/requeue/{TIMER_ID}` and `POST /timer/cancel/{TIMER_ID}`
(`keiro-ops/src/Keiro/Ops/Timer.hs`). An unknown or ineligible timer is **not a refusal**:
the preview answers 200 with
`result: {preview: true, operation, disposition: "not_found" | "not_firing" | "already_terminal" | "would_requeue" | "would_cancel", timer: <item> | null}`,
and the execution answers
`result: {operation, outcome: "transitioned" | "not_transitioned", transitioned: <bool>, timer}`.
The console renders the `disposition` and `outcome` as the headline of the preview and
result views. The dead-letter redrive is `POST /pgmq/dlq/redrive?queue=<logical>&limit=<n>`
(`keiro-ops/src/Keiro/Ops/Pgmq.hs`); `queue` is the **logical job queue name** — keiro
derives the dead-letter queue (`<queue>_dlq`, with its own sanitizing and hashing of long
names) and rejects a name that already ends in `_dlq` — and `limit` is the number of
messages moved per execution (server default 100). Its preview result is
`{preview: true, operation, queue, available, would_affect_at_most}` and its executed
result `{operation, queue, affected}`. It is keiro's **job-level** redrive — it understands
keiro's `Job` envelope and re-enqueues to the original queue — and is distinct from the
adapter-level redrive requested in shibuya-pgmq-adapter IR-3, which does not exist. Under the
composed prefix these are `/keiro/timer/...` and `/keiro/pgmq/dlq/redrive`. keiro's
reporting vocabulary (`mori://shinzui/keiro/okf/adrs/concepts/ADR-28`) applies to any
position the result JSON shows: `store_position`, `visible_store_head`, "global position
distance", never "lag".

**Decisions this plan applies.** Locally: `docs/adr/0007-read-only-first-with-owning-repository-gates.md`
— every rule in it governs this plan: mutations ride owning-repository gates only; a disabled
gate renders as a visibly disabled action with the reason; the preview is always shown before
confirmation is offered; refusals render as refusals; nothing bulk; payload visibility stays
an axis separate from action rights (the redaction hooks the client packages carry at the
render boundary are respected by the preview and result views). `docs/adr/0003-push-is-a-hint-poll-is-truth.md`
— after an executed mutation the console invalidates the owning queries and re-reads; it
never assumes a feed frame will carry the new state. `docs/adr/0005-no-backend-for-frontend.md`
— the console calls the surfaces directly; there is no action proxy. Cross-repository:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40`, condition 3 (mutations preview, then confirm;
disabled by default; schema drift refused unless the host allows it) is the server-side
contract this plan renders. `docs/architecture/inspection-api-conventions.md` section 8
records the authentication posture (trusted network or an authenticating reverse proxy; the
console adds none) and names keiro-ops's preview-then-`--force` model as the precedent for
every mutation over HTTP.


## Plan of Work

### Milestone 1 — shibuya control client and processor pause/resume

Scope: the shibuya client learns the control endpoints, and the processor detail page can
pause and resume a processor when the server allows it, and shows clearly why not when it
does not.

In `packages/client-shibuya/src/control.ts` add a `control` namespace to the client created
by `createShibuyaClient`: `status()` performs `GET /control` and returns
`{enabled: boolean, operations: string[]}` validated by a zod schema (if
`docs/plans/11-...` already exposed this read under another name, reuse it and export the
alias); `pause(processorId)` and `resume(processorId)` perform the two POSTs with no body
through `createHttpClient`'s `post`, validate the success body, and let `ApiError`
propagate. Export a `ShibuyaControlRefusal` type union listing the codes in the refusal
matrix so the UI can switch on `error.code` without string literals scattered around. Add
the query key `['shibuya', 'control']` to the key factory and a `useControlStatus()` hook
that polls at the surface's normal interval, so a gate flipped on the server appears in the
UI without a reload.

In `apps/console/src/features/processors/control-card.tsx` (extending the Control card EP-14
rendered) add the controls. When `status.enabled` is `false`, render both buttons disabled
and the sentence "Control operations are disabled on the server (enableControl = False)"
beside them; never hide them. When `true`, render **Pause** for processors whose state is
`idle` or `processing` and **Resume** for `paused`; for `failed` and `stopped` render both
disabled with "this processor is terminal". Clicking opens an `alert-dialog` from
`@keiro-ui/ui` that states what pause means in one sentence ("Intake stops at the adapter
source; messages already in flight finish processing.") and names the processor id; the
confirm button calls `control.pause` through a TanStack `useMutation`. On success show a
sonner toast with the returned `state` and `pausedAt`, and invalidate the processor queries
(`['shibuya','metrics',id]` and the list) so the state card updates from the authoritative
read. On `ApiError`, render the refusal inline in the card: the server's `error` text
verbatim, the `code` in a `badge`, and the `processor` context when present. Map
`origin_not_allowed` to an extra line pointing at `docs/deployment.md` ("the shibuya host
must list this console's origin in corsAllowedOrigins"); map `control_disabled` to the same
disabled rendering as the status gate. Register a command palette entry
("Pause processor …" / "Resume processor …") only when the gate is enabled, via
`useRegisterCommands` from `apps/console/src/shell/commands.ts`.

At the end of this milestone, against a stack with `enableControl = True` and the console
origin allow-listed, an operator pauses `orders` from `/processors/orders`, sees the toast
and the state card turn `paused`, resumes it, and sees `processing` again; against the
default stack both buttons are disabled with the reason.

### Milestone 2 — `MutationFlow` and timer requeue/cancel

Scope: one shared component implements keiro's preview → typed confirmation → execute →
result sequence, and the timer actions use it.

Create `apps/console/src/features/actions/mutation-flow.tsx`. Its props are the action's
title, a human description, the target label the operator must retype (for example the
timer id), the two functions to call (`preview: () => Promise<PreviewResult>` and
`execute: () => Promise<ExecuteResult>`, both taken from one of the keiro client's typed
wrappers from `keiroMutations(client)` — `timers.requeue(id)`, `timers.cancel(id)`,
`pgmq.dlqRedrive({queue, limit})` —
never built from command words by hand), a `summarize(result)` function that turns the
preview result into a one-line headline and says whether executing would change anything,
the query keys to invalidate afterwards, and an optional `renderResult`. It renders as a
`dialog` with three states. **Preview**: on open it calls `preview()` immediately and shows a
spinner, then the headline from `summarize` (for a timer, the `disposition`: "would
requeue", "would cancel", or the no-change cases "not found", "not firing", "already
terminal"; for a redrive, "N messages available, at most M would move"), the returned
`result` as formatted JSON (`JsonViewer` from `apps/console/src/components/JsonViewer.tsx`,
the Streams plan's shared component) and the `cli_reinvocation` string in a copyable code
block labelled "equivalent CLI command"; the confirm step is not offered until the preview
has rendered, and when `summarize` reports that nothing would change the **Execute** path
stays disabled with that reason. **Confirm**: an `input` with the instruction "Type
`<target>` to confirm" and an **Execute** button enabled only when the typed value equals
the target exactly. **Result**: the headline from the executed result (a timer's `outcome`
and `transitioned`; a redrive's `affected`), the `result` JSON, the `exit_code` when
present, a success toast, and automatic invalidation of the given keys (ADR-3: re-read, do
not trust a feed). A **Close** button is available in every state.

Refusals in any state render inside the dialog, never as a bare toast: `mutations_disabled`
→ "Mutations are disabled on this keiro host (start keiro-ops-http with --enable-mutations)"
with the dialog's actions disabled; `schema_drift` → the message plus a list of
`details.drift` entries; `invalid_confirmation` → the message (this indicates a client bug
and is logged to the console too); `command_failed` → the server message verbatim with the
`code` badge; `mutation_outcome_unknown` → "The outcome is unknown. The timer/queue is being
re-read; check its state before retrying." followed by an automatic invalidation of the
owning queries and the **Execute** button disabled until the dialog is reopened;
`inspection_busy` → the message with a **Retry preview** button; `origin_not_allowed` →
the message plus a pointer to `docs/deployment.md` (the keiro host must allow-list this
console's origin, or the proxy must preserve `Host`); `unsupported_media_type` and
`inspection_request_too_large` → the message (both indicate a client bug and are logged).
Any other `ApiError` renders its `message` and `code`.

Gate rendering is shared by every keiro action: a `useKeiroMutationsGate()` hook in
`apps/console/src/features/actions/gate.ts` reads `health.get()`'s `mutations_enabled`
through the existing health query (EP-17 already polls it) and returns `{enabled, reason}`.
Every action button is rendered disabled with the reason when `enabled` is `false`; the
reason text is the sentence above. When `/health` itself reports `schema_drift`, the reason
is "keiro refuses mutations while the live schema drifts from the binary" and the drift list
is shown on hover.

Wire the timer actions in `apps/console/src/features/timers/timer-actions.tsx`: a row action
menu on `/timers` (from `@keiro-ui/ui/components/dropdown-menu`) and buttons in the `timer`
right sheet, each opening `MutationFlow` with `preview`/`execute` bound to
`keiroMutations(client).timers.requeue(timerId)` or `.timers.cancel(timerId)` from
`@keiro-ui/client-keiro/mutations`, target label the `timer_id`, invalidating
`keiroKeys.timers.pending()` and the process-manager detail keys. The sheet's header states
the timer's `status`, `fire_at`, and `attempts`, so the operator sees the state they are
acting on, and the preview's `disposition` is the first thing the dialog shows.

### Milestone 3 — dead-letter redrive from the queue page

Scope: a queue page for a dead-letter queue offers keiro's redrive through the same flow.

`ConnectionProfile` in `apps/console/src/settings/connection-profiles.ts` already declares
the optional `deadLetterQueueSuffix?: string` (EP-8); this plan gives it the default
`"_dlq"`, an input on the connection settings page, and a read-side helper that fills the
default when a stored profile lacks the field. In
`apps/console/src/features/queues/dead-letter-redrive.tsx` render, on `/queues/$name` when
the name ends with the suffix, a card titled "Dead letters" with the sentence "Redrive moves
these messages back to their original queue using keiro's job-level redrive
(`/keiro/pgmq/dlq/redrive`). Adapter-level redrive is not available on this stack.", the
derived logical queue name ("original queue: `<name without the suffix>`, derived from the
suffix in the connection profile; keiro sanitizes and hashes long queue names, so a
derived name can be wrong for such queues — the preview shows the queue keiro will act
on"), a `limit` field (default 100, the number of messages one execution moves), and a
**Redrive** button gated by `useKeiroMutationsGate()`. The button opens `MutationFlow`
bound to `keiroMutations(client).pgmq.dlqRedrive({queue: logicalName, limit})` from
`@keiro-ui/client-keiro/mutations` — the **logical** name, never the `_dlq` name, because
keiro derives the dead-letter queue itself — with the target label the dead-letter queue
name the operator is looking at, invalidating the pgmq queue metrics, message page, and
archive keys for both this queue and the logical queue. The preview headline reads from
`available` and `would_affect_at_most`; the result headline from `affected`. The queue's
message tab already renders the adapter-written reason fields (`dead_letter_reason_code`,
`dead_letter_reason_detail`, `read_count`) when present; show the count of messages
(`queue_length`) in the card so the preview's `available` can be compared with what the
operator sees.

### Milestone 4 — refusal matrix tests, deployment paragraph, session audit, ADR note

Scope: prove every branch, document the operational requirement, and leave the session
record.

Add scripted MSW sequences in `packages/testing/src/scenarios/mutations.ts`: for shibuya,
`control` enabled and disabled, each refusal code, and the pause → paused → resume → running
happy path; for keiro, `health` with mutations on/off and with drift, and for each of the
three mutation paths the preview response, the executed response, and each refusal code
from the matrix. Write vitest tests beside the components
(`apps/console/src/features/actions/mutation-flow.test.tsx`,
`apps/console/src/features/processors/control-card.test.tsx`,
`apps/console/src/features/timers/timer-actions.test.tsx`,
`apps/console/src/features/queues/dead-letter-redrive.test.tsx`) and for the client
(`packages/client-shibuya/src/control.test.ts`) asserting the rendered text for every
branch, including every timer `disposition` (the three no-change dispositions must leave
**Execute** disabled with the reason) and both `outcome` values. Write
`apps/console/e2e/actions/actions.spec.ts` for Playwright against MSW: the disabled-gate
rendering on `/processors/orders` and `/timers`; preview → typed confirm → executed on a
timer whose preview disposition is `would_requeue`; a `not_found` preview that never offers
Execute; a `schema_drift` refusal rendered with its drift list. Add an opt-in live test
file `apps/console/e2e/actions/actions.live.spec.ts`, skipped unless
`KEIRO_UI_LIVE_MUTATIONS=1`, that pauses and resumes a processor and requeues a timer against
a scratch database; its header comment and the `justfile` recipe that runs it both warn that
it mutates the target stack and must never point at production.

Build the session audit: `apps/console/src/features/actions/session-audit.ts` keeps an
in-memory list (surface, action, target, outcome, `exit_code`, timestamp) appended by
`MutationFlow` and the shibuya control card; `session-audit-sheet.tsx` registers the
`actions` sheet kind and the bottom bar gets a slot showing "N actions this session" that
opens it. The list is client-side only and clears on reload; say so in the sheet.

Update `docs/deployment.md`: add a paragraph under the shibuya surface's recipe stating that
whenever `enableControl` is on, `corsAllowedOrigins` must include the console's origin (for
the single-origin deployment, that origin itself; for separate origins, the console's
origin), because browsers send `Origin` on same-origin POSTs and shibuya refuses control
POSTs whose origin is not listed. Add the same note to the local-stack recipe in
`docs/plans/9-...`'s `justfile` recipe comments if the stack script sets shibuya options
(a one-line comment is enough; do not restructure that plan).

Finally, in this plan's Outcomes & Retrospective, write the distillation note proposing the
"honest-gate rendering rules" ADR the MasterPlan lists as a candidate: the three rules this
plan proved (disabled gate = disabled control plus server reason; keiro preview rendered
before any confirm control exists; refusal codes rendered verbatim, with
`mutation_outcome_unknown` forcing a re-read) and the `Origin` requirement, so the
MasterPlan's completion pass can promote them into `docs/adr/`.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated otherwise.

Confirm the gate, then install and check the workspace:

```bash
git tag --list 'v0.*'
grep -n "Read-only release gate" docs/masterplans/2-build-the-keiro-runtime-console.md
bun install
bun run check
```

Expected: a `v0.1.0` tag is listed, the gate line reads `- [x] Read-only release gate`, and
`bun run check` ends with no errors.

Add any missing primitives inside the UI package (run only for components not already in
`packages/ui/src/components/`):

```bash
cd packages/ui
bunx shadcn@latest add alert-dialog dropdown-menu sonner kbd
cd ../..
```

Milestone 1, client and card:

```bash
bun run --filter @keiro-ui/client-shibuya test
bun run --filter @keiro-ui/console test -- control-card
```

Milestone 2 and 3, flow and actions:

```bash
bun run --filter @keiro-ui/console test -- mutation-flow timer-actions dead-letter-redrive
```

Milestone 4, end to end:

```bash
bun run test
bun run test:e2e -- e2e/actions
```

Expected tail of the Playwright run:

```text
  ✓ actions › disabled gates render disabled controls with the server reason
  ✓ actions › timer requeue: preview (would_requeue), typed confirmation, executed (transitioned)
  ✓ actions › timer requeue: a not_found preview never offers Execute
  ✓ actions › schema drift refusal lists the drift
  4 passed
```

Optional live verification (mutates the target stack; use a scratch database only). In the
keiro checkout, start a mutation-enabled host against a scratch database and, in the
shibuya-pgmq-adapter checkout, a consumer whose metrics server has
`enableControl = True` and `corsAllowedOrigins = ["http://localhost:5173"]`, both on the
ports the MasterPlan fixes (keiro 9093, shibuya 9090); then:

```bash
KEIRO_UI_LIVE_MUTATIONS=1 bun run test:e2e -- e2e/actions/actions.live.spec.ts
```

Expected: the live spec pauses and resumes `orders` and requeues one pending timer, and each
step's assertion reads the authoritative state back over HTTP before passing.


## Validation and Acceptance

Required acceptance, all observable in the browser or in test output:

1. With the shibuya host's `enableControl = False` (the default), `/processors/<id>` shows
   **Pause** and **Resume** disabled with the sentence "Control operations are disabled on
   the server (enableControl = False)". With it `True` and the console origin allow-listed,
   pausing shows a confirmation dialog, then a toast containing `paused` and a timestamp,
   and the state card reads `paused` after the next poll. A host that does not allow-list the
   origin returns `origin_not_allowed`, which renders verbatim with the deployment pointer.
2. With keiro's mutations disabled, every timer action and the redrive button render
   disabled with "Mutations are disabled on this keiro host (start keiro-ops-http with
   --enable-mutations)". With mutations enabled, opening **Requeue** on a timer immediately
   shows the preview's `disposition` as the headline, the preview JSON, and the
   `cli_reinvocation` string; no **Execute** control exists until then; for `not_found`,
   `not_firing`, or `already_terminal` the dialog says nothing would change and never
   enables **Execute**; otherwise **Execute** stays disabled until the operator types the
   exact timer id; after executing, the `outcome` headline, the result JSON, and
   `exit_code` (when present) are shown, the `/timers` row reflects the new `status` after
   invalidation, and the session audit count increments.
3. Each refusal in both matrices renders its server message verbatim with its code; a
   `schema_drift` refusal lists each `details.drift` entry; a `mutation_outcome_unknown`
   refusal triggers an automatic re-read and disables **Execute** until the dialog is
   reopened.
4. On `/queues/<name>_dlq`, the Dead letters card states that redrive is keiro's job-level
   operation and that adapter-level redrive is unavailable, names the derived logical
   queue `<name>`, and offers a `limit` field; **Redrive** follows the same preview → typed
   confirmation → result sequence, the request carries `queue=<name>` (the logical name,
   asserted in the MSW test) and the chosen `limit`, the preview headline shows `available`
   and `would_affect_at_most`, the result headline shows `affected`, and the queue's
   `queue_length` is re-read afterwards. On a queue whose name does not end with the
   profile's suffix the card is absent.
5. `bun run test` and `bun run test:e2e -- actions.spec.ts` pass; `bun run check` is clean.
6. `docs/deployment.md` contains the `Origin` paragraph for shibuya control.
7. A grep proves the scope boundary: no call site outside this plan's three actions invokes
   `mutations.preview` or `mutations.execute`, and no UI calls `/pgmq/dlq/archive`,
   `/pgmq/dlq/purge`, `/rebuild`, `/stream/soft-delete`, or any workflow mutation:

```bash
grep -rn "mutations\.\(preview\|execute\)" apps/console/src | grep -v features/actions | grep -v features/timers | grep -v features/queues
```

Expected: no output.

Early interaction check: before building M2's dialog states, prove the protocol end to end
once with a single `curl` pair against a mutation-enabled keiro host (empty body → outcome
`preview` with a timer `disposition`; `{"confirm":"execute"}` → outcome `executed` with
`transitioned`) and against the default host (403 `mutations_disabled`), and confirm the
keiro client's typed wrappers produce the same outcomes in a vitest contract test against
those recorded responses. Do
this before writing any UI for refusals, because the whole plan's rendering depends on the
client surfacing the typed refusals the MasterPlan's "keiro client specifics" promise.

Proposed, not required: a keyboard shortcut for the session audit sheet; showing the
`cli_reinvocation` string in the audit list.


## Idempotence and Recovery

Every step is safe to repeat. Re-running `bunx shadcn@latest add` for a component that
already exists prompts before overwriting; answer no. Tests and the MSW scenarios are pure.
The only non-idempotent operations are the live mutations themselves: keiro's preview is a
dry run and can be repeated freely; `execute` changes state, and a `mutation_outcome_unknown`
response means the state must be re-read (the flow does this automatically) before the
operator decides whether to retry. shibuya's pause and resume are idempotent on the server
(repeating returns the same body). The live Playwright spec restores what it changes (resume
after pause) and targets a scratch database by construction; if it is interrupted midway,
resume the processor by hand with
`curl -X POST http://127.0.0.1:9090/control/processors/orders/resume`.

If the typed-confirmation input is found to block legitimate targets (for example a timer id
containing characters the input normalizes), relax the comparison to a trimmed exact match,
record the change in the Decision Log, and keep the requirement that the operator types the
target.


## Interfaces and Dependencies

Libraries whose choice matters: `react-aria-components` (only through `@keiro-ui/ui`),
`@tanstack/react-query` (`useMutation`, `invalidateQueries`), `zod` 4 for the control and
mutation response schemas, `sonner` for toasts, `msw` for scripted refusals,
`@playwright/test` for the end-to-end suites.

Interfaces this plan defines, by full path:

- `packages/client-shibuya/src/control.ts` — `control.status(): Promise<ControlStatus>`,
  `control.pause(id: string): Promise<ControlResult>`, `control.resume(id: string): Promise<ControlResult>`,
  `type ShibuyaControlRefusal = "control_disabled" | "origin_not_allowed" | "processor_not_found" | "processor_not_controllable" | "processor_terminal" | "processor_draining" | "method_not_allowed"`.
- `apps/console/src/features/actions/mutation-flow.tsx` — `MutationFlow` props:
  `{title, description, target, preview, execute, invalidate: QueryKey[], renderResult?, onExecuted?}`.
- `apps/console/src/features/actions/gate.ts` — `useKeiroMutationsGate(): {enabled: boolean, reason?: string, drift?: string[]}`.
- `apps/console/src/features/actions/session-audit.ts` — `recordAction(entry)`,
  `useSessionAudit(): AuditEntry[]`; `session-audit-sheet.tsx` registers sheet kind
  `actions`.
- `apps/console/src/settings/connection-profiles.ts` — the default `"_dlq"` and settings
  input for the optional `deadLetterQueueSuffix` field EP-8 declared.

Interfaces this plan consumes and must not redefine: `packages/client-keiro`'s
`keiroMutations(client)` and its typed wrappers `timers.requeue`, `timers.cancel`,
`pgmq.dlqRedrive` with their result types and
refusal classes (from `@keiro-ui/client-keiro/mutations`), and `health.get()`;
`packages/client-core`'s `ApiError` and
`createHttpClient`; the shell's `registerSheet`, `useRightSheet`, `useRegisterCommands`,
and the status-bar slot API from `apps/console/src/shell/`; the timer sheet kind and
`/timers` rows from EP-16; the processor Control card and queue page from EP-14; the keiro
health card from EP-17.

Prerequisites declared by the parent: child plans EP-14, EP-16, EP-17, and EP-18 Complete,
and the MasterPlan's "Read-only release gate" checked.
