---
title: Durable workflow inspection
type: Capability
description: Find keiro durable-workflow instances by filter and read an instance's step-grouped journal, steps, children, and awakeables.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-5
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
interface:
  - /workflows
  - "/workflows/<name>/<id>"
evidence:
  - kind: test
    resource: apps/console/e2e/workflows/workflows.spec.ts
    proves: Filters round-trip through the URL and survive reload; paging works both ways; a feed update changes a row's badge live; detail tabs and the journal-entry sheet are URL state.
  - kind: test
    resource: apps/console/src/features/workflows/journal.test.ts
    proves: Consecutive entries of one step form a group, and the steps and errors lenses filter the journal.
  - kind: test
    resource: apps/console/src/features/workflows/segments.test.ts
    proves: Spans are derived between consecutive journal entries, with time to first step and the longest span.
  - kind: test
    resource: packages/client-keiro/test/workflows.test.ts
    proves: The client pages instances by cursor, reads header, journal, steps, children, and awakeables, and keeps positions above 2^53 exact.
---

# Durable workflow inspection

The Workflows section lists keiro's durable workflow instances with every filter held in the
URL, and keeps the first page current from keiro's `workflows` feed. An instance page shows its
journal grouped by step, with spans computed in the browser from journal timestamps, and its
steps, child workflows, and awakeables.

```text
/workflows?status_class=failed      → failed instances, live first page
/workflows/<name>/<id>?tab=journal  → step-grouped journal
```

## Limits

- Only the first page of the list is live; later pages are read when opened.
- Spans are derived by the browser, not traces recorded by keiro.
- Read-only: the console does not cancel, retry, or signal a workflow.
