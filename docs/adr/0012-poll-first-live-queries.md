---
type: Architecture Decision Record
title: Poll-first live queries
description: Every live screen reads through useSurfaceQuery, which polls at the surface's default interval stretched by an adaptive clamp and stops while the operator pauses; WebSocket feeds only write newer frames into the same cache entries, and any doubt (overflow, sequence gap, reconnect) re-reads from HTTP.
docId: ADR-12
status: Accepted
date: 2026-10-21
timestamp: 2026-10-21T23:00:00Z
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:00:00Z
---

# Poll-first live queries

## Context

[ADR-3](0003-push-is-a-hint-poll-is-truth.md) makes polling authoritative and push a latency
hint. The surfaces' feeds differ (kiroku events and metrics, pgmq queue metrics, shibuya
processors, keiro's three views), none offers replay, and keiro's mirror only the first page of
a read. Without one rule per screen, each screen would decide when to trust a frame.

## Decision

- Live reads go through `useSurfaceQuery` (one page per URL cursor) or `useCursorPages` ("load
  more"). Each polls at its surface's default (kiroku, pgmq, keiro 5 s; shibuya 2 s) unless a
  screen passes a longer interval for an expensive read, stretched after a slow fetch to
  `clamp(10 s, 10 × last fetch, 60 s)`. The shell's pause stops every poll and feed; resuming
  re-reads at once.
- A feed hook writes its frames into the very cache entry the poll owns (the list's first page,
  a queue's metrics, the processor map). An overflow, a sequence gap, or any reconnect
  invalidates that entry so the poll path re-reads. Later pages never subscribe.
- After an executed mutation the console invalidates the owning queries and re-reads; it never
  waits for a feed frame to show the new state.

## Consequences

- A screen is correct with its feed off; the feed only shortens the time to show a change.
- Screens state their freshness (an "as of" from the page's `observed_at` or the fetch time)
  and their mode ("live", "polling", "paused") from the feed hook's status.
