---
title: Durable workflow inspection
type: Capability
reviews:
  - kind: model
    reviewer: codex-cli/gpt-6.1-sol
    reviewed_at: 2026-11-05T22:16:00Z
    document_timestamp: 2026-11-05T22:10:00Z
    scope: catalog-metadata
    outcome: commented
    context: Checked unique CAP handles, owning provider, workspace package names and evidence resource paths; this is not an independent behavioral review.
    provider: openai
    model: gpt-6.1-sol
    effort: high
  - kind: model
    reviewer: claude-code/claude-fable-5-2
    reviewed_at: 2026-11-17T23:55:00Z
    document_timestamp: 2026-11-17T23:55:00Z
    scope: catalog-metadata
    outcome: commented
    context: Checked the CAP handle, owning provider, workspace package names and evidence resource paths after adding the service topology declaration panel, by the model that made the change; this is not an independent behavioral review.
    provider: anthropic
    model: claude-fable-5-2
    effort: unspecified
timestamp: 2026-11-17T23:55:00Z
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
    resource: apps/console/src/features/workflows/workflow-list.test.tsx
    proves: Exact totals preserve digits beyond 2^53, scope only by workflow name and leave list paging usable when counts fail or are unavailable.
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
  - kind: test
    resource: apps/console/src/features/topology/live.test.tsx
    proves: A workflow list filtered to a declared stable name, and an instance of it, show the declaration and its declared steps; other names show no panel.
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

The status summary shows exact totals for all retained workflows, or only the exact,
case-sensitive workflow name selected. Status, time, ordering and page filters apply to the
list independently. The seven totals include terminal headers and carry their server
observation time; they are not historical event totals. Counts poll every 15 seconds and
respect pause/resume. Missing counts on older hosts, or failed count reads, leave the list
usable and never become fabricated zeroes.

## Limits

- Only the first page of the list is live; later pages are read when opened.
- Spans are derived by the browser, not traces recorded by keiro.
- When the host also mounts a service topology that declares a workflow under the filtered or opened
  workflow name, the list and the instance page show that declaration and its declared steps in order
  ([Service topology](service-topology.md)). The steps are what the specification lists, not what an
  instance has executed; the journal shows that.
- Read-only: the console does not cancel, retry, or signal a workflow.
