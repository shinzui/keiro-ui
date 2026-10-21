---
title: Work queue inspection
type: Capability
description: List pgmq queues by the age of their oldest message and peek at their messages, archive, and dead letters without leasing anything.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-3
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-pgmq"
interface:
  - /queues
  - "/queues/<name>"
evidence:
  - kind: test
    resource: apps/console/e2e/queues/queues.spec.ts
    proves: The list leads with oldest age and sorts through the URL; message and archive tabs are URL state; a message sheet reopens from its URL; a message id above 2^53 renders exactly; the metrics header follows the queue's feed.
  - kind: test
    resource: apps/console/src/features/queues/dead-letter-panel.test.tsx
    proves: A payload with the adapter's four fields renders the dead-letter panel; a payload without all four is not treated as a dead letter.
  - kind: test
    resource: packages/client-pgmq/test/openapi-parity.test.ts
    proves: The client's schemas mirror the components of pgmq-inspect's OpenAPI document.
  - kind: test
    resource: packages/client-core/test/int64.test.ts
    proves: 64-bit identifiers are decoded as bigint and never lose precision.
---

# Work queue inspection

The Queues screens read pgmq's inspection surface. Queues are ordered by the age of their
oldest message, the signal that work is stuck. A queue page shows its metrics live, and pages
its messages and archive by peeking: nothing is read with a visibility timeout, so inspecting
a queue never delays a consumer. A queue that holds payloads written by shibuya-pgmq-adapter
gets a dead-letter panel that shows the original message and the recorded failure.

```text
/queues?sort=oldest              → queues, oldest message first
/queues/orders?tab=archive       → archived messages, paged
```

## Limits

- Peek only. Redriving a dead-letter queue is an operator action that goes through keiro, not
  pgmq; see [gated operator actions](gated-operator-actions.md).
- The dead-letter panel understands shibuya-pgmq-adapter's payload shape only; a message
  without all four of its fields is shown as an ordinary message.
