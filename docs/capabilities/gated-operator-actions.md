---
title: Gated operator actions
type: Capability
description: Pause and resume a processor, requeue or cancel a timer, and redrive a dead-letter queue, each only when the owning server's gate is open, with previews, typed confirmation, and a session audit.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-11
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: unreleased
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
  - "@keiro-ui/client-shibuya"
interface:
  - Control card on /processors/<id>
  - timer sheet actions on /timers
  - dead-letter redrive on /queues/<name>
  - session audit sheet
requires:
  - CAP-3
  - CAP-4
  - CAP-8
evidence:
  - kind: test
    resource: apps/console/e2e/actions/actions.spec.ts
    proves: Closed gates render disabled controls with the server's reason; a timer requeue goes preview → typed confirmation → executed; a not_found preview never offers Execute; a schema-drift refusal lists the drift.
  - kind: test
    resource: apps/console/e2e/actions/actions.live.spec.ts
    proves: Against a mutation-enabled local stack, pause and resume a processor and requeue a timer, reading the result back.
  - kind: test
    resource: packages/client-keiro/test/mutations.test.ts
    proves: The client decodes preview, executed, and refusal responses captured from keiro-ops-http.
  - kind: test
    resource: packages/client-shibuya/test/control.test.ts
    proves: The client pauses and resumes through shibuya's control surface and decodes its refusals.
  - kind: test
    resource: apps/console/src/features/queues/dead-letter-redrive.test.tsx
    proves: A dead-letter queue offers keiro's redrive under its logical name; other queues have none; a closed gate disables it.
  - kind: test
    resource: apps/console/src/features/actions/refusal.test.tsx
    proves: Every refusal renders its code and the server's message verbatim, with the drift list and the unknown-outcome advice to re-read.
---

# Gated operator actions

The console's only writes. Each rides its server's own gate and is off by default: processor
pause and resume use shibuya's `enableControl`; timer requeue and cancel and dead-letter redrive
use keiro-ops-http's `--enable-mutations`. They extend [queue inspection](queue-inspection.md),
[processor monitoring](processor-monitoring.md), and the [timer ledger](timer-ledger.md) with a
control on the page that already shows the target.

A closed gate shows the control disabled with the server's reason. Every keiro action asks
keiro for a preview first and executes only after the operator types the target (a timer id or
a queue name). Refusals render as the server sent them; an unknown outcome forces a re-read.
Executed actions are listed in the session audit ("N actions this session" in the bottom bar).

## Limits

- Unreleased: on the default branch for 0.2.0, in no release yet.
- The session audit lives in the browser tab only; it is not a durable audit trail.
- The live run covers pause, resume, and requeue. Timer cancel and dead-letter redrive are
  proven only against responses captured from keiro-ops-http, not against a live host.
- The live mutation smoke (`just smoke-live-mutations`) changes the target stack and is meant
  only for scratch, mutation-enabled stacks.
- shibuya refuses a control `POST` whose `Origin` is not in `corsAllowedOrigins`, even on one
  origin; the host must list the console's origin whenever control is enabled.
