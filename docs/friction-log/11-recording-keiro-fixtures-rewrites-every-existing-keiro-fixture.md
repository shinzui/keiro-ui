---
type: Friction Entry
title: "Recording keiro fixtures rewrites every existing keiro fixture"
description: "bun run fixtures:record keiro, run to add two entries, rewrote 23 existing keiro fixtures and dropped their derived metadata, which had to be restored by hand."
generated:
  by: "claude-code/claude-fable-5-2"
  at: "2026-11-17T22:10:31Z"
frictionId: FRIC-11
status: logged
impact: detour
kind: tooling
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md"
workaround: "Saved the two new _meta.json entries, ran git checkout -- packages/testing/fixtures, re-inserted the two entries, and kept the two new fixture files; did not run derive. dev/README.md now describes this."
tags:
  - "fixtures"
---
# Recording keiro fixtures rewrites every existing keiro fixture

## Attempted

Add the topology-summary and topology-show entries to packages/testing/manifests/keiro.json and run bun run fixtures:record keiro, as the plan directs, expecting only the two new files and their _meta.json entries to change.

## Encountered

The recorder re-requested all 47 keiro entries. 23 existing fixtures changed (fresh observed_at values, and derived fixtures such as timers-pending.json replaced by raw recordings), _meta.json lost every derived and .recorded entry for keiro, sources.keiro.commit moved for all files, and the manifest was reformatted. The recorder has no way to record selected entries.

```text
23 files changed, 23 insertions(+), 23 deletions(-) under packages/testing/fixtures/keiro; _meta.json: 'derived': true and '*.recorded.json' entries removed
```

## Workaround

Saved the two new _meta.json entries, ran git checkout -- packages/testing/fixtures, re-inserted the two entries, and kept the two new fixture files; did not run derive. dev/README.md now describes this.
