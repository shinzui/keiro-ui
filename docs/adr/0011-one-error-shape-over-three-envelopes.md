---
type: Architecture Decision Record
title: One error shape over three envelopes
description: Every failed request becomes one ApiError carrying the surface, HTTP status, code, message, and details, whichever of the stack's three error envelopes the server used; clients raise typed refusals that keep the ApiError as their cause, and only network failures and 5xx answers are retried.
docId: ADR-11
status: Accepted
date: 2026-10-21
timestamp: 2026-10-21T23:00:00Z
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:00:00Z
---

# One error shape over three envelopes

## Context

The four surfaces answer failures in three shapes: the nested `{"error": {"code", "message",
"details"}}` (keiro, pgmq, kiroku's newer routes), shibuya's flat `{"error": "<text>", "code",
...context}`, and kiroku's legacy `{"error": "<text>"}`. Screens must render refusals as the
server said them (ADR-7) and decide behaviour by code (`queue_not_found`, `command_failed`,
`mutations_disabled`), which is impossible if each screen parses envelopes itself.

## Decision

- `createHttpClient` normalizes every failure into `ApiError {surface, status, code, message,
  details, raw, headers}`: the nested envelope keeps its fields; the flat envelope keeps its
  `code` and puts the remaining keys in `details`; the legacy envelope is `legacy_error`; any
  other body is `http_<status>`; a network failure is status 0, `network_error`. Health routes
  name the 503 statuses whose bodies are answers, not failures (`okStatuses`).
- A client that gives a refusal a meaning raises a typed error whose `cause` is the `ApiError`
  (keiro's `RouteUnavailable`, `MutationsDisabled`, `SchemaDrift`, `MutationOutcomeUnknown`);
  screens find the `ApiError` by following `cause`.
- Queries retry only what may succeed next time: a status-0 or 5xx `ApiError`, found directly or
  as a cause, at most twice. A 4xx is a definite answer and a response that fails its schema
  fails again, so neither is retried.

## Consequences

- A refusal view renders any failure the same way: the code as a badge, the server's message
  verbatim, and the context the envelope carried (`RefusalView` in `features/actions`).
- A host that lacks a route (keiro without inspection hooks, shibuya before `/control`) is a
  definite state the page can name, reached after one request rather than three.
