---
title: Process manager inspection
type: Capability
description: List a keiro host's mounted process managers and open an instance to see its state, what it waits for, its last reaction, pending timers, and journal.
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
    proves: An instance renders state, waiting-for, last reaction, and journal link; provenance and truncated provenance render; the index lists the catalog, says unknown for unknown timers, and falls back to a typed name on a host that refuses it.
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

- The index lists mounted managers from `GET /pm/types`, added in keiro 0.22. A host that refuses that
  read offers the names configured on the active connection profile and recently opened ones, or
  accepts a typed name. A host with no hooks and an older host refuse it identically, so the index does
  not say which this is; opening a manager by name does.
- `timers_configured` can be unknown, shown as `unknown`. It describes configuration, not pending timers.
- `snapshots_configured` means a state codec exists, not that a snapshot is stored.
- Instances work only on a keiro host that mounts its process-manager inspection hooks; otherwise the
  page says the inspection is not mounted.
- Provenance appears only when the host recorded it.
