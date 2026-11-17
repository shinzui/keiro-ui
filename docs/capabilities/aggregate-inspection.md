---
title: Aggregate inspection
type: Capability
timestamp: 2026-11-17T23:55:00Z
reviews:
  - kind: model
    reviewer: codex-cli/gpt-6.1-sol
    reviewed_at: 2026-11-05T22:16:00Z
    document_timestamp: 2026-11-05T22:16:00Z
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
description: Browse the aggregate kinds a keiro host registers and open an instance as its raw events beside the state keiro folded from them, its registers, and on request what its stored snapshot holds.
generated:
  by: claude-code/claude-opus-5-5
  at: "2026-10-21T23:45:00Z"
capabilityId: CAP-6
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: "0.1.0"
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
  - "@keiro-ui/client-kiroku"
interface:
  - /aggregates
  - "/aggregates/<type>/<id>"
evidence:
  - kind: test
    resource: apps/console/e2e/aggregates/aggregates.spec.ts
    proves: Kind → instance → browser with both panes, and the pane split survives reload.
  - kind: test
    resource: apps/console/e2e/aggregates/not-mounted.spec.ts
    proves: A host without keiro's inspection hooks gets an explicit "not mounted" state, not an error.
  - kind: test
    resource: apps/console/src/features/aggregates/aggregates.test.tsx
    proves: Kinds link to their instances; a host without the hooks shows the not-mounted state without retrying; snapshot hydration and an incompatible stored snapshot render.
  - kind: test
    resource: packages/client-keiro/test/hook-gated.test.ts
    proves: A host without the hooks answers 400 invalid_request, which the client surfaces as an unavailable route rather than a failure.
  - kind: test
    resource: apps/console/src/features/topology/live.test.tsx
    proves: With a host whose catalogue matches the mounted topology (synthetic), an aggregate type's page shows its declaration and machine; without a match or without a topology it shows no panel.
---

# Aggregate inspection

The Aggregates section lists the aggregate kinds the keiro host registers and pages their
instances. An instance opens as a split view: the raw events from kiroku on one side, and on
the other the state keiro folded from them, how it was hydrated, and the snapshot's health.

```text
/aggregates                 → registered kinds
/aggregates/order/42        → events beside folded state
```

## Limits

- The Registers table appears only when the state has a non-empty `registers` object, the shape of
  keiro's default snapshot codec. A custom codec's state stays in the JSON viewer. Field types are not assumed.
- The stored snapshot is raw persisted JSON, which can include fields the application's display omits.
  It is read only when an operator presses **Read stored snapshot**, never polled, and appears only
  on the aggregate page. It is advisory and can be older than current values; a difference is not an error.
- Works only on a keiro host that mounts its aggregate inspection hooks. Many hosts do not
  (the mori dev profile is one); the page then names the probed path and says the inspection
  is not mounted.
- When the host also mounts a service topology whose aggregate is declared with this type's name as
  its category, the type's page shows that declaration, where the specification declares it, and its
  state machine on request ([Service topology](service-topology.md)). It is the declared machine: the
  page does not mark an instance's current state on it, because nothing guarantees an instance's state
  label equals a declared state name. No topology, or no matching declaration, shows nothing.
- The recorded fixtures come from keiro's jitsurei demo host, the local stack's default
  profile.
