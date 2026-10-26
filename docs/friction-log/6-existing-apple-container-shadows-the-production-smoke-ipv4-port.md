---
type: Friction Entry
title: "Existing Apple container shadows the production smoke IPv4 port"
description: "A pre-existing Apple container forwards 127.0.0.1:8080 while Caddy can bind IPv6, so the production suite waits indefinitely on the shadowed IPv4 address."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T18:45:43Z"
frictionId: FRIC-6
status: logged
impact: detour
kind: environment
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/20-connect-one-console-to-multiple-application-deployments.md"
workaround: "Stop only the test runner started by this task and rerun with CONSOLE_PORT=18082, leaving the existing container untouched."
---
# Existing Apple container shadows the production smoke IPv4 port

## Attempted

Run bun run test:e2e:production on its default port 8080.

## Encountered

Caddy bound IPv6 successfully, but the IPv4 readiness request timed out on an existing container port-forward.

```text
lsof: caddy TCP *:8080 (IPv6); container TCP 127.0.0.1:8080 (IPv4).
```

## Workaround

Stop only the test runner started by this task and rerun with CONSOLE_PORT=18082, leaving the existing container untouched.
