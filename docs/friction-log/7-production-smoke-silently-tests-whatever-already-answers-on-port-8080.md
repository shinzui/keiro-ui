---
type: Friction Entry
title: "Production smoke silently tests whatever already answers on port 8080"
description: "playwright.production.config.ts reuses any server on its port, so another local service on 8080 produced 11 misleading failures with no sign the console was not under test."
generated:
  by: "claude-code/claude-opus-5-5"
  at: "2026-11-05T03:27:51Z"
frictionId: FRIC-7
status: "accepted"
impact: detour
kind: tooling
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md"
workaround: "CONSOLE_PORT=8088 bun run test:e2e:production"
resolution: "CONSOLE_PORT is a sufficient override for a machine-local port conflict"
amended:
  - by: "claude-code/claude-opus-5-5"
    at: "2026-11-05T03:28:32Z"
    change: "Triaged at the completion of EP-22"
---
# Production smoke silently tests whatever already answers on port 8080

## Attempted

bun run test:e2e:production with the default CONSOLE_PORT 8080

## Encountered

A Redpanda Console container held 127.0.0.1:8080; Playwright reused it, and every tier failed, including a WebSocket test whose refusal looked like the behaviour under test.

```text
11 failed; GET http://127.0.0.1:8080/console/ returned Redpanda Console HTML
```

## Workaround

CONSOLE_PORT=8088 bun run test:e2e:production
