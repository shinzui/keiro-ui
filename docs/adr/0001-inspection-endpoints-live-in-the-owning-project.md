---
type: Architecture Decision Record
title: Inspection endpoints live in the project that owns the concept
description: Every keiro-runtime inspection endpoint is implemented in the repository that owns the concept it exposes, per a fixed layer-ownership matrix, and keiro composes lower-layer surfaces instead of re-implementing them.
docId: ADR-1
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# Inspection endpoints live in the project that owns the concept

## Context

The keiro runtime is a composable stack: keiro (the event-sourcing framework — commands,
aggregates, projections, process managers, timers, durable workflows, outbox/inbox) builds on
kiroku (the append-only PostgreSQL event store with durable subscriptions), shibuya (supervised
queue processing), and pgmq-hs (the PostgreSQL-native work-queue client). A web UI for
operating applications built on this stack needs HTTP and WebSocket endpoints across all of
these concerns, and those endpoints could in principle all be bolted onto keiro, since keiro
sits on top and can see everything.

The stack's existing architecture already rejects that shape. Each library is usable without
keiro and may grow its own UI; shibuya's capability record CAP-10 keeps its metrics server "a
separate package rather than part of the core precisely so that adopting Shibuya does not mean
adopting a web server"; kiroku created `kiroku-metrics` so its store package never depends on a
web framework; and keiro's own ADR (`mori://shinzui/keiro/okf/adrs/concepts/ADR-28`) forbids
operator surfaces from bypassing owning-library APIs or reaching into another library's private
schema.

## Decision

Every inspection endpoint is implemented in the project that owns the concept it exposes,
according to this layer-ownership matrix:

- **pgmq-hs** owns queue-level views: queue list, depth and age metrics, non-destructive peek,
  archive browsing, message-by-id.
- **shibuya** owns processor and pipeline supervision views: processor state, throughput,
  batching, in-flight work, pause/resume. Queue-backed context for a processor (queue depth
  behind it, dead-letter-queue contents) belongs to the **shibuya adapters**, which know the
  backing queue technology.
- **kiroku** owns store-level views: streams, events, categories, the `$all` tail, durable
  subscription checkpoints, store dead letters.
- **keiro** owns framework-level views: aggregates, process managers, durable workflows,
  timers, projections and rebuilds, outbox/inbox, and job semantics layered on queues.
- **keiro** owns composition of the mounted surfaces into one process, and **keiro-ui** owns
  the browser application that consumes them.

Overlaps resolve toward the lower layer: keiro's queue screens consume pgmq-hs-owned endpoints
for queue mechanics and add only the job-level semantics (the `Job` envelope, dead-letter
redrive policy) that pgmq-hs cannot know.

## Consequences

keiro composes; it never re-implements a lower layer's endpoints, and it never queries a lower
layer's private schema to fake one. When keiro needs data a lower layer does not expose, the fix
is an improvement request against the owning project, not a keiro-side workaround. Each library
remains independently adoptable and independently inspectable — an application using shibuya
without keiro still gets shibuya's full inspection surface. The cost is coordination: the UI
depends on four repositories shipping their surfaces, which is exactly the coordination the
keiro-ui initiative's conventions document (`docs/architecture/inspection-api-conventions.md`)
and cross-repository improvement requests exist to manage.
