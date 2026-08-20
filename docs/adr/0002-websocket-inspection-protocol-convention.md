---
type: Architecture Decision Record
title: WebSocket inspection protocol convention
description: All keiro-runtime WebSocket inspection endpoints speak type-tagged JSON frames with explicit subscribe/unsubscribe, snapshot-then-delta, ping/pong, in-band errors with bounded drop-oldest queues, and replay cursors where the domain has them; shipped dialects are frozen and converge only additively.
docId: ADR-2
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# WebSocket inspection protocol convention

## Context

Two WebSocket inspection protocols already ship in the keiro runtime stack, and they differ.
shibuya-metrics (`shibuya-metrics/src/Shibuya/Metrics/Types.hs`, endpoint `/ws`) accepts
`subscribe_all`, `subscribe`, `unsubscribe`, and `ping` and answers with `snapshot`, `update`,
`pong`, and `goodbye`, pushing per-processor metric deltas every 100 ms when values change.
kiroku-metrics (`kiroku-metrics/src/Kiroku/Metrics/WebSocket.hs`, endpoint `/ws/events`)
accepts `ping`, `subscribe_metrics`, `subscribe_events` (with `from_position` and `category`),
and `unsubscribe_events`, and answers with `pong`, `snapshot`, `event`, `event_stream_started`,
`goodbye`, and `error`, delivering events through a bounded per-connection queue with
drop-oldest overflow signaled by an in-band `error` frame.

Both protocols have shipped consumers. Two more projects (pgmq-hs, keiro) will grow WebSocket
surfaces under the keiro-ui initiative. Without a convention, the composed UI needs one bespoke
client per dialect; with a breaking unification, shipped consumers break for cosmetic gain.

## Decision

The convention is the structural superset both dialects already fit, defined in
`docs/architecture/inspection-api-conventions.md` (area 5) in this repository. Every WebSocket
inspection endpoint speaks typed JSON frames carrying a required `type` tag. Clients
explicitly subscribe and unsubscribe to named things and may `ping`. Servers reply to a
subscribe with a `snapshot` before any incremental frame, then push `update` frames for state
deltas or `event` frames for append-only feeds, answer `pong`, send in-band `error` frames for
per-connection faults, and send `goodbye` before server-initiated close. Per-connection
delivery queues are bounded with drop-oldest overflow, and overflow is signaled in-band so a
client knows to re-read. Where the watched domain has replayable positions, subscribe frames
accept a `from_position` cursor. Servers ping idle connections (30-second precedent).

The two shipped dialects are frozen as published. Convergence work in shibuya or kiroku may
only ever be additive — new frame types or new optional fields, never renames, removals, or
re-typings. New surfaces choose frame names fitting their own domain but must keep the
structural shape.

## Consequences

The keiro-ui browser app can implement one WebSocket client core (frame dispatch on `type`,
subscribe lifecycle, snapshot-then-delta state handling, overflow recovery) and parameterize it
per surface with frame names, instead of four bespoke clients. Existing consumers of
shibuya-metrics and kiroku-metrics keep working unchanged forever. The cost of freezing is
permanent naming inconsistency between the two shipped dialects (`subscribe_all` versus
`subscribe_metrics`); the convention accepts this deliberately — wire stability outranks
cosmetic uniformity, consistent with the stack's frozen-relation and PVP discipline.
