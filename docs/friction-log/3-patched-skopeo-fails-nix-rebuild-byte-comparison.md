---
type: Friction Entry
title: "Patched Skopeo fails Nix rebuild byte comparison"
description: "The importer timing probe using nix build --rebuild completed compilation but failed the helper output determinism comparison, interrupting the benchmark."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-10-26T17:05:40Z"
frictionId: FRIC-3
status: logged
impact: detour
kind: tooling
origin: "mori://shinzui/keiro-ui"
affects: "https://github.com/nlewo/nix2container"
plan: "docs/plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md"
workaround: "Build the same pinned importer source as a uniquely named probe derivation, retaining the normal cached importer and reporting cached toolchain state explicitly."
---
# Patched Skopeo fails Nix rebuild byte comparison

## Attempted

Time the pinned patched Skopeo with nix build --rebuild and cached dependencies.

## Encountered

Nix reported that skopeo-1.24.1 may not be deterministic because the rebuilt output differs.

## Workaround

Build the same pinned importer source as a uniquely named probe derivation, retaining the normal cached importer and reporting cached toolchain state explicitly.
