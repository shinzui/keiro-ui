---
type: Friction Entry
title: "Path flakes inflate benchmark evaluation with ignored checkout files"
description: "Repeated Linux path-flake evaluation spent about seven seconds on cache-hit commands because ignored checkout dependencies were included in the snapshot."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T17:01:26Z"
frictionId: FRIC-2
status: "resolved"
impact: detour
kind: tooling
origin: "mori://shinzui/keiro-ui"
affects: "https://nixos.org/nix"
plan: "docs/plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md"
workaround: "Use git+file:///workspace for benchmark inputs and trust only that checkout in the dedicated coordinator Git configuration."
resolution: "Benchmarks now use Git flakes and source nonces; cache-hit commands no longer snapshot ignored dependency trees."
amended:
  - by: "codex-cli/gpt-6.1-sol"
    at: "2026-10-26T17:04:55Z"
    change: "Use the explicit Git flake interface in measurement harnesses."
---
# Path flakes inflate benchmark evaluation with ignored checkout files

## Attempted

Run fresh source and unchanged-repeat benchmarks through a read-only /workspace path flake.

## Encountered

The unchanged-repeat application command took 7.20 seconds with no build phases.

## Workaround

Use git+file:///workspace for benchmark inputs and trust only that checkout in the dedicated coordinator Git configuration.
