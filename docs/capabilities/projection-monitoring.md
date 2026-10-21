---
title: Projection and shard monitoring
type: Capability
description: See each keiro projection group's exact distance behind the store, its rebuild progress and failures, and which shard owns which bucket.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-9
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
  - "@keiro-ui/client-kiroku"
interface:
  - /projections
  - "/projections/<group>"
  - /shards
evidence:
  - kind: test
    resource: apps/console/e2e/projections/projections.spec.ts
    proves: Distances read n/a, caught up, or an exact number, and a feed update lands live.
  - kind: test
    resource: apps/console/e2e/projections/shards.spec.ts
    proves: Selecting a sharded subscription shows its bucket ownership.
  - kind: test
    resource: apps/console/src/features/projections/distance.test.ts
    proves: Distance reads unmanaged, none, caught up, behind, or ahead, exactly beyond 2^53.
  - kind: test
    resource: apps/console/src/features/projections/projections.test.tsx
    proves: The distance column, live feed updates, overflow re-reads, the group page's stated subscription limitation, and shard bucket ownership.
---

# Projection and shard monitoring

The Projections & Read Models section lists keiro's projection groups live with their exact
global position distance behind the store, rebuild progress, and failures. A group page shows
the checkpoint of the subscription that feeds it. The Shards screen shows bucket ownership for
a sharded subscription.

```text
/projections            → groups, live, with distance behind the store
/projections/<group>    → status, failures, the feeding subscription's checkpoint
/shards                 → bucket ownership per sharded subscription
```

## Limits

- keiro does not say which subscription feeds a projection group. A group page offers the
  durable subscriptions kiroku knows as choices, or a typed name, and never assumes the
  mapping. The choices were added after 0.1.0; in 0.1.0 the name is typed.
- A distance reads n/a when either position is unknown.
- Read-only: the console does not start, stop, or rebuild projections.
