---
title: Timer ledger
type: Capability
description: Page keiro's pending timers live with manager and correlation filters, and find stuck timers by age and attempt count.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-8
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
interface:
  - /timers
  - /timers?tab=stuck
evidence:
  - kind: test
    resource: apps/console/e2e/timers/timers.spec.ts
    proves: Filters round-trip, a feed update lands live, the stuck tab validates its input, and the palette opens a timer in the sheet with its payload.
  - kind: test
    resource: apps/console/src/features/timers/timers.test.tsx
    proves: Filters reach the URL and the request, a feed update changes and removes rows, an overflow re-reads the first page, and the stuck tab validates its minimum age.
---

# Timer ledger

The Timers screen pages keiro's pending-timer ledger, live on the first page through keiro's
`timers` feed, filtered by process manager and correlation. The Stuck tab polls keiro's stuck
timers with a minimum age (such as `5m` or `1h`) and a minimum attempt count. A timer opens in
the right sheet with its payload.

```text
/timers?manager=order-fulfilment
/timers?tab=stuck&min_age=1h&min_attempts=3
```

## Limits

- Only the first page is live; the Stuck tab polls rather than streams.
- Requeue and cancel are [gated operator actions](gated-operator-actions.md), not part of this
  capability.
