---
title: Event store browsing
type: Capability
reviews:
  - kind: model
    reviewer: codex-cli/gpt-6.1-sol
    reviewed_at: 2026-11-05T22:16:00Z
    document_timestamp: 2026-11-05T22:10:00Z
    scope: catalog-metadata
    outcome: commented
    context: Checked unique CAP handles, owning provider, workspace package names and evidence resource paths; this is not an independent behavioral review.
    provider: openai
    model: gpt-6.1-sol
    effort: high
timestamp: 2026-11-05T22:10:00Z
description: Browse kiroku's streams, categories, global log, events, and subscriptions, with a live tail of new events and subscription checkpoints and dead letters.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-2
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-kiroku"
  - "@keiro-ui/client-keiro"
interface:
  - /streams
  - /categories
  - /events
  - /subscriptions
evidence:
  - kind: test
    resource: apps/console/src/features/streams/category-consumers.test.tsx
    proves: Declared consumers preserve coverage, every binding, independent paging, cursor recovery and unavailable or failed reads while events remain usable.
  - kind: test
    resource: apps/console/e2e/streams/streams.spec.ts
    proves: Streams page by cursor and filter by category; a stream's events open in a sheet that survives reload; categories list their events.
  - kind: test
    resource: apps/console/e2e/streams/events.spec.ts
    proves: The global log shows the newest events and follows the store live; an overflow shows the server's message and recovers the dropped events; causation links resolve.
  - kind: test
    resource: apps/console/e2e/streams/subscriptions.spec.ts
    proves: Subscriptions show checkpoints with distance to the store head, and dead letters page by cursor and link to their events.
  - kind: test
    resource: packages/client-kiroku/test/client.test.ts
    proves: The typed client reads streams, events, categories, subscriptions, and dead letters, keeping 64-bit fields exact.
  - kind: test
    resource: packages/client-kiroku/test/feeds.test.tsx
    proves: The event tail recovers events dropped by an overflow, a category tail holds only that category, and a new metrics snapshot replaces the previous one.
---

# Event store browsing

The Streams & Subscriptions section reads kiroku's inspection surface. An operator can page
streams and categories, read the `$all` log with a live tail, open any event (payload,
metadata, causation and correlation), and see each subscription's checkpoint, its distance to
the store head, and its dead letters.

```text
/streams?category=order     → streams in a category, paged by cursor
/events                     → the $all log, newest first, following new events
/subscriptions/<name>       → checkpoint, distance to head, dead letters
```

Category details also read Keiro's declared consumers for the open category. The panel
reports mounted configuration, with separate projection-catalog and durable-subscriber
coverage, every matching binding and its exact source, and links to projection groups and
named subscriptions. It describes neither worker health nor delivery progress. Empty
metadata means no matches within the reported coverage. **Refresh consumers** manually
restarts its independent pagination; metadata does not poll while idle. A changed inventory
or expired cursor restarts only consumer pagination. Missing Keiro configuration, unavailable
routes on older hosts, and failures remain visible while event inspection stays usable.

## Limits

- Read-only: the console does not replay, skip, or delete a subscription's dead letters.
- A single-stream read does not report global positions (kiroku answers 0), so those rows say
  "not reported"; the event's own page has the real position.
- When the live tail overflows, the console shows kiroku's message and recovers the dropped
  events by polling.
