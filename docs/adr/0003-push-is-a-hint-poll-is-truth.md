---
type: Architecture Decision Record
title: Push is a hint; poll is truth
description: Every live inspection endpoint in the keiro runtime stack is backed by an authoritative poll/read path, with NOTIFY-driven push used only to shorten latency, never as the source of truth.
docId: ADR-3
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# Push is a hint; poll is truth

## Context

The keiro runtime stack uses PostgreSQL NOTIFY/LISTEN as its live-update substrate in three
places: kiroku's `kiroku.notify_events()` trigger fires on channel `<schema>.events` and is
consumed over a dedicated LISTEN connection with reconnect and backoff (documented in kiroku's
`docs/architecture/notifier.md`); keiro's `Keiro.Wake` consumes that same mechanism to wake
subscriptions; and pgmq's `enable_notify_insert` sends throttled notifications on queue inserts
(documented in pgmq-hs's `docs/design/015-notification-delivery-contract.md`).

NOTIFY is best-effort by design. A listener that is disconnected — even briefly, during a
reconnect — misses notifications permanently; there is no queueing and no replay. Throttling
deliberately suppresses notifications under load. Payloads are wake-up hints, not data
carriers. Each project documents this independently today, but a web UI composes all of their
live surfaces at once, and a UI that treats any push stream as complete will silently show
stale or gapped data.

## Decision

Across all four projects' inspection surfaces (kiroku, pgmq-hs, shibuya, keiro) and the
keiro-ui browser app: every live endpoint must be backed by an authoritative poll/read path,
and push is used only to shorten the latency of discovering that the authoritative read would
return something new. A WebSocket feed or NOTIFY subscription is never itself the source of
truth.

Concretely: a server that loses its LISTEN connection falls back to polling and reconciles from
the read path when the connection returns; a client that misses frames (bounded-queue
overflow, reconnect) recovers by re-reading from the poll path or re-subscribing from a replay
cursor, never by assuming the stream was complete; and no endpoint may exist in push-only form
— if it can be watched, it can be read.

The rule is stated for implementers in `docs/architecture/inspection-api-conventions.md`
(area 6) in this repository.

## Consequences

Every improvement request for a live endpoint filed under the keiro-ui initiative must specify
both halves: the authoritative read and the push hint over it. The UI's data layer can be built
on a uniform reconcile loop (read, then apply pushes, then re-read on any doubt), which is
simpler and more robust than per-surface trust decisions. The cost is that no surface can skip
building the read path even when push "seems enough" in testing — a deliberate cost, because
missed notifications are invisible in development and routine in production.
