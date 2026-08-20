---
type: Architecture Decision Record
title: No backend-for-frontend
description: The keiro runtime console consumes each project's own endpoints directly through one typed client package per surface; no aggregation server sits between the browser and the owning projects.
docId: ADR-5
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# No backend-for-frontend

## Context

The keiro runtime console consumes four independently owned endpoint surfaces — kiroku's,
shibuya's, pgmq-hs's, and keiro's. A common architecture for such UIs inserts a
backend-for-frontend: a bespoke server that aggregates, reshapes, and caches the upstream
APIs into UI-shaped responses.

The prior-art survey (`docs/architecture/ui-prior-art-survey.md`) found the strongest tools
converging on the opposite: Temporal's UI server collapsed over time into a thin gateway over
the one canonical API every client shares, and Restate's UI never does anything its public
admin API cannot. A BFF for this stack would also cut against two standing decisions: it
would recreate the four-dialect problem the cross-project conventions
(`docs/architecture/inspection-api-conventions.md`) exist to prevent — the BFF's wire format
becoming a fifth dialect — and it would drift toward re-implementing lower-layer concepts
behind a new server, which [ADR-1](0001-inspection-endpoints-live-in-the-owning-project.md)
assigns to the owning projects.

## Decision

The console has no backend-for-frontend. The browser consumes each project's own endpoints
directly — or through the composed single-port mount requested from keiro
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-31`), which is routing, never
aggregation or reshaping. The data layer is one typed TypeScript client package per endpoint
surface (`@keiro-ui/client-kiroku`, `@keiro-ui/client-shibuya`, `@keiro-ui/client-pgmq`,
`@keiro-ui/client-keiro`), mirroring repository ownership, each written against the
cross-project conventions.

## Consequences

The UI can never show something the public APIs cannot serve — every capability gap becomes
an improvement request against the owning repository, keeping pressure where ownership is.
There is no second server to deploy, version, or secure, and the deployment story reduces to
static assets plus the surfaces themselves. Cross-surface composition (the Overview screen,
cross-entity links) happens in the client, which costs some duplicated fetching — accepted,
because the alternative costs a fifth wire dialect and a standing violation of endpoint
ownership. If the surfaces later publish machine-readable specs, the hand-written clients are
regenerated, not replaced by a server.
