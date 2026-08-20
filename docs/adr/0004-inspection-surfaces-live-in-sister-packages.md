---
type: Architecture Decision Record
title: Inspection surfaces live in sister packages
description: Core keiro-runtime libraries never gain web dependencies; each project ships its HTTP/WebSocket inspection surface as a dedicated sister package exporting an embeddable WAI Application.
docId: ADR-4
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# Inspection surfaces live in sister packages

## Context

The libraries of the keiro runtime stack are adopted for their core behavior — event storage
(kiroku), queue processing (shibuya), queue access (pgmq-hs), event-sourced application
semantics (keiro) — by applications that may want no web server at all, or that already run
their own. If inspection endpoints lived inside the core packages, every adopter would inherit
a Warp/WAI dependency closure and, worse, an implicit pressure toward running an HTTP listener.

The stack already has two live precedents for the alternative. shibuya ships its metrics server
as the separate `shibuya-metrics` package, with capability record CAP-10 stating the rationale:
"a separate package rather than part of the core precisely so that adopting Shibuya does not
mean adopting a web server." kiroku ships `kiroku-metrics` the same way, created under its
masterplan 5 specifically so `kiroku-store` never depends on a web framework.

## Decision

Every HTTP/WebSocket inspection surface in the stack lives in a dedicated sister package — a
package that depends on the core library, never the other way around. Core libraries never
gain web dependencies. pgmq-hs and keiro, which have no HTTP surface today, follow this
pattern when they grow one; final package names belong to the owning repositories.

Each sister package exports both a convenience runner (host chooses bind address and port) and
the bare WAI `Application`, so a host application can mount several projects' surfaces into a
single process behind one origin. WAI (Web Application Interface) is the standard Haskell
interface between web servers and applications; exporting the `Application` value is what makes
a surface embeddable rather than process-owning. The packaging rule is stated for implementers
in `docs/architecture/inspection-api-conventions.md` (area 1) in this repository.

## Consequences

Adopting any library of the stack never means adopting a web server; the inspection surface is
strictly opt-in per project. The composed deployment the keiro-ui browser app targets — one
process mounting the kiroku, shibuya, pgmq, and keiro surfaces — is possible precisely because
every surface is an embeddable `Application` rather than a process. The cost is more packages
to version and release, and each improvement request under the keiro-ui initiative must name a
sister package (existing or new) as the endpoint's home rather than dropping routes into a core
library.
