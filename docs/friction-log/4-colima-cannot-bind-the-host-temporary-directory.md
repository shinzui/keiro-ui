---
type: Friction Entry
title: "Colima cannot bind the host temporary directory"
description: "The local Colima runtime does not share arbitrary host /tmp paths, so the container smoke test could not mount its temporary configuration."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T18:35:30Z"
frictionId: FRIC-4
status: logged
impact: detour
kind: environment
origin: "mori://shinzui/keiro-ui"
affects: "https://github.com/abiosoft/colima"
plan: "docs/plans/20-connect-one-console-to-multiple-application-deployments.md"
workaround: "Create the disposable configuration directory under the checkout .dev directory, which Colima shares with the home directory."
---
# Colima cannot bind the host temporary directory

## Attempted

Run sh scripts/smoke-kubernetes-container.sh with a mktemp directory under /tmp.

## Encountered

Docker rejected the bind mount because the source path did not exist inside the Colima VM.

```text
invalid mount config for type bind: bind source path does not exist: /tmp/keiro-console-smoke.OPaRsu
```

## Workaround

Create the disposable configuration directory under the checkout .dev directory, which Colima shares with the home directory.
