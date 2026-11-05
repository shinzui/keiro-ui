---
type: Friction Entry
title: "Re-recording fixtures needs freshly seeded databases, which nothing said"
description: "The recording workflow documented a repeatable seed, but tests depend on exactly one seed run and an unaged pgmq_dev, so recording over existing data failed 8 tests."
generated:
  by: "claude-code/claude-opus-5-5"
  at: "2026-11-05T03:27:52Z"
frictionId: FRIC-8
status: "resolved"
impact: slowdown
kind: documentation
origin: "mori://shinzui/keiro-ui"
affects: "mori://shinzui/keiro-ui"
plan: "docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md"
workaround: "Renamed jitsurei, seeded a new one, and reset the demo queues; documented in dev/README.md"
resolution: "dev/README.md now documents the Re-recording fixtures procedure"
amended:
  - by: "claude-code/claude-opus-5-5"
    at: "2026-11-05T03:28:33Z"
    change: "Triaged at the completion of EP-22"
---
# Re-recording fixtures needs freshly seeded databases, which nothing said

## Attempted

just stack-seed, then bun run fixtures:record, as the plan and dev/README.md described

## Encountered

jitsurei-all appended a run to the existing database and the simulator had left 154 dead letters, so page counts and first rows no longer matched the tests.

## Workaround

Renamed jitsurei, seeded a new one, and reset the demo queues; documented in dev/README.md
