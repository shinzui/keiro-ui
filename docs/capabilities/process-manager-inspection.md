---
title: Process manager inspection
type: Capability
description: Open a keiro process-manager instance by name and correlation to see its state, what it waits for, its last reaction, pending timers, and journal.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-7
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
interface:
  - /process-managers
  - "/process-managers/<name>/<correlation>"
evidence:
  - kind: test
    resource: apps/console/e2e/process-managers/process-managers.spec.ts
    proves: An instance shows its panels and links; an unknown correlation says so.
  - kind: test
    resource: apps/console/src/features/process-managers/process-managers.test.tsx
    proves: An instance renders state, waiting-for, last reaction, and journal link; provenance and truncated provenance render; the index never calls keiro and opens a typed name.
  - kind: test
    resource: apps/console/e2e/aggregates/not-mounted.spec.ts
    proves: A host without the inspection hooks gets an explicit "not mounted" state.
---

# Process manager inspection

A process-manager instance page shows its current state, what it is waiting for, its last
reaction with provenance when keiro recorded it, its pending timers, and its journal.

```text
/process-managers/order-fulfilment/<correlation-id>
```

## Limits

- keiro has no read that lists process managers. The index offers the names configured on the
  active connection profile and recently opened ones, or accepts a typed name.
- Works only on a keiro host that mounts its process-manager inspection hooks; otherwise the
  page says the inspection is not mounted.
- Provenance appears only when the host recorded it.
