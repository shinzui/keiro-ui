---
id: 24
slug: show-feeding-subscriptions-on-projection-groups
title: "Show feeding subscriptions on projection groups"
kind: exec-plan
created_at: 2026-11-05T01:05:55Z
master_plan: "docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md"
provenance:
  created_by:
    model: "claude-opus-5-5"
    harness: "claude-code"
    at: 2026-11-05T01:05:55Z
---

# Show feeding subscriptions on projection groups

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

A projection group is a set of read models that keiro keeps up to date, and a durable subscription
is the checkpointed reader that feeds it. To see how far behind a group is, an operator needs that
subscription's checkpoints, but keiro never said which subscription feeds which group. So
`/projections/<group>` asks the operator to choose from every subscription kiroku knows, or to type a
name. A wrong choice shows plausible numbers for the wrong thing.

keiro now publishes `feeding_subscriptions` on each projection status row. After this plan, the group
page shows the checkpoints of the feeding subscription without asking, a group with two subscriptions
offers exactly those two, a group with none says so, and the `/projections` table names each group's
subscriptions. You can see it by opening `http://localhost:5173/projections/<group>` on the local stack,
where checkpoints appear with no input. On an older host, which sends no such field, the page keeps
today's chooser and says that the host does not report the answer.


## Progress

- [ ] M1: `ProjectionGroupStatus` accepts the field as optional; recorded `projection-status.json` parses
  with it and a body without it parses to `undefined`, and the `projection_groups` feed keeps it.
- [ ] M2: `/projections/$group` and `/projections` render all of the absent, empty, one, and several
  states, proven by `projections.test.tsx` and Playwright and against the live stack. Docs and
  [ADR-13](../adr/0013-honest-gates.md) are updated.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The client models the field as optional, and the console treats absent and empty as
  different facts. Absent means this host does not report it; empty means the host reports none
  recorded, as for inline-only and unmanaged groups.
  Rationale: the field is unreleased at keiro 0.23.0.0, and one console may front hosts at different
  versions ([ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md)). Rendering
  absent as empty would state something false about a group on an older host, which
  [ADR-13](../adr/0013-honest-gates.md) forbids.
  Date: 2026-11-04

- Decision: Only an absent field keeps the kiroku subscription chooser and free text. When the host
  reports, the only choices are the reported names, and a `subscription` URL parameter outside them is
  ignored with a visible note.
  Rationale: the chooser exists only because the answer was unknown. Keeping it beside a known answer
  invites the wrong-subscription mistake this plan removes, while old shared links must not fail.
  Date: 2026-11-04

- Decision: Read `/projection/position` for one subscription at a time, the selected one, defaulting to
  the first sorted name.
  Rationale: keiro admits four concurrent inspection reads by default and the client keeps three in
  flight (`KEIRO_MAX_CONCURRENT` in `packages/client-keiro/src/client.ts`); per-name reads for every
  group in a table would exhaust that budget and produce `inspection_busy`.
  Date: 2026-11-04


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

The list is `apps/console/src/routes/_shell/projections/index.tsx`, using
`apps/console/src/features/projections/projection-table.tsx`. The detail is
`apps/console/src/routes/_shell/projections/$group.tsx`, whose `FeedingSubscription` component holds
the chooser: an input, a row of buttons from `useKirokuCheckpoints()`, and the sentence "keiro does not
expose which subscription feeds this group" with `data-testid="subscription-limitation"`. It keeps the
choice in the URL search parameter `subscription`, and reads with `useProjectionPosition(subscription)`
from `apps/console/src/features/projections/queries.ts`. The same file reads the group's row by paging
`/projection/status` until the group appears, since keiro has no single-group read.

`packages/client-keiro/src/schemas.ts` defines `ProjectionGroupStatus` as a zod object with
`.passthrough()`, so today an unknown field survives parsing but is untyped. Page one of the list shares
its cache entry with the `projection_groups` WebSocket feed (`packages/client-keiro/src/feeds/`), which
writes new rows into the cache. Polling stays authoritative
([ADR-12](../adr/0012-poll-first-live-queries.md)), so the field must not be lost when a feed frame
replaces a row.

The upstream work is `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-57`, implemented under
`mori://shinzui/keiro/plans/327-name-the-feeding-subscriptions-on-projection-status-pages-without-runtime-performance-regressions`.
`GET /projection/status` items and `projection_groups` feed items gain `feeding_subscriptions`, a sorted
array of strings that is empty, not null, for inline-only and unmanaged groups. A group with several
asynchronous projections has several names. As of 2026-11-04 this is in keiro's Unreleased changelog,
and that plan's performance and documentation milestones are still open, so a published 0.23.0.0 host
does not send it. The console's handling of absence is therefore required behaviour, not a transition.
The bare `/projection/position?subscription=NAME` read is unchanged.

[ADR-13](../adr/0013-honest-gates.md) requires a missing capability to be named. The sentence must not
name a keiro version, because the release containing the field is not yet known.


## Plan of Work

### Milestone 1: client and feed

Add `feeding_subscriptions: z.array(z.string()).optional()` to `ProjectionGroupStatus`. In
`packages/client-keiro/test/reads.test.ts`, assert the recorded `keiro/projection-status.json` yields an
array and a body with the field deleted yields `undefined`. In `packages/client-keiro/test/feeds.test.tsx`,
assert a `projection_groups` frame with the field leaves it on the cached row. If the merge in
`packages/client-keiro/src/feeds/merge.ts` already keeps whole item bodies, this is only a test.

### Milestone 2: the screens

Split `FeedingSubscription` in `$group.tsx` into three parts, chosen from the row's field. When the
field is `undefined`, render a component containing today's chooser unchanged, with the sentence
reworded to "This keiro host does not report which subscription feeds this group; choose or enter it to
see checkpoints." Keeping `useKirokuCheckpoints()` inside this branch means hosts that report never
make that request. When the field is `[]`, render "keiro records no feeding subscription for this group;
it is inline-only or unmanaged." and make no position request. When the field has names, render them as
links using `links.subscription(name)` from `apps/console/src/lib/links.ts`. With two or more, add one
button per name that sets the `subscription` search parameter. Read the position of the selected name,
defaulting to the first. If the URL's `subscription` is not among the names, use the first and show
"`<name>` does not feed this group." Keep the position and member-checkpoint display as it is, moved into
a shared piece both branches use. While the row is still loading, show neither the chooser nor a claim.

In `projection-table.tsx`, add a Subscriptions column: names joined with commas, `—` for empty, and
`not reported` for undefined. It must not issue per-row position reads. Update
`apps/console/src/features/projections/projections.test.tsx` and `apps/console/e2e/projections/`.

Update `docs/capabilities/projection-monitoring.md` and the Projections part of
`docs/user/console-reference.md`, with log entries. Add a rule to
[ADR-13](../adr/0013-honest-gates.md), advancing its `timestamp` and adding to `docs/adr/log.md`: an
absent field from an older host is a missing capability and is never rendered as an empty or negative
fact. Remove the `keiro IR-57 asks keiro to say` comment.


## Concrete Steps

Run from the repository root in `nix develop`, with the stack from the prerequisite plan running.

```bash
curl -fsS 'http://127.0.0.1:9093/projection/status?limit=5' | jq '.items[] | {group_id, feeding_subscriptions}'
bun run --filter @keiro-ui/client-keiro test
bun run --filter @keiro-ui/console test -- projections
bun run check
bun run test
bun run test:e2e
cd apps/console && bunx playwright test --config playwright.live.config.ts
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
```

Expected output of the first command, for the jitsurei seed, includes a line like this.

```text
{"group_id":"$legacy-read-model:jitsurei-area-chapters","feeding_subscriptions":[]}
```


## Validation and Acceptance

With the stack and `bun run dev` running, open `/projections`; the Subscriptions column names the
subscriptions from the `curl` above. Open a group with one feeding subscription: its position and member
checkpoints appear with no input, and the network panel shows one `/projection/position` read and no
`/subscription-checkpoints` read. Open `$legacy-read-model:jitsurei-area-chapters`, or another group with
an empty array: the page shows the inline-only sentence and makes no position request.

Component tests with a per-test scenario (`useScenario` in `packages/testing/src/scenario.ts`) prove the
states the seed cannot produce. A group with two names shows two buttons, and selecting one changes the
URL and the read. A body without the field shows the chooser and the "does not report" sentence. A
`subscription` parameter outside the reported names shows the note. Each test fails if absent and empty
are swapped.


## Idempotence and Recovery

All requests are reads and the edits are additive or local to these screens; repeat at will. The
`subscription` URL parameter keeps its name, so existing links keep working. If upstream renames the
field before release, change the schema key and re-record; the states are unaffected. Revert with
`git revert` of this plan's commits.


## Interfaces and Dependencies

Prerequisite: `docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md`
must be Complete. It supplies a recorded `packages/testing/fixtures/keiro/projection-status.json` carrying
the field, from a keiro checkout at commit `3e9fbacd` or later, and the live stack.

This plan changes one member of `@keiro-ui/client-keiro`:

```typescript
ProjectionGroupStatus.feeding_subscriptions?: string[] // undefined: host does not report; []: none recorded
```

This plan also owns the [ADR-13](../adr/0013-honest-gates.md) amendment on absent fields, which the
parent MasterPlan `docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md` names as
shared across child plans.
