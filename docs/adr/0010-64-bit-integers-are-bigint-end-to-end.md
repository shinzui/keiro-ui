---
type: Architecture Decision Record
title: 64-bit integers are bigint end to end
description: Every int64 the surfaces send (positions, versions, message ids, counters) is parsed losslessly into a bigint, shown and compared as one, and carried through URLs, search parameters, and query keys as exact decimal strings; a JavaScript number never holds one.
docId: ADR-10
status: Accepted
date: 2026-10-21
timestamp: 2026-10-21T23:00:00Z
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:00:00Z
---

# 64-bit integers are bigint end to end

## Context

kiroku global positions, stream versions, keiro positions, and pgmq message ids are 64-bit
integers on the wire, and the local stack already holds values above 2^53 (pgmq `msg_id`
9007199254740994, a `total_messages` counter at the same size). `JSON.parse` rounds such
values silently; so does any `Number(...)` on the way to a URL, a query key, or a comparison.
The console's defining operations — paging by cursor, linking an entry to its `$all` position,
computing a global position distance — are exactly the ones a rounding error corrupts without
any visible failure.

## Decision

- Responses are parsed with `parseJsonLossless` (`@keiro-ui/client-core`), and every field a
  surface defines as int64 is declared `int64()` in the client's schema, so it is a `bigint`
  (branded `Int64`) whatever its size. Other numbers stay `number`.
- Positions travel as decimal strings wherever text is the medium: URL path and search
  parameters, query keys, sheet references. The console's search parser keeps every scalar a
  string (TanStack's decoder would turn `"2"` into `2`); the value becomes a `bigint` only when a
  client is called.
- Arithmetic on positions (distances, `from = position - 1`) is `bigint` arithmetic; display
  goes through `formatInt`, which is exact for `bigint`. Values that arrive outside the schemas
  (feed page fields) are converted with `toInt64` before they enter the cache.

## Consequences

- A screen cannot accidentally mix a rounded number with a position: the types differ, and mixed
  arithmetic throws rather than drifting.
- Tests pin values above 2^53 through the table, the sheet, the page, and the URL (the queue
  message fixture) and through distance math (`features/projections/distance.test.ts`).
- A zero position from a read that does not know the position (kiroku's single-stream reads)
  is shown as "not reported", never as position 0, because `$all` never assigns 0.
