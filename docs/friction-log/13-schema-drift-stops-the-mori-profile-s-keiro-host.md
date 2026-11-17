---
type: Friction Entry
title: "Schema drift stops the mori profile's keiro host"
description: "The mori dev database's keiro schema is older than the keiro checkout the host is built from, so every read answers schema_drift and process-compose stops the host, which blocked the live check of mori's own topology through the profile."
generated:
  by: "claude-code/claude-fable-5-2"
  at: "2026-11-17T22:59:54Z"
frictionId: FRIC-13
status: "accepted"
impact: detour
kind: environment
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/30-join-topology-declarations-to-live-inspection-screens.md"
workaround: "Started dev/bin/keiro-ops-http by hand on port 9093 with --allow-schema-drift --topology .dev/mori.topology.json and ran the gated mori live case against it; documented both in dev/README.md."
tags:
  - "stack"
resolution: "The mismatch ends when mori adopts a keiro release that has the topology routes; until then dev/README.md gives the hand-started host with --allow-schema-drift."
amended:
  - by: "claude-code/claude-fable-5-2"
    at: "2026-11-17T22:59:55Z"
    change: "Accepted: an environment mismatch between two other repositories' versions, documented with its workaround."
---
# Schema drift stops the mori profile's keiro host

## Attempted

Run just stack-up mori and just stack-check mori to accept the mori profile serving mori's own service topology.

## Encountered

keiro-ops-http started, logged schema drift for keiro_timers.traceparent, keiro_timers.tracestate and keiro_workflows.trace_awaited_step, answered /health with 503 and every read including /topology/summary with 409 schema_drift, and was stopped by process-compose after three restarts because its readiness probe is /health. The topology routes exist only in keiro newer than the release mori's database was migrated with, so no host build both has the routes and matches the schema.

```text
[keiro-ops-http] warning: schema drift: missing column keiro_timers.traceparent (expected: text)
keiro-ops-http      default     Completed   5s      -        3          -1
{"error":{"code":"schema_drift",...}} [409] for /topology/summary
```

## Workaround

Started dev/bin/keiro-ops-http by hand on port 9093 with --allow-schema-drift --topology .dev/mori.topology.json and ran the gated mori live case against it; documented both in dev/README.md.
