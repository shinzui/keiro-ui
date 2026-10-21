---
title: Queue processor monitoring
type: Capability
description: Watch shibuya processors live — state, counters, in-flight age, and latency histograms — and see whether each host allows control.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-4
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-shibuya"
interface:
  - /processors
  - "/processors/<id>"
evidence:
  - kind: test
    resource: apps/console/e2e/queues/processors.spec.ts
    proves: A stopped frame moves a processor under Terminal; in-flight age keeps counting between frames; the Control card reads disabled when control is off; unknown processors say so.
  - kind: test
    resource: apps/console/src/features/processors/processor-table.test.tsx
    proves: A failed terminal frame moves a processor under Terminal with its error, and the oldest in-flight age is extrapolated from when the metrics arrived.
  - kind: test
    resource: apps/console/src/features/processors/histogram.test.ts
    proves: Cumulative buckets become per-bucket counts, and quantiles are interpolated within the reaching bucket.
  - kind: test
    resource: packages/client-shibuya/test/feeds.test.tsx
    proves: The client's feed handles a snapshot, updates, an overflow re-read, and a failed terminal frame.
---

# Queue processor monitoring

The Processors screens read shibuya's metrics surface. Every processor's state, counters, and
oldest in-flight age update live from shibuya's WebSocket feed; a processor page adds its
latency histogram, its progress cursors, and a Control card stating whether the host has
control enabled.

```text
/processors          → processors grouped by state, live
/processors/<id>     → latency histogram, cursors, control status
```

## Limits

- Monitoring only. Pause and resume are [gated operator actions](gated-operator-actions.md).
- Live state depends on shibuya's WebSocket feed; with liveness paused the page stops
  updating.
