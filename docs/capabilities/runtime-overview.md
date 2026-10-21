---
title: Runtime overview and surface health
type: Capability
description: One page that summarises a running keiro system across its four inspection surfaces and shows whether each surface answers.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-1
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
interface:
  - "/ (Overview)"
  - bottom-bar health dots and liveness toggle
evidence:
  - kind: test
    resource: apps/console/e2e/overview/overview.spec.ts
    proves: Each card shows its headline and opens its section by mouse and keyboard; pausing liveness stops polling and resuming refetches at once.
  - kind: test
    resource: apps/console/src/features/overview/overview.test.tsx
    proves: Every card shows its headline from the recorded fixtures and links to its section; a host without the hooks makes the aggregates card say so.
  - kind: test
    resource: apps/console/src/shell/health.test.ts
    proves: keiro ok is up, drift and busy are degraded, unavailable is down; a network failure is down.
  - kind: test
    resource: apps/console/e2e/shell/connections.spec.ts
    proves: The four health dots probe the active connection profile's URLs.
---

# Runtime overview and surface health

The Overview is the console's landing page. It shows one card per concern: queue latency,
workflow status counts, projection freshness as global position distance, processor readiness,
the store's position, aggregates, and timers. Each card opens its section. The bottom bar
carries one health dot per surface and a liveness toggle that pauses polling; the Overview
also shows keiro's health with its mutation gate.

```text
open /          → cards; click or keyboard into a section
bottom bar      → a health dot per surface; pause/resume liveness
```

## Limits

- A card's trend compares samples kept in memory while the card is mounted; there is no
  history across reloads.
- Health is a probe at a moment. keiro answers 503 `inspection_busy` when its inspection slots
  are all in use, which the console shows as "busy" until the next probe.
- Cards that depend on keiro's inspection hooks show the host's honest "not mounted" state on
  hosts that lack them.
- Proven against recorded fixtures; the live-stack run (`apps/console/e2e/live.spec.ts`) only
  runs with `KEIRO_UI_LIVE=1` and a running local stack.
