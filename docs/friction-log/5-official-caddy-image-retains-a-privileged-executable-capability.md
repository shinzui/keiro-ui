---
type: Friction Entry
title: "Official Caddy image retains a privileged executable capability"
description: "The official Caddy image executable has cap_net_bind_service, which prevents it running with all Linux capabilities dropped until that file capability is removed."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T18:36:28Z"
frictionId: FRIC-5
status: "resolved"
impact: detour
kind: environment
origin: "mori://shinzui/keiro-ui"
affects: "https://github.com/caddyserver/caddy-docker"
plan: "docs/plans/20-connect-one-console-to-multiple-application-deployments.md"
workaround: "Remove the inherited executable capability with setcap -r /usr/bin/caddy during the image build; port 8080 needs no capability."
resolution: "The Dockerfile removes the inherited Caddy file capability before switching to UID 10001; the hardened cap-drop ALL smoke passes."
amended:
  - by: "codex-cli/gpt-6.1-sol"
    at: "2026-10-26T18:56:01Z"
    change: "Remove the unneeded bind-port file capability and document the constraint in ADR-9 and the runbook."
---
# Official Caddy image retains a privileged executable capability

## Attempted

Start the pinned official Caddy image as UID 10001 with cap-drop ALL on port 8080.

## Encountered

The container exited before validation because executing caddy returned Operation not permitted.

```text
/usr/local/bin/start-console: line 7: caddy: Operation not permitted
```

## Workaround

Remove the inherited executable capability with setcap -r /usr/bin/caddy during the image build; port 8080 needs no capability.
