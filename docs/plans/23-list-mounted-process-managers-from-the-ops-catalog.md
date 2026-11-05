---
id: 23
slug: list-mounted-process-managers-from-the-ops-catalog
title: "List mounted process managers from the ops catalog"
kind: exec-plan
created_at: 2026-11-05T01:05:55Z
master_plan: "docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md"
provenance:
  created_by:
    model: "claude-opus-5-5"
    harness: "claude-code"
    at: 2026-11-05T01:05:55Z
---

# List mounted process managers from the ops catalog

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

An operator opening the console's Process managers page today sees a text box and the sentence
"keiro does not expose a list of mounted process managers". They must already know each manager's
name, or have typed it into Settings. keiro now answers `GET /pm/types`, so that sentence is false.

After this plan, `/process-managers` on a host that mounts process managers shows a table of every
mounted manager, with its category, whether snapshots are configured, its snapshot policy, and
whether it has timers. Each row opens that manager's instances, and nobody has to know a name in
advance. You can see it working by running the local stack and opening
`http://localhost:5173/process-managers`, where `jitsurei-fulfillment` appears with no configuration
and no typing. Hosts that cannot answer keep today's name form, so nothing regresses on a deployment
that has not upgraded.


## Progress

- [ ] M1: `keiro.processManagers.types()` parses the recorded `keiro/pm-types.json`, and answers
  `RouteUnavailable` on a host without the route, proven in `packages/client-keiro/test/hook-gated.test.ts`.
- [ ] M2: `/process-managers` renders the catalog, the empty catalog, the fallback form, and an unknown
  `timers_configured` honestly, proven in `process-managers.test.tsx` and Playwright, and against the
  live stack. The user and capability docs describe it.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Keep the name form, the profile's `processManagerNames`, and recent names, shown only when
  `/pm/types` answers `RouteUnavailable`. When the catalog answers, it replaces them.
  Rationale: a keiro host older than 0.22 can mount `pm list` and `pm show` yet refuse `pm types` with
  the same `400 invalid_request` as a host with no hooks, so the two cannot be told apart. The console
  connects to several application deployments at different versions, per
  [ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md), so removing the form
  would strand a working older host. For the same reason the fallback's wording must not claim
  either cause.
  Date: 2026-11-04

- Decision: A manager name typed directly into the URL keeps working when it is not in the catalog.
  Rationale: `/process-managers/$name` reads through `pm list`, which already reports an unknown name;
  the catalog is an index, not a client-side gate ([ADR-13](../adr/0013-honest-gates.md) requires the
  server's answer to be the one shown).
  Date: 2026-11-04


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

The console's keiro client is `packages/client-keiro`. `src/client.ts` holds `createKeiroClient`, whose
`read(schema, words, positionals, flags, signal)` helper turns command words into a GET: `["pm","list"]`
becomes `/pm/list`. `src/schemas.ts` holds zod schemas, and `src/query-keys.ts` holds TanStack Query
keys. Commands under `aggregate` and `pm` are hook-gated, meaning a host serves them only if the
application mounted its catalogs. A host that did not answers `400 invalid_request`, and
`src/errors.ts` turns that into the typed `RouteUnavailable` because `pm` is in `HOOK_GATED_WORDS`.

The screen is `apps/console/src/routes/_shell/process-managers/index.tsx`. Its helper
`useKnownManagerNames` in `apps/console/src/features/process-managers/queries.ts` merges the active
connection profile's `processManagerNames` with names found in recent visits. A manager's own page is
`apps/console/src/routes/_shell/process-managers/$name/index.tsx`, reached with
`links.processManager(name)` from `apps/console/src/lib/links.ts`. The same shape already exists for
aggregates: `apps/console/src/routes/_shell/aggregates/index.tsx` calls `useAggregateTypes()` with
`poll: false` and renders a table, or `<NotMountedState family="aggregate" />`
(`apps/console/src/features/shared/NotMountedState.tsx`). Follow that page.

keiro's request for this route is `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-56`, shipped in
keiro 0.22.0.0. The behaviour is documented in `docs/guides/serve-keiro-ops-over-http.md` in
`mori://shinzui/keiro` (artifact-level URI pending), and summarized here. Rows are sorted by catalog
lookup name, including aliases, and that name is what `pm show --name` and `pm list --name` accept.
`snapshots_configured` means a state codec exists, not that a snapshot is stored. `snapshot_policy` is
`never`, `every:N`, `on_terminal`, or `custom`. `timers_configured: null` means unknown, and must not
be shown as "no". It does not report pending timers. An explicitly mounted empty catalog returns
`{"items":[]}`. Discovery does no database reads beyond the schema check, and each request still uses
one of keiro's limited inspection slots, so the query does not poll.

[ADR-13](../adr/0013-honest-gates.md) requires a missing capability to be named as missing rather than
shown as an error or an empty list. Mock data comes from `packages/testing`: its server serves any
fixture listed in `fixtures/_meta.json`, and `keiro/pm-types.json` is recorded by
`docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md`.


## Plan of Work

### Milestone 1: the client read

In `packages/client-keiro/src/schemas.ts`, next to `AggregateTypes`, add `ProcessManagerType` with
`name`, `category`, `snapshots_configured`, `snapshot_policy`, and `timers_configured:
z.boolean().nullable()`, all `.passthrough()`, and `ProcessManagerTypes` as `{ items: [...] }`. Export
the output types. In `src/client.ts`, add `types` to `processManagers`, mirroring `aggregates.types`. In
`src/query-keys.ts`, add `processManagers.types()`. Update the table in `packages/client-keiro/README.md`.
In `packages/client-keiro/test/hook-gated.test.ts`, assert the recorded body parses and that the
existing 400 scenario gives `RouteUnavailable`.

### Milestone 2: the catalog page

In `apps/console/src/features/process-managers/queries.ts`, add `useProcessManagerTypes()` with
`poll: false`, and correct the comments that say keiro has no such read. Rewrite
`ProcessManagersPage`. While the read is pending, show the table's loading state, not the form, so the
form does not flash on a mounted host. On success with rows, show a table with columns Manager (a link
using `links.processManager(row.name)`), Category, Snapshots, Snapshot policy, and Timers, where Timers
is `yes`, `no`, or `unknown`. On success with no rows, show "This host mounts no process managers." On
`RouteUnavailable`, show the existing form and name lists, under a sentence that does not guess the
cause, such as "This keiro host does not list its process managers. Open one by name." On any other
error, show the error message above the table, as the aggregates page does. Replace the `PageHeader`
description, since the current one is false once a catalog can answer.

`useKnownManagerNames` and the settings field stay. Reword the settings help text in
`apps/console/src/settings/connections-page.tsx` to say the names are used when a host cannot list
its managers. Update the Overview "Aggregates & process managers" card in
`apps/console/src/features/overview/overview.tsx` only if its text claims managers cannot be listed.

Replace the test "the index never calls keiro…" in
`apps/console/src/features/process-managers/process-managers.test.tsx` with cases for the catalog, the
empty catalog, the fallback, and `timers_configured: null`, and adjust the Playwright spec in
`apps/console/e2e/process-managers/`. Update `docs/capabilities/process-manager-inspection.md` and the
Process managers part of `docs/user/console-reference.md`, and add entries to each bundle's `log.md`.


## Concrete Steps

Run from the repository root in `nix develop`, with the stack from the prerequisite plan running.

```bash
curl -fsS http://127.0.0.1:9093/pm/types
bun run --filter @keiro-ui/client-keiro test
bun run --filter @keiro-ui/console test -- process-managers
bun run check
bun run test
bun run test:e2e
cd apps/console && bunx playwright test --config playwright.live.config.ts
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
okf validate docs/user --strict
```


## Validation and Acceptance

With the stack and `bun run dev` running, open `http://localhost:5173/process-managers`. The table lists
`jitsurei-fulfillment` with category `fulfillment` and no text box. Selecting the row opens
`/process-managers/jitsurei-fulfillment`, listing instances with `demo-` correlation ids. Confirm with the
browser's network panel that `/pm/types` is requested once and not repeatedly.

Point the console at a hook-less host, such as the `mori` profile or a mock scenario failing the route
with 400 `invalid_request`. The page shows the name form with the neutral sentence, and typing a name
navigates as it does today. Component tests prove the remaining states: an empty catalog shows the
sentence, not a blank table, and `timers_configured: null` renders `unknown`.


## Idempotence and Recovery

All steps are additive edits and read-only requests, so they can be repeated. The route has no side
effects. If a test depends on the old page, change the test to the new behaviour rather than restoring
the sentence. Revert with `git revert` of this plan's commits; no data changes.


## Interfaces and Dependencies

Prerequisite: `docs/plans/22-align-the-console-stack-and-fixtures-with-the-current-runtime-cohort.md`
must be Complete. It supplies the fixture `packages/testing/fixtures/keiro/pm-types.json` and a stack
whose port 9093 mounts process managers.

This plan adds these to `@keiro-ui/client-keiro`, for the console only:

```typescript
export interface ProcessManagerType {
  name: string
  category: string
  snapshots_configured: boolean
  snapshot_policy: string // "never" | "every:N" | "on_terminal" | "custom"
  timers_configured: boolean | null // null means unknown, not false
}

client.processManagers.types(signal?: AbortSignal): Promise<{ items: ProcessManagerType[] }>
keiroKeys.processManagers.types()
```

Other plans under `docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md` add other
additive members to the same client files; no plan changes an existing member.
