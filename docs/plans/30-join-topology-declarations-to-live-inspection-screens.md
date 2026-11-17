---
id: 30
slug: join-topology-declarations-to-live-inspection-screens
title: "Join topology declarations to live inspection screens"
kind: exec-plan
created_at: 2026-11-17T21:49:45Z
intention: "intention_01m7nqmcx2e4kvcke3377tcg7g"
master_plan: "docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md"
provenance:
  created_by:
    model: "claude-fable-5-2"
    harness: "claude-code"
    at: 2026-11-17T21:49:45Z
  revisions:
    - model: "claude-fable-5-2"
      harness: "claude-code"
      at: 2026-11-17T23:00:43Z
      mode: "implement"
      note: "Milestones 1 to 4 implemented; the real-service positive-join check discarded with its reason"
---

# Join topology declarations to live inspection screens

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

The console can show what a service declares (its topology) and, separately, what is running (aggregates,
process managers, workflows, projections). After this plan the two are connected. From a declaration an
operator can jump to the live screen it corresponds to; from a live aggregate type, process manager,
workflow or projection group they can see and open its declaration, including an aggregate's state
machine beside its instances. When the mounted document and the running host disagree, the console says
which aggregates are declared but not mounted and which are mounted but not declared.

To see it working on the default local stack, open `http://localhost:5173/topology`: the stack's host is a
hand-written demo serving a document about a different service, so the page shows a notice that document
and host disagree and lists both sides. To see positive links, run the mock "joined" scenario in the test
suites, or the mori profile, where a workflow declaration links to that workflow's live instances.


## Progress

- [x] M1 (2026-11-17): The four joins are pure functions in `apps/console/src/features/topology/joins.ts`, covered in every state by `joins.test.ts` (11 tests). Each joinable declaration's page has a Live section with a link and its caveat or the exact reason there is none; `workqueue`, `intake` and `emit` state why they are not linked; other kinds have no Live section and read no catalogue.
- [x] M2 (2026-11-17): The topology index compares declared aggregate categories with mounted aggregate types and shows agreement, disagreement (declared but not mounted, mounted but not declared, declared and mounted), or that it cannot compare. On the default stack it reports disagreement and lists Jitsurei's `credit-limit`, `incident` and `order` as mounted but not declared (live case passes).
- [x] M3 (2026-11-17): The live aggregate type, process-manager, workflow list, workflow instance and projection-group screens show the joining declaration, with the machine or declared steps. With no topology served they are unchanged and ask only for the summary (tested: three pages, three summary requests, no document, no `/pm/types`).
- [x] M4 (2026-11-17): The positive-join check against a real service is discarded, with the reason under Surprises: mori's specification declares nothing that can link on its host. What was kept: the mori profile generates and mounts mori's own document, and a gated live case passes against that real 152-declaration document on a hand-started host. Positive joins rest on the synthetic "joined" scenario. Documentation and the ADR-16 amendment are complete. `bun run check`, `bun run test` (839 passed, 15 skipped), `bun run build`, `nix build`, `bun run test:e2e` (69 passed), `MULTI_APP_PORT=18081 bun run test:e2e:multi-app` (12 passed), the live suite on the default stack (9 passed, 3 skipped) and strict validation of the three bundles pass. `just stack-check` passes every keiro probe and fails only the two kiroku WebSocket probes (FRIC-12).


## Surprises & Discoveries

- 2026-11-17: Mori cannot prove a positive join. `keiro-dsl topology` accepts mori's workspace and
  writes 152 declarations, but they are 15 aggregates, 28 projection owners, 90 projection targets, 12
  rebuild groups, 6 read models and one contract. There is no workflow and no process; all 28 projection
  owners are delivered inline (`subscription` is `null`); and the mori profile's standalone host mounts
  no aggregate hooks. Every join on that host therefore answers "not mounted" or "inline", which is
  correct and is what the gated live case asserts. This plan expected a workflow declaration to link
  there; mori has none.

- 2026-11-17: The mori profile's host does not stay up on this machine, independently of this plan.
  The mori database's keiro schema is older than the keiro checkout the host is built from, so the host
  answers `409 schema_drift` for every read, the topology included, and `503` for `/health`, and
  process-compose stops it (FRIC-13 in `docs/friction-log/`). The real-document evidence was taken from
  the same binary started by hand with `--allow-schema-drift`. `just stack-check mori` was not accepted.

- 2026-11-17: Generating mori's topology takes about 35 seconds of CPU. The mori profile's host waits
  for it. It first looked like a hang under process-compose.

- 2026-11-17: Starting the mori profile runs mori's own `just migrate up`, which applied one pending
  migration (`20261117200703_namespace_push_policy`) to the local mori development database. That is
  the profile's documented start-up, not something this plan added.

- 2026-11-17: An existing test asserts that a process manager's page does not read `/pm/types`. The
  declaration panel needs the manager's category, which only that catalogue gives (the instance list
  does not report it). The panel reads the catalogue only when a mounted document declares a process;
  the test now serves no topology for its original assertion, and a second test covers the other case.

- 2026-11-17: An aggregate type has both a `name` and a `category`, and on Jitsurei they differ
  (`credit-limit` and `creditLimit`). The contract joins the document's `category` to the mounted
  `name`, so the join compares against `name` only; a type whose category matches but whose name does
  not is not linked, and a test pins that.

- 2026-11-17: No fixtures were recorded for this plan. The "joined" scenario is synthetic by design, so
  the recorder's rewriting of existing fixtures (FRIC-11) did not recur.


## Decision Log

- Decision: Link only through the four joins the owning project traces to code: aggregate `details.category`,
  process `details.saga.category`, workflow `details.stableName`, projection-owner `details.subscription`.
  Rationale: The upstream contract lists `workqueue`, `intake` and `emit` joins as not guaranteed. A wrong
  link in an operator tool misdirects; an absent link with a stated reason does not.
  Date: 2026-11-17

- Decision: Do not highlight an instance's current state on the machine diagram.
  Rationale: An instance's `state_label` is produced by an application callback, and nothing guarantees it
  equals a machine state name. It can be added when the owning project guarantees the equality.
  Date: 2026-11-17

- Decision: Panels on live screens are silent when the host serves no topology, and never show an error
  for it.
  Rationale: Most hosts will not mount a document. The Service Topology section is where its absence is
  explained; repeating it on every live screen would be noise.
  Date: 2026-11-17

- Decision: Prove positive joins live against the mori profile with a document generated at build time,
  with a discard criterion.
  Rationale: The default stack's host has no specification, so it can only prove disagreement. Mori is a
  keiro-dsl service whose database the stack can already serve. If its specification cannot be exported
  with the available keiro-dsl, mock evidence plus the default stack's disagreement is accepted instead.
  Date: 2026-11-17


- Decision: Discard the positive-join check against mori and keep the mori profile serving its own
  topology.
  Rationale: The discard criterion named a refused specification, an oversize document or an unavailable
  database. None of those is what happened: generation works and the host accepts the document, but the
  document contains nothing that can link on that host. The check's purpose cannot be met, so it is
  discarded; the profile change is kept because it works and gives the stack a real service's document,
  which the default profile cannot. If generation fails the host starts without a topology.
  Date: 2026-11-17

- Decision: One component per joinable kind reads only the catalogue its own join needs.
  Rationale: A workflow's or read model's page must not cost the host an aggregate or process-manager
  catalogue read, and a page with no topology must cost nothing beyond the summary.
  Date: 2026-11-17

- Decision: The "joined" scenario is a flag on the testing package's scenario state, answered by
  `packages/testing/src/joined.ts`, and it also answers the instance lists of its synthetic types with
  empty pages.
  Rationale: Browser tests follow a link from a declaration to a live page; without a list answer that
  page would show an unrelated recorded error.
  Date: 2026-11-17

- Decision: When two declarations share a join value, the reverse lookup returns none.
  Rationale: The same rule as for two process managers sharing a saga category: the console does not
  choose.
  Date: 2026-11-17


## Outcomes & Retrospective

Completed 2026-11-17. Declarations and live screens are connected in both directions through the four
joins keiro guarantees, each stating when it holds. The three kinds keiro does not guarantee say why
they are not linked. The topology index shows whether document and host agree about aggregates, and on
the default stack it reports the disagreement that stack exists to demonstrate. Live screens are silent
when no topology is served.

What was not achieved: a positive join observed against a real running service. No such service is
available. Jitsurei has no specification, and mori's specification declares nothing that can link on
its host. Positive joins are proven against synthetic catalogues that match the recorded document,
named synthetic wherever they appear. The first real proof will come from a keiro-dsl service whose
host mounts the generated aggregate inspector catalog.

Friction: FRIC-13 (schema drift stops the mori profile's host) is `accepted`; it ends when mori adopts
a keiro release with the topology routes, and `dev/README.md` documents the hand-started host until
then. FRIC-12 (a foreign process on port 9091) recurred as a failing `just stack-check` and stays
`logged`.

Durable context went to [ADR-16](../adr/0016-a-served-declaration-document-is-verified-and-rejected-whole-when-unknown.md),
which now carries the join rule and the rule that disagreement is shown.


## Context and Orientation

This repository builds a static React console for the keiro runtime; the browser calls each runtime
project's HTTP inspection surface directly. The application is `apps/console`. Routes are files under
`apps/console/src/routes/_shell/`, each screen area has a directory under `apps/console/src/features/`
with a `queries.ts` holding its reads, and every internal link is built with `links` from
`apps/console/src/lib/links.ts` so the selected deployment survives navigation. Reads use
`useSurfaceQuery` from `@keiro-ui/client-core`, which does not run when a surface is not configured.

The service topology is a JSON document a keiro host serves, describing a service's specification as
nodes (declarations, each with `kind`, `name` and `details`) and edges (relations). Its contract is
`mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`; run `mori registry show shinzui/keiro
--full` for the checkout and open `docs/user/keiro-dsl-service-topology.md`. Read its section "Handoff for
keiro-ui", subsection "Joins to live inspection routes", before starting: it is the authority for this
plan. In summary, a node links to live state only as follows.

An `aggregate` node joins when its `details.category` equals the `name` of an item returned by
`/aggregate/types`. The live screens are `/aggregates/$type` (instances) and `/aggregates/$type/$id`. This
holds when the host mounts the generated inspector catalog. `details.category` is absent from documents
produced by older keiro-dsl versions.

A `process` node joins when its `details.saga.category` equals the `category` of an item returned by
`/pm/types`, and only when exactly one item matches; the link uses that item's `name`, which the host
chooses. The live screen is `/process-managers/$name`.

A `workflow` node joins through `details.stableName`, which is the workflow name the live routes filter
by. The live screen is `/workflows?workflow_name=`. There is no catalogue of workflow names to check
against, so this link is always offered, with the caveat that it holds when the application runs the
workflow under that name.

A `projection-owner` node joins through `details.subscription` when it is not `null`; that text is the
durable subscription name `/projection/position?subscription=` takes. `null` means inline delivery, which
has no subscription. The console's subscription screen is `/subscriptions/$name`, and a projection group
page (`/projections/$group`) lists each group's `feeding_subscriptions` when the host reports them.

Not guaranteed, and therefore not linked: `workqueue` (the only keiro queue routes are mutations),
`intake` (no exported field is the inbox source) and `emit` (the outbox source is supplied by the
application, not generated code). A node also has no link when its join field is absent or the matching
route's hooks are not mounted. The document describes the committed specification, not the running
binary; the console can detect disagreement by comparing aggregate `category` values with
`/aggregate/types`, and should show the mismatch.

The `/aggregate/*` and `/pm/*` routes exist only when the host application mounts inspection hooks. A host
without them refuses the command, which the client surfaces as `RouteUnavailable` (test with
`isRouteUnavailable` from `@keiro-ui/client-keiro`). That is "cannot compare", never "no aggregates".

Existing pieces this plan builds on, from two plans that must be Complete first
(`docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md` and
`docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md`):

- `useServiceTopology()` in `apps/console/src/features/topology/queries.ts`, whose `ready` state carries
  `topology.index`, and whose `not-served` and `not-configured` states mean there is no document.
- `TopologyIndex` (`node`, `byKind`, `outgoing`, `incoming`), `topologyNodeKey`, and the typed views
  `aggregateDetails`, `processDetails`, `workflowDetails`, `projectionOwnerDetails`, from
  `@keiro-ui/client-keiro`.
- `links.topology()`, `links.topologyNode(kind, name)`; `kindLabel` in
  `apps/console/src/features/topology/labels.ts`; `AggregateMachineSection` in
  `apps/console/src/features/topology/AggregateMachineSection.tsx`, which renders an aggregate's machine
  and takes only the node.
- The routes `apps/console/src/routes/_shell/topology/index.tsx` and `$kind/$name.tsx`.

Existing live reads to reuse, not duplicate: `useAggregateTypes` in
`apps/console/src/features/aggregates/queries.ts` (`/aggregate/types`), `useProcessManagerTypes` in
`apps/console/src/features/process-managers/queries.ts` (`/pm/types`), the workflow counts hook in
`apps/console/src/features/workflows/queries.ts`, and the projection reads in
`apps/console/src/features/projections/queries.ts`. The live routes are
`apps/console/src/routes/_shell/aggregates/$type/index.tsx`,
`apps/console/src/routes/_shell/process-managers/$name/index.tsx`,
`apps/console/src/routes/_shell/workflows/index.tsx` and `$name/$id.tsx`, and
`apps/console/src/routes/_shell/projections/$group.tsx`.

A sibling plan, `docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md`, may be complete,
in progress or not started. It adds a diagram inside `AggregateMachineSection`. This plan only renders
that component, so it works in every case and needs no change when the sibling lands.

The local stack (`dev/README.md`) has two profiles. The default runs `jitsurei-ops-http`, a hand-written
demo with inspection hooks, serving keiro's `hospital-capacity` golden document, which describes another
service. The mori profile (`just stack-up mori`, configured by `dev/profiles/mori.env` and
`dev/process-compose.mori.yaml`) runs the hook-less `keiro-ops-http` against a local database of
`mori://shinzui/mori`, a real keiro-dsl service whose specification is the workspace
`domain/mori.keiro-workspace` in its checkout. `dev/build.sh` builds the hosts into `dev/bin/`. Every
standalone keiro host accepts `--topology FILE` and refuses at startup a file larger than its response
limit.

Mock data: the default mock serves the `hospital-capacity` document and Jitsurei's recorded
`/aggregate/types` and `/pm/types`, which do not match it. `@keiro-ui/testing` returns the other golden
documents by name and lets a test override any response (`packages/testing/src/scenario.ts`).

Local ADRs that apply: [ADR-13](../adr/0013-honest-gates.md) says an absent capability is never a negative
fact, which governs every "cannot compare" and "no link" state here.
[ADR-5](../adr/0005-no-backend-for-frontend.md) means joins are computed in the browser from two reads.
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps this read-only, which is also
why queue routes are not linked.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) means a join never combines
one deployment's document with another's live data. The ADR about a served declaration document being
verified and rejected whole (created by plan 27; find it in `docs/adr/`) is amended by this plan with the
join rule.

This is the fourth child of
`docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md`.


## Plan of Work

### Milestone 1: The joins and links on declaration pages

Create `apps/console/src/features/topology/joins.ts` with pure functions, one per joinable kind, each
taking the node and the relevant live catalogue state and returning a `LiveJoin`:

- `linked`, with the link target and a one-line caveat stating when the join holds;
- `no-field`, when the join field is absent (for example an aggregate without `category`, with the
  explanation that the document predates it);
- `inline`, for a projection owner with a `null` subscription;
- `not-mounted`, when the live catalogue route is refused;
- `no-match`, when the catalogue is available and nothing matches;
- `ambiguous`, when more than one process manager shares the saga category (list their names; link none);
- `pending` and `failed`, while the catalogue is loading or errored.

Add `joinFor(node, catalogues)` choosing the function by kind, and `unjoinableReason(kind)` returning the
stated reason for `workqueue`, `intake` and `emit` and `undefined` for kinds with no live counterpart.

Create `apps/console/src/features/topology/LiveLinks.tsx` and mount it as a "Live" section on the node
detail route. It reads the catalogues with the existing hooks and renders the join: a link and its caveat;
or the reason in plain words. For a workflow, also show the seven exact status totals for that name using
the existing counts hook when available. For a projection owner with a subscription, link to the
subscription screen. For `workqueue`, `intake` and `emit`, show the reason there is no link. For every
other kind, render no Live section.

Add a "joined" mock scenario to `packages/testing`: overrides of `/aggregate/types` and `/pm/types` whose
names and categories match the `hospital-capacity` document's aggregates and its process's saga category.
Name it synthetic in code and tests; it is not recorded evidence.

### Milestone 2: Document versus host

Create `apps/console/src/features/topology/Agreement.tsx` and mount it on the topology index route under
the header. Compute, in `joins.ts`, the comparison between the set of aggregate `details.category` values
and the set of `/aggregate/types` names: declared and mounted, declared but not mounted, mounted but not
declared, and declared without a category.

Render one of: "The mounted aggregates match the document" with the count; "Document and host disagree"
with the two lists, each entry linking to its declaration or live type, and a sentence that the document
describes a committed specification and may be for a different build or service; or "Cannot compare: this
host does not mount aggregate inspection", when the catalogue route is refused. Aggregates without a
category are listed separately as not comparable. Never render disagreement as an error state and never
hide it.

### Milestone 3: Declarations on live screens

Create `apps/console/src/features/topology/DeclarationPanel.tsx`, a compact panel titled "Declared in
specification" that shows a declaration's kind and name, its source location, and a link to its topology
page. It renders nothing when `useServiceTopology` is not `ready` or no declaration joins. Add reverse
lookups to `joins.ts` (live aggregate type name to aggregate node; process-manager `category` to process
node; workflow name to workflow node; subscription name to projection-owner node).

Mount it on four screens. On the aggregate type page, with `AggregateMachineSection` below it in a
collapsible region, so the machine is visible beside the instances. On the process-manager page, with the
saga aggregate's machine likewise (a process keeps its progress in the aggregate its `saga` edge points
at). On the workflows list when filtered to one name and on the workflow detail page, with the declared
steps (`form` and `label`) listed in order. On the projection group page, for each feeding subscription
the host reports, the projection owner whose `subscription` equals it. When the host does not report
feeding subscriptions, show no panel; do not match on group names, which the contract does not guarantee.

### Milestone 4: A real service, documentation and the decision record

Make the mori profile serve mori's own topology. In `dev/build.sh`, also build keiro's `keiro-dsl`
executable into `dev/bin/`. Add a step, run for the mori profile before the host starts, that writes
`.dev/mori.topology.json` with `dev/bin/keiro-dsl topology "$MORI_REPO/domain/mori.keiro-workspace"
--format json`, and add `--topology .dev/mori.topology.json` to the host command in
`dev/process-compose.mori.yaml`. `.dev/` is git-ignored; do not commit the generated document and do not
edit the mori repository. Add a `/topology/summary` probe for the mori profile in `dev/check.sh`.

With that stack running, verify by hand and in a read-only case in `apps/console/e2e/live.spec.ts` gated
on the mori profile: a workflow declaration's link opens the live workflow list filtered to that name, and
a projection owner with a subscription links to a subscription that exists. Aggregate and process joins
report "not mounted" there, because that host has no hooks, which is the correct answer.

Discard criterion: if `keiro-dsl topology` refuses mori's specification, or the document exceeds the
host's response limit, or the mori database is unavailable, record the exact diagnostic in Surprises &
Discoveries, revert the mori profile changes, and accept the milestone on the mock "joined" scenario and
the default stack's disagreement notice. Do not patch another repository to make it pass.

Tests: `apps/console/src/features/topology/joins.test.ts` for every join state and the comparison;
component tests for `LiveLinks`, `Agreement` and `DeclarationPanel` under both the default mock (disagree)
and the "joined" scenario (agree, links present), plus the not-served case rendering no panel and sending
no extra requests; browser cases in `apps/console/e2e/topology/topology.spec.ts` following a link from a
declaration to a live screen and back through the panel; a multi-deployment case in
`apps/console/e2e/multi-app/multi-app.spec.ts` showing that switching deployments never pairs one
deployment's document with another's catalogue. Extend the default-stack live case to assert the
disagreement notice names Jitsurei's mounted aggregate types.

Documentation. Update `docs/capabilities/service-topology.md` and the Service Topology section of
`docs/user/console-reference.md` with the links, their caveats, the unlinked kinds and the agreement
notice. Update `docs/user/application-integration.md` with how an application makes its topology
available (commit the document, mount it with `--topology FILE` or in code, keep it fresh with
`keiro-dsl topology --check`) and what each join needs from the host. Add the declaration panel to the
capability pages `docs/capabilities/aggregate-inspection.md`, `process-manager-inspection.md`,
`workflow-inspection.md` and `projection-monitoring.md`. Update `dev/README.md` for the mori profile.
Advance timestamps and add `log.md` entries.

Amend the ADR about served declaration documents with the join rule: a declaration links to live state
only through a field the owning project guarantees; an unguaranteed relation is stated, not linked;
disagreement between document and host is shown. Follow `agents/skills/exec-plan/ADR.md`.


## Concrete Steps

Run from the repository root inside `nix develop`.

```bash
bun run test --project console joins.test.ts
bun run test --project console topology
bun run test:e2e -- topology aggregates process-managers workflows projections
bun run test:e2e:multi-app
```

The mori profile (Milestone 4), with `just stack-up` stopped first:

```bash
just stack-build keiro
just stack-seed-mori        # once, if the mori database does not exist
just stack-up mori
just stack-check mori
curl -fsS http://127.0.0.1:9093/topology/summary
```

The summary must name mori's service and list its workspace members. If the generation step fails, its
diagnostic is on standard error; apply the discard criterion.

Final validation, on the default profile:

```bash
just stack-check
bun run check
bun run test
bun run build
bun run test:e2e
bun run test:e2e:multi-app
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
okf validate docs/user --strict --profile mori/user-documentation-profile.dhall --profile-enforce --log-enforce
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
cd apps/console && KEIRO_UI_LIVE=1 bunx playwright test --config playwright.live.config.ts
```

Commits follow Conventional Commits and carry these trailers:

```text
MasterPlan: docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md
ExecPlan: docs/plans/30-join-topology-declarations-to-live-inspection-screens.md
Intention: intention_01m7nqmcx2e4kvcke3377tcg7g
```


## Validation and Acceptance

On the default stack, `http://localhost:5173/topology` shows "Document and host disagree", listing the
five `hospital-capacity` aggregates as declared but not mounted and Jitsurei's aggregate types (those in
`curl -fsS http://127.0.0.1:9093/aggregate/types`) as mounted but not declared. Opening the `Reservation`
aggregate declaration shows a Live section saying no mounted aggregate type matches category
`reservation`. Opening a `workqueue` declaration shows why it has no link. The live aggregate, process
manager, workflow and projection screens look exactly as before, with no panel and no error.

Under the "joined" mock scenario in the test suites, the index reports agreement, each aggregate and the
process link to their live screens, and the live aggregate type page shows the declaration panel with the
machine; following the panel's link returns to the declaration.

On the mori profile, if accepted, a workflow declaration links to live instances of that name.

Against a host that serves no topology, no screen outside the Service Topology section changes, and the
browser issues no more than the one summary request per minute the section's hook already makes.

All suites named above pass. No request other than `GET` is added.


## Idempotence and Recovery

Changes to the console are additive: new files under `apps/console/src/features/topology/`, one section on
the node detail route, one on the index route, and one panel on each of four live routes. Removing a
mounted panel restores a screen exactly. The generated `.dev/mori.topology.json` is rebuilt on every mori
profile start and is safe to delete. `just stack-seed-mori` is needed once; do not reseed the default
profile for this plan, since seeding appends data and invalidates recorded fixture pins. The mori profile
changes are reverted by restoring `dev/build.sh`, `dev/process-compose.mori.yaml` and `dev/check.sh`.


## Interfaces and Dependencies

Hard prerequisite: `docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md` Complete (which
requires `docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md`). Soft:
`docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md`; with it, machines shown by this
plan include a diagram, with no code change here. No new npm dependency. Milestone 4 depends on a checkout
of `mori://shinzui/mori` and keiro's `keiro-dsl` executable from `mori://shinzui/keiro`, both optional
under the discard criterion.

```typescript
// apps/console/src/features/topology/joins.ts
type LiveJoin =
  | { status: "linked"; target: LinkTarget; caveat: string }
  | { status: "no-field"; field: string } | { status: "inline" }
  | { status: "not-mounted" } | { status: "no-match"; value: string }
  | { status: "ambiguous"; names: string[] } | { status: "pending" } | { status: "failed"; error: unknown }

function joinFor(node: TopologyNode, catalogues: LiveCatalogues): LiveJoin | undefined
function unjoinableReason(kind: TopologyNodeKind): string | undefined
function compareAggregates(index: TopologyIndex, types: AggregateType[]): AggregateAgreement
function declarationForAggregateType(index: TopologyIndex, typeName: string): TopologyNode | undefined
function declarationForProcessCategory(index: TopologyIndex, category: string): TopologyNode | undefined
function declarationForWorkflow(index: TopologyIndex, workflowName: string): TopologyNode | undefined
function declarationForSubscription(index: TopologyIndex, subscription: string): TopologyNode | undefined
```

`LinkTarget` is the existing type exported by `apps/console/src/lib/links.ts`.
