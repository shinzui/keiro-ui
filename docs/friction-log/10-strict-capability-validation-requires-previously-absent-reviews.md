---
type: Friction Entry
title: "Strict capability validation requires previously absent reviews"
description: "The plan-required strict capability check refused all eleven existing concepts because their recommended reviews metadata was absent, requiring a bounded catalog-metadata review."
generated:
  by: "codex-cli/gpt-6.1-sol"
  at: "2026-11-05T22:15:41Z"
frictionId: FRIC-10
status: "resolved"
impact: detour
kind: documentation
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/26-expose-keiro-0-24-workflow-counts-and-category-consumers.md"
workaround: "Verify catalog identifiers, provider, package names and evidence paths, then record that bounded metadata review without claiming an independent behavior review."
resolution: "All eleven capabilities now record a bounded catalog-metadata review, and the required strict capability validation passes without weakening the profile."
amended:
  - by: "codex-cli/gpt-6.1-sol"
    at: "2026-11-05T22:18:23Z"
    change: "Resolve the missing review metadata through a verified, explicitly scoped catalog review."
---
# Strict capability validation requires previously absent reviews

## Attempted

Run okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce.

## Encountered

All eleven capabilities reported missing profile-recommended field: reviews; empty review lists are also treated as absent.

```text
profile: runtime-overview: missing profile-recommended field: reviews (Chronological human or model review provenance for this document revision.)
```

## Workaround

Verify catalog identifiers, provider, package names and evidence paths, then record that bounded metadata review without claiming an independent behavior review.
