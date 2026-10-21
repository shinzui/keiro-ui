---
title: Aggregate inspection
type: Capability
description: Browse the aggregate kinds a keiro host registers and open an instance as its raw events beside the state keiro folded from them.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-6
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
  - "@keiro-ui/client-kiroku"
interface:
  - /aggregates
  - "/aggregates/<type>/<id>"
evidence:
  - kind: test
    resource: apps/console/e2e/aggregates/aggregates.spec.ts
    proves: Kind → instance → browser with both panes, and the pane split survives reload.
  - kind: test
    resource: apps/console/e2e/aggregates/not-mounted.spec.ts
    proves: A host without keiro's inspection hooks gets an explicit "not mounted" state, not an error.
  - kind: test
    resource: apps/console/src/features/aggregates/aggregates.test.tsx
    proves: Kinds link to their instances; a host without the hooks shows the not-mounted state without retrying; snapshot hydration and an incompatible stored snapshot render.
  - kind: test
    resource: packages/client-keiro/test/hook-gated.test.ts
    proves: A host without the hooks answers 400 invalid_request, which the client surfaces as an unavailable route rather than a failure.
---

# Aggregate inspection

The Aggregates section lists the aggregate kinds the keiro host registers and pages their
instances. An instance opens as a split view: the raw events from kiroku on one side, and on
the other the state keiro folded from them, how it was hydrated, and the snapshot's health.

```text
/aggregates                 → registered kinds
/aggregates/order/42        → events beside folded state
```

## Limits

- Works only on a keiro host that mounts its aggregate inspection hooks. Many hosts do not
  (the mori dev profile is one); the page then names the probed path and says the inspection
  is not mounted.
- The recorded fixtures come from keiro's jitsurei demo host, the local stack's default
  profile.
