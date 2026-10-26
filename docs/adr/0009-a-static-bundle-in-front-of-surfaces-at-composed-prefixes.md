---
type: Architecture Decision Record
title: A static bundle in front of surfaces at their composed prefixes
description: The console ships as a static bundle with a fixed asset base and explicit inspection base URLs, with Kubernetes deployment using static routing and runtime configuration behind the existing authenticated gateway.
docId: ADR-9
status: Accepted
date: 2026-10-21
timestamp: 2026-10-26T16:38:54Z
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T22:40:00Z
---

# A static bundle in front of surfaces at their composed prefixes

## Context

The console has no server of its own ([ADR-5](0005-no-backend-for-frontend.md)), and keiro may
not serve it: its inspection surface ships no browser application
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-40`). keiro's `composeSurfaces` mounts the four
inspection surfaces under `/keiro`, `/kiroku`, `/shibuya`, and `/pgmq` on one listener
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`) and serves no files. Operators deploy the
console beside applications that either compose the surfaces in-process or run them as four
servers, and often at a sub-path of an existing origin rather than at its root.

Two failure classes are common to single-page consoles: assets and routes that assume the root
path, and API URLs that inherit the page's path. On separate origins every call also needs a
CORS allow-list on every server and a preflight.

## Decision

The console is released as a static bundle (`release/keiro-ui-console-<version>.tar.gz`) built
for one base path, fixed at build time by `VITE_BASE_PATH`. Vite's `base` and the router's
`basepath` both derive from that single value; nothing else reads it.

The legacy same-origin profile reaches the surfaces at `/kiroku`, `/shibuya`, `/pgmq`, and
`/keiro`, whatever the console's own path. Plan 20 extends this to an explicit runtime catalog
of application/environment targets with optional surface base URLs. Browser-visible prefixes
may therefore be namespaced, such as `/inspection/prod/orders/keiro`; upstream composition
prefixes remain an independent routing concern. The console asset base never prefixes an
inspection URL. Application routes never start with a surface prefix.

The Kubernetes deployment target uses a stateless console/Caddy Deployment and a private
ClusterIP Service behind the existing authenticated HTTPS gateway. The browser uses public
same-origin paths; explicit Caddy mappings resolve application Services internally. Kubernetes
API discovery, aggregation, and a new authentication service remain outside the console.
The catalog and routes are non-secret runtime configuration, supplied together in a versioned,
immutable ConfigMap. Configuration changes roll out new pods without rebuilding assets;
route additions precede catalog publication across all replicas, and removals preserve an
error at retired paths rather than reassigning them to another target.

Worker routing must select one logical replica or fail unavailable. Services selecting several
workers cannot represent process-local Shibuya state. A stable replica name can survive a
process restart, so it is not a process-incarnation guarantee for commands.

This amendment records the agreed direction in
[plan 20](../plans/20-connect-one-console-to-multiple-application-deployments.md); the catalog
and Kubernetes recipe are not implemented merely by accepting this decision.

The deployment is whatever sits in front of the surfaces: a reverse proxy serving the bundle with
an SPA fallback and forwarding the four prefixes (recipe A), the application host's own static
serving in front of its composed mount (recipe B), or, as the costly exception, a static host with
a separate-origins profile and each server's CORS allow-list (recipe C). `docs/user/deployment.md` is
the operator's document; `dev/caddy/Caddyfile` reproduces recipe A against the local stack.

## Consequences

- Same-origin browser requests need no cross-origin CORS exchange, but public TLS termination
  does not remove upstream Origin checks. Preserve the browser Origin and explicitly configure
  the public HTTPS origin at each owner. The gateway must enforce authentication, per-target
  access, mutation protection, and WebSocket handshake policy; preserving `Host` alone is not
  sufficient. Internal network policy limits bypass paths but does not authorize users.
- A bundle serves only at the path it was built for; a different path means a rebuild. The
  release tarball is built for `/` unless packed with `VITE_BASE_PATH`.
- The production smoke test (`bun run test:e2e:production`) proves a sub-path deployment with and
  without the stack; a keiro-side static mount remains a candidate request, not a dependency.
