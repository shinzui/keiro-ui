---
type: Friction Entry
title: "Released bun2nix rejects Bun lockfile version 2"
description: "bun2nix 2.1.2 rejects the committed Bun 1.4.2 lockfile before generation, requiring a verified compatibility patch."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T16:42:18Z"
frictionId: FRIC-1
status: "accepted"
impact: detour
kind: tooling
origin: "mori://shinzui/keiro-ui"
affects: "https://github.com/nix-community/bun2nix"
plan: "docs/plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md"
workaround: "Inspect released deserialization and lock entries, then patch only the supported-version gate with frozen sandbox builds validating the generated cache."
resolution: "Pin bun2nix 2.1.2 with a narrow v2 version-gate patch; generation consistency and frozen sandbox builds validate the supported lock format."
amended:
  - by: "codex-cli/gpt-6.1-sol"
    at: "2026-10-26T16:56:13Z"
    change: "Keep the compatibility patch until an upstream release accepts v2 lockfiles."
---
# Released bun2nix rejects Bun lockfile version 2

## Attempted

nix run .#bun2nix -- --lock-file bun.lock --output-file bun-deps.nix

## Encountered

Unsupported lockfile version: 2

## Workaround

Inspect released deserialization and lock entries, then patch only the supported-version gate with frozen sandbox builds validating the generated cache.
