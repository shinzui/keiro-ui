---
type: Friction Entry
title: "A foreign process on port 9091 makes stack-check fail and falsely pass kiroku probes"
description: "Another application's kiroku-metrics server held port 9091, so the stack's kiroku-inspect could not bind and just stack-check could not pass in full."
generated:
  by: "claude-code/claude-fable-5-2"
  at: "2026-11-17T22:10:33Z"
frictionId: FRIC-12
status: logged
impact: detour
kind: environment
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md"
workaround: "Accepted the milestone on the keiro probes alone, which all passed against the stack's own jitsurei-ops-http, and left the foreign process running."
tags:
  - "stack"
---
# A foreign process on port 9091 makes stack-check fail and falsely pass kiroku probes

## Attempted

Run just stack-up and just stack-check to accept the new /topology/summary probe with the whole default stack.

## Encountered

kiroku-inspect exited with a bind failure because a process the user runs (rei worker kiroku) listens on *:9091. dev/check.sh then probed that foreign server: kiroku /capabilities printed ok (it is also a kiroku-metrics server) and both kiroku WebSocket upgrades failed with 403, so the recipe exited 1. Nothing checks that the listener on a stack port is the stack's own process.

```text
[kiroku-inspect] kiroku-inspect: bind failure (details redacted)
FAIL  ws kiroku /ws/events       403
FAIL  ws kiroku /ws/metrics      403
```

## Workaround

Accepted the milestone on the keiro probes alone, which all passed against the stack's own jitsurei-ops-http, and left the foreign process running.
