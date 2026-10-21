---
title: Static deployment at any base path
type: Capability
description: Ship the console as a static bundle built for any base path, reaching the inspection surfaces on the page's own origin or on separate origins through connection profiles.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-10
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
interface:
  - VITE_BASE_PATH
  - bun run release:pack
  - /settings/connections
evidence:
  - kind: test
    resource: apps/console/e2e/production/production.spec.ts
    proves: A build for /console/ behind Caddy serves the shell, reloads deep links, hashes assets under the base path, and (with the local stack) reads every surface from one origin with no CORS preflight.
  - kind: test
    resource: apps/console/src/settings/base-path.test.tsx
    proves: A sub-path deployment leaves the surfaces at their absolute prefixes.
  - kind: test
    resource: apps/console/src/settings/connection-profiles.test.tsx
    proves: Each mode resolves HTTP and WebSocket URLs correctly, origins are validated, profiles persist in browser storage, and the built-in profile cannot be removed.
  - kind: module
    resource: scripts/release-pack.sh
    proves: How the release tarball is assembled, with its notices and proxy examples.
  - kind: guide
    resource: docs/user/deployment.md
    proves: Three deployment recipes and each server's origin settings.
---

# Static deployment at any base path

The console has no server of its own. It builds to an `index.html` and hashed assets for a base
path fixed at build time, and is packed into a release tarball with its notices and example
Caddy and nginx configurations. Connection profiles decide how it reaches the surfaces: the
default "Same origin" profile uses `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` on the page's
own origin; a "Separate origins" profile names an origin per surface.

```bash
VITE_BASE_PATH=/console/ bun run release:pack
```

## Limits

- The console adds no authentication, and the surfaces have none; whatever protects the
  surfaces must also protect the console's path.
- The base path is fixed at build time; a bundle served at another path fails to load its
  assets.
- Connection profiles are stored in each browser; there is no shared configuration.
- The console keeps at most three keiro requests in flight to fit keiro's default read budget
  of four; a host with a lower budget sees "busy" states.
