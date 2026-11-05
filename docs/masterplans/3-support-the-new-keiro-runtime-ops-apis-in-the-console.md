---
id: 3
slug: support-the-new-keiro-runtime-ops-apis-in-the-console
title: "Support the new Keiro runtime ops APIs in the console"
kind: master-plan
created_at: 2026-11-05T01:05:55Z
provenance:
  created_by:
    model: "claude-opus-5-5"
    harness: "claude-code"
    at: 2026-11-05T01:05:55Z
  revisions:
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-11-05T03:13:39Z
      mode: "implement"
      note: "Registry and progress updated while implementing children"
---

# Support the new Keiro runtime ops APIs in the console

This MasterPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Vision & Scope

The keiro runtime console was built against the operator APIs as they stood on 2026-10-21. The runtime
has moved since then, partly in answer to requests this console filed. After this initiative, the
console uses what shipped. An operator sees every mounted process manager without knowing a name, sees
which subscription feeds a projection group without guessing, and can compare an aggregate's current
register values with its stored snapshot. The local stack and test data track the current runtime, so
those screens are proven against real servers rather than hand-written bodies.

An inventory of the runtime checkouts on 2026-11-04 determined the scope, comparing each surface with the
console's fixture baseline in `packages/testing/fixtures/_meta.json` (keiro `7ee722a7`). "New" here means
shipped or committed after that baseline and reachable over HTTP. Four things qualify, all in keiro. `GET
/pm/types` lists mounted process managers
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-56`, released in 0.22.0.0).
`feeding_subscriptions` on `/projection/status` and the `projection_groups` feed names each group's
subscriptions (`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-57`, unreleased). Register values
are now readable through `/aggregate/show` and `/snapshot/show`, under a documented contract
(`mori://shinzui/keiro/plans/329-expose-keiki-register-values-through-the-existing-inspection-apis`).
`jitsurei-ops-http` is the first runnable host that mounts the hook-gated routes
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55`). Alongside these, upstream releases changed
existing behaviour the console must absorb, the most important being that kiroku-metrics 0.4.0.0 refuses
browser WebSocket upgrades unless the origin is allow-listed, which contradicts the deployment guide.

The following are explicitly excluded, and each exclusion was checked. Two of the console's four requests
have not shipped: workflow counts (`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-58`, plan 325
with no milestone complete and no route) and category consumers
(`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-59`, proposed, with plan 324 unstarted). They get
child plans when routes exist. Several newer capabilities have no HTTP surface, so the browser cannot reach
them without violating [ADR-5](../adr/0005-no-backend-for-frontend.md): the adapter's
`Shibuya.Adapter.Pgmq.DeadLetter` in `mori://shinzui/shibuya-pgmq-adapter` is an in-process Haskell API, and
kiroku's compaction commands are CLI-only. pgmq-inspect 0.7.0.0 has no API change from the console's copy
beyond its version string, and shibuya's control routes and detailed metrics are already supported.

Commands that existed before the baseline but that the console does not surface are also out of scope because
they are not new. These include workflow cancel, resurrect, and lease operations; projection `rebuild`;
stream deletion and truncation; outbox and inbox maintenance; and the outbox, inbox, and `replay-audit` reads.
`docs/plans/19-add-gated-operator-actions.md` fixed the mutation exclusions, and
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) defers replay-shaped and destructive
operations. This initiative adds no mutation. Releasing a console version is also outside it.


## Decomposition Strategy

The work divides into one foundation and three independent features, by operator-visible concern. The
foundation is stack and fixture alignment, including the audit of upstream behaviour changes; it adds no
screen. Each feature is one question an operator can now get answered: which managers exist, what feeds this
group, what is stored in this snapshot. Each has its own screen and its own acceptance against the running
stack, so any of them can ship alone.

Merging the features into one "read support" plan was rejected because they share only additive lines in
client files, and a single plan would obscure three separately shippable behaviours. Folding the foundation
into the first feature was rejected because all three consume it, and because fixture recording is a
single-writer job: pins change on every reseed, so scattering it across plans would make them invalidate one
another's fixtures. A separate plan for the upstream audit was rejected because the audit's verification is
the same stack and suite run.

Relevant local ADRs are as follows. [ADR-1](../adr/0001-inspection-endpoints-live-in-the-owning-project.md)
and [ADR-5](../adr/0005-no-backend-for-frontend.md) mean the console consumes owning-project routes directly
and cannot bridge in-process APIs. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps
mutations behind owning gates and payload visibility separate from action rights.
[ADR-9](../adr/0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md) defines same-origin proxy
deployment, which the kiroku origin change affects. [ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md)
requires exact integers, including register values. [ADR-11](../adr/0011-one-error-shape-over-three-envelopes.md)
and [ADR-12](../adr/0012-poll-first-live-queries.md) govern errors and live data.
[ADR-13](../adr/0013-honest-gates.md) requires a missing capability to be named as such.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) means one console may face hosts
at different versions. Cross-repository, `mori://shinzui/keiro/okf/adrs/concepts/ADR-53` explains why keiro's
routes follow its command grammar.


## Exec-Plan Registry

| # | Title | Path | Hard Deps | Soft Deps | Status |
|---|-------|------|-----------|-----------|--------|
| 22 | Align the console stack and fixtures with the current runtime cohort | docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md | None | None | In Progress |
| 23 | List mounted process managers from the ops catalog | docs/plans/23-list-mounted-process-managers-from-the-ops-catalog.md | EP-22 | None | Not Started |
| 24 | Show feeding subscriptions on projection groups | docs/plans/24-show-feeding-subscriptions-on-projection-groups.md | EP-22 | None | Not Started |
| 25 | Inspect registers and stored snapshots on aggregates | docs/plans/25-inspect-registers-and-stored-snapshots-on-aggregates.md | EP-22 | None | Not Started |

Status values: Not Started, In Progress, Complete, Cancelled.
Rows use each child's repository plan number, so EP-22 means `docs/plans/22-...`.
A whole-child hard dependency requires that child to be Complete.


## Dependency Graph

EP-22 comes first, because EP-23, EP-24, and EP-25 need two of its artifacts: a stack whose port 9093 mounts
hooks and carries the unreleased `feeding_subscriptions` field, and recorded fixtures for the new routes. Mock
routes come from those fixtures, so without EP-22 each feature would have nothing truthful to test against and
would have to write the hand-made bodies this initiative removes.

Once EP-22 is Complete, EP-23, EP-24, and EP-25 can proceed in parallel in any order. They touch different
screens and only add members to the client files. A suggested order is EP-23, EP-24, EP-25, smallest and most
certain first, but it is not a constraint.

```text
EP-22 ──┬── EP-23
        ├── EP-24
        └── EP-25
```


## Integration Points

`packages/testing/manifests/keiro.json`, `packages/testing/fixtures/`, and `_meta.json` are owned by EP-22.
EP-23, EP-24, and EP-25 consume the slugs listed in EP-22's Interfaces and Dependencies. A later plan that needs
another body adds a manifest entry and re-records keiro without reseeding, so pins hold. A reseed requires updating
pins and re-recording everything, and is coordinated here.

`packages/client-keiro/src/client.ts`, `schemas.ts`, `query-keys.ts`, and the package README are additive for all
three features. EP-23 owns `processManagers.types` and `ProcessManagerType`. EP-24 owns
`ProjectionGroupStatus.feeding_subscriptions`. EP-25 owns the new `snapshots` namespace and `StoredSnapshot`. No
plan changes an existing member. Expect trivial textual merges if run in parallel.

The live keiro host is owned by EP-22: `jitsurei-ops-http` on port 9093, read-only, with
`dev/bin/keiro-ops-http` kept for the `mori` profile. The features' live acceptance relies on it.

`docs/user/console-reference.md` is shared, with each feature editing its own section;
`docs/capabilities/` files are per feature, and both bundles' `log.md` take an entry per plan. EP-22 owns the
deployment guide.

The version-skew rule is shared. An absent field or refused route from an older host is a missing capability, never
an empty or negative fact. EP-23 applies it to `/pm/types`, where an old host refuses in the same way as an
unmounted one, and EP-24 applies it to the optional field. EP-24 owns recording it in
[ADR-13](../adr/0013-honest-gates.md). EP-25 owns amending
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) with the opt-in stored-snapshot read. EP-22
Milestone 3 decides whether the origin rule warrants more than the guide; if so, it amends
[ADR-9](../adr/0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md).

The representative producer/consumer check, owned by EP-22 Milestone 1, parses real `/pm/types`,
`/projection/status`, and `/snapshot/show` bodies from the running host through the client's live tests. It runs
before fixtures are recorded and before any feature starts. A body that differs from what EP-23, EP-24, or EP-25
describe changes those plans first.


## Progress

EP-22 is In Progress: its Milestone 1 producer/consumer check passed against keiro `9da47eb7` and changes none of the
sibling plans' shapes. EP-23, EP-24, and EP-25 wait on EP-22.

Integration gate, outside any single child: with all children complete, `cd apps/console && bunx playwright test
--config playwright.live.config.ts` passes against the stack with `/aggregates`, `/process-managers`, and
`/projections/<group>` all showing live data and none reporting "not mounted".


## Surprises & Discoveries

- 2026-11-04: ADR-7 item 4 says client packages carry redaction hooks at the render boundary, but none exist in
  `apps/console/src`, `packages/client-core/src`, or `packages/ui/src`, and event and queue payloads render directly.
  This matters more now that `/snapshot/show` can return fields an application's display omits. EP-25 uses an
  explicit press for that one panel and corrects the ADR; a deployment-wide payload policy remains an open decision,
  outside this initiative.

- 2026-11-04: `docs/user/deployment.md` Recipe A says no server needs CORS behind one origin. kiroku-metrics 0.4.0.0's
  changelog says WebSocket upgrades with any `Origin` are refused under `corsDisabled`, including through a
  same-origin proxy that preserves the header. EP-22 proves this and corrects the guide, because deployments following
  the current recipe would lose kiroku's live feeds on upgrade, though polling keeps data current.

- 2026-11-04: `mori path` failed on this machine while drafting because its extension manifest database connection was
  unavailable, while `mori registry list` worked. The `mori://` URIs in these plans follow the conventions already
  used in this repository and should be resolved with `mori path` when it is available.


## Decision Log

- Decision: "New ops APIs" means routes and fields added upstream after the console's fixture baseline and reachable
  over HTTP. Pre-existing commands the console never surfaced are out of scope, including all further mutations.
  Rationale: the request was for new APIs. Expanding to the remaining mutations would reverse decisions in
  `docs/plans/19-add-gated-operator-actions.md` and needs its own review against ADR-7. A later update can add children.
  Date: 2026-11-04

- Decision: Create no child plan for IR-58 or IR-59.
  Rationale: neither has a route, so a plan could not name a response shape or acceptance against a server. Add a child
  through this MasterPlan's update mode when one ships, or in a new one if this has closed.
  Date: 2026-11-04

- Decision: Build against keiro's unreleased `feeding_subscriptions` now rather than wait for the release, with absence
  as a first-class state.
  Rationale: the field is committed with tests, the console must handle hosts without it anyway because of ADR-15, and
  released hosts therefore behave as they do today. The risk is an upstream rename before release, which costs one schema
  key and a re-record.
  Date: 2026-11-04

- Decision: Align the stack and record fixtures in one prerequisite plan, a whole-child hard dependency for all features.
  Rationale: recording is single-writer and every feature's mock data and live acceptance come from it.
  Date: 2026-11-04


## Outcomes & Retrospective

(To be filled during and after implementation.)
