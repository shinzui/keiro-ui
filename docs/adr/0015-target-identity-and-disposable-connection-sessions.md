---
type: Architecture Decision Record
title: Target identity and disposable connection sessions
description: Runtime application targets and logical workers are selected in URLs, with disposable caches and captured action attribution preventing cross-deployment state reuse.
docId: ADR-15
status: Accepted
date: 2026-10-26
timestamp: 2026-10-26T18:44:00Z
generated:
  by: codex-cli/gpt-6.1-sol
  at: 2026-10-26T18:44:00Z
---

# Target identity and disposable connection sessions

## Context

A static console can operate several application deployments through explicit proxy routes
([ADR-9](0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md)). Entity IDs and
surface query keys can be identical across deployments. Replacing only a client URL therefore
leaves stale reads, feed writes, cache scans, confirmations and commands able to describe the
wrong application. Shibuya state belongs to a single process, unlike database-backed surfaces.

## Decision

Load and validate a versioned deployment-owned catalog before mounting inspection consumers.
Only a real 404 means no managed catalog; all other loading or validation failures stop boot
with a retryable configuration error. An empty catalog does not enable legacy fixed routes.
Validate base URL spelling before URL normalization can erase traversal, and reject mixed
content, credentials, query strings and fragments. Catalog data is connection configuration,
never an authorization claim or arbitrary server-side proxy destination.

Select target and logical worker through URL search parameters. Explicit unknown IDs never
fall back. Canonicalize inferred selection before requests begin. Navigation and rendered
anchors retain identity, while explicit application changes open Overview and discard entity
filters/sheets. Last-used browser storage influences only target-less entry; another tab cannot
change an explicit selection. Managed targets cannot be edited through browser-local storage.
Validate local storage as a whole, migrate legacy profiles with opaque IDs intact, and retain
v1 for rollback. Never assign unscoped v1 recent/pinned items to the currently selected app.

A session is keyed by source, target ID, worker selection, normalized effective endpoints and
connection-affecting settings. It owns a fresh QueryClient, clients, live feeds, liveness,
page commands, status slots, sheets and confirmations. Retiring it deactivates an originating
token, cancels reads, clears caches and unmounts consumers. Feed callbacks and reconnects
ignore retired connections. Existing surface key factories remain unchanged because every
access, including timer/journal cache scans, is inside the same disposable cache. Do not retain
one cache per visited app. A fleet view would need a different explicit scope.

Omitted surfaces are disabled at shared query/feed boundaries and have visible configuration
states; no endpoint is invented. Configured but unreachable surfaces remain connectivity
failures. Database-only pages continue when worker selection is absent or invalid; aggregate
folded state remains usable without raw Kiroku events.

An unsubmitted preview or worker confirmation retires with its session. An already submitted
mutation retains its original client and immutable application/environment/worker/endpoints
identity. Its completion records in the tab-wide attributed memory audit, without updating the
new session's cache or showing an unqualified toast there. Navigation cannot cancel server
execution or roll back an action; uncertain outcomes retain the original target and are never
automatically retried. Existing upstream gates and typed confirmation still apply (ADR-13).

Worker entries identify one logical replica or report unavailable. A load-balanced endpoint,
shared headless Service or affinity cannot guarantee individual process identity. An existing
StatefulSet's pod-name selector can address one replica. Pending control confirmation is
removed on observed feed/read/health loss, but a stable logical replica can restart invisibly.
Incarnation-bound commands require upstream protocol support and are not promised here.

## Consequences

The selected target alone polls and subscribes. Switching endpoint settings under the same ID
also replaces the session; cosmetic label changes do not. Shared URLs work in another browser
with the same managed catalog; a missing local target produces an explicit recovery state.
The static catalog is reload-based, not discovery. No upstream inspection protocol changes,
aggregation backend or authentication implementation are introduced (ADR-1 and ADR-5).

Gateway authorization, CSRF protection and WebSocket Origin policy remain mandatory deployment
responsibilities; hiding entries or controls cannot enforce access. Runtime image/configuration
rollouts follow ADR-9's staged route/catalog process, and local proxy/container acceptance must
be distinguished from an actual cluster release. Plan 20's deterministic proxy fixtures and
session/action regressions exercise these boundaries.
