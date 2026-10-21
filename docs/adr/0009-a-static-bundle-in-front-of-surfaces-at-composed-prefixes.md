---
type: Architecture Decision Record
title: A static bundle in front of surfaces at their composed prefixes
description: The console ships as a static bundle built for one base path and served by whatever sits in front of the inspection surfaces, which every environment reaches at the absolute prefixes keiro's composeSurfaces uses, so one origin needs no CORS and a sub-path never leaks into surface URLs.
docId: ADR-9
status: Accepted
date: 2026-10-21
timestamp: 2026-10-21T22:40:00Z
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

Every environment reaches the surfaces at the absolute prefixes `/kiroku`, `/shibuya`, `/pgmq`,
and `/keiro`, whatever the console's own path. The default connection profile is same-origin and
builds a surface URL from the page's origin plus the prefix, so a console at `/console/` still
calls `/kiroku/...`. Application routes never start with a surface prefix.

The deployment is whatever sits in front of the surfaces: a reverse proxy serving the bundle with
an SPA fallback and forwarding the four prefixes (recipe A), the application host's own static
serving in front of its composed mount (recipe B), or, as the costly exception, a static host with
a separate-origins profile and each server's CORS allow-list (recipe C). `docs/deployment.md` is
the operator's document; `dev/caddy/Caddyfile` reproduces recipe A against the local stack.

## Consequences

- One origin needs no CORS and sends no preflights; keiro's WebSocket admits the page's origin as
  long as the proxy preserves `Host`.
- A bundle serves only at the path it was built for; a different path means a rebuild. The
  release tarball is built for `/` unless packed with `VITE_BASE_PATH`.
- The production smoke test (`bun run test:e2e:production`) proves a sub-path deployment with and
  without the stack; a keiro-side static mount remains a candidate request, not a dependency.
