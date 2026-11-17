---
id: 28
slug: browse-a-service-s-declared-topology-in-the-console
title: "Browse a service's declared topology in the console"
kind: exec-plan
created_at: 2026-11-17T21:49:45Z
intention: "intention_01m7nqmcx2e4kvcke3377tcg7g"
master_plan: "docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md"
provenance:
  created_by:
    model: "claude-fable-5-2"
    harness: "claude-code"
    at: 2026-11-17T21:49:45Z
---

# Browse a service's declared topology in the console

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

An operator looking at a keiro host today sees live instances but not what the service is made of. Keiro
can now serve a document, the service topology, that lists every declaration in a service's specification
and every relation between them. After this plan the console has a Service Topology section. Opening it
shows which service and specification the selected host mounted, every declaration grouped by kind and
searchable, and for any one declaration its details, its relations in both directions, where it is
declared in the specification source, and for an aggregate its state machine as a table of transitions.

To see it working, start the local stack and the console, open `http://localhost:5173/topology`, and find
the `hospital-capacity` service with 25 declarations. Open the `Reservation` aggregate and read its six
states and its transitions; follow a relation to a neighbouring declaration and back. Point the console at
a host that mounts no topology and the section says so instead of showing an empty list.


## Progress

- [ ] M1: `/topology` exists in the navigation and command palette and shows the mounted document's header and members, with every non-ready state (not configured, not served, unsupported schema, invalid, too large, changing, failed) rendered distinctly and tested.
- [ ] M2: The declarations inventory groups all nodes by kind with counts, filters by text and kind through the URL, and each row opens `/topology/$kind/$name`.
- [ ] M3: The node detail page shows details, source location, outgoing and incoming relations with links, the aggregate machine as a transitions table, and the read models an aggregate feeds; unknown nodes say so.
- [ ] M4: Browser, multi-deployment and live checks pass; the capability page and console reference are written and validate.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Text first. This plan renders every relation and machine as tables and lists; diagrams are a
  separate plan.
  Rationale: Tables are complete, accessible and testable without a layout engine, and they remain the
  equivalent of every diagram added later.
  Date: 2026-11-17

- Decision: One hook, `useServiceTopology`, is the only way a screen obtains the document, and it polls
  slowly (60 seconds).
  Rationale: The document is fixed for the life of a host process, so the only change to notice is a
  redeploy. The client keeps the verified document per digest, so each poll costs one small summary read.
  Date: 2026-11-17

- Decision: Topology declarations are not added to the shell's recently visited entities.
  Rationale: Recents track live entities an operator returns to; declarations are a static catalogue
  reachable by search.
  Date: 2026-11-17

- Decision: Render the `details` of node kinds without a typed view generically, as labelled fields.
  Rationale: Keiro may add fields within a schema id, and seventeen hand-built layouts would drift from
  the contract. Only aggregates get a purpose-built section, because of the machine.
  Date: 2026-11-17


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

This repository builds a static React console for the keiro runtime; the browser calls each runtime
project's HTTP inspection surface directly. The application is `apps/console`. Routes are files under
`apps/console/src/routes/_shell/` using TanStack Router's file routing; after adding a route file, run
`bun run --filter @keiro-ui/console generate-routes` to regenerate `apps/console/src/routeTree.gen.ts`.
Each screen area has a directory under `apps/console/src/features/` holding a `queries.ts` (every read for
that area) and its components. A good model to copy is the process-manager area:
`apps/console/src/features/process-managers/queries.ts` and
`apps/console/src/routes/_shell/process-managers/index.tsx`.

Reads go through `useSurfaceQuery` from `@keiro-ui/client-core` (`packages/client-core/src/live.ts`). It
wraps TanStack Query with the console's liveness rules: it polls at an interval (`poll`, or `false` for
none), stops while the operator pauses, and does not run at all when the surface is not configured for the
selected deployment. `useKeiroClient` from `@keiro-ui/client-keiro` returns the keiro client for the
current deployment. A deployment, also called a target, is selected in the URL; switching it creates fresh
clients and caches, so nothing here needs its own isolation logic
([ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md)).

The left navigation is defined in `apps/console/src/shell/navigation.ts`: a `SectionId` union and a
`sections` array, each with a title, icon (from `lucide-react`), rail link, path prefixes and sidebar
pages. Link builders live in `apps/console/src/lib/links.ts` and must be used for every internal link so
the selected deployment survives navigation. Palette commands are contributed through `registerFeature`
(`apps/console/src/shell/features.ts`), with one call per feature in `apps/console/src/features/index.ts`.
UI primitives come only from `packages/ui` (`@keiro-ui/ui/components/...`), per
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md). Existing shared
pieces to reuse: `PageHeader` (`apps/console/src/components/page-header.tsx`), `EmptyState`
(`apps/console/src/components/empty-state.tsx`), `JsonViewer`
(`apps/console/src/components/JsonViewer.tsx`) and `NotMountedState`
(`apps/console/src/features/shared/NotMountedState.tsx`), which shows how an unmounted capability is
worded.

The service topology is one JSON document produced by keiro's `keiro-dsl topology` command from a
service's specification, and served by a keiro host that mounts a committed copy. Its contract is
`mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`; to read it on disk, run `mori registry show
shinzui/keiro --full` for the checkout and open `docs/user/keiro-dsl-service-topology.md`. The document
has `schema` (`keiro-dsl/service-topology/1` or `/2`), `service`, `source` (`kind` and `path`),
`effectiveSemanticContract` (`languageVersion`, `languageSupport`, `runtimeSemantics`), `generator`
(`tool`, `version`), `members` (source files: `path`, `sha256`, `declaredLanguageVersion`,
`effectiveLanguageVersion`), `nodes` and `edges`. A node is one declaration: `kind`, `name`, `context`,
`member` (the file declaring it), `line`, and `details`, whose fields depend on the kind. An edge is one
relation: `from` and `to` (each a `{kind, name}`), `relation`, and `attributes`. There are 17 node kinds
and 23 relations; DOC-35 tables "Node kinds" and "Relations" define every one, and this plan's screens
must show them all.

An aggregate node's `details.machine`, when present, describes its state machine: `ownership` (`generated`
or `legacy-hole`), `initial`, `states` (each `name` and `terminal`), and `edges`, each with `source`,
`edgeIndex`, `target`, `mode` (`Live` serves new commands; `ReplayOnly` exists only so old events still
replay), `command` and `events`. A `legacy-hole` machine lists declared transitions whose hand-written
implementation is not proven to match. Documents from older keiro-dsl versions have no `machine`. The
`edgeIndex` is local to a source state and changes when transitions are reordered, so show it but never
use it as an identity in a URL.

The document describes the committed specification, not the running binary, and the host never checks that
the two agree. The screens must say this plainly.

The client side already exists, built by
`docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md`, which must be Complete
before this plan starts. From `@keiro-ui/client-keiro` this plan uses: `client.topology.load(signal)`,
which returns `{ summary, digest, document, index }` after verifying the document's bytes against the
host's digest and validating it; `keiroKeys.topology.loaded()`; the `TopologyIndex` methods `node(key)`,
`byKind(kind)`, `outgoing(key)` and `incoming(key)`; `topologyNodeKey(kind, name)`; the ordered constant
`TOPOLOGY_NODE_KINDS`; the typed detail views `aggregateDetails`, `processDetails`, `workflowDetails` and
`projectionOwnerDetails`; and the errors `RouteUnavailable` (the host serves no topology: it mounts none
or is too old to know the route, and the two are indistinguishable), `UnsupportedTopologySchema` (the
summary names a schema id this console does not understand), `TopologyDocumentInvalid` (an unknown node
kind or relation, a duplicate node or a dangling edge), `TopologyChanging` (the document changed between
reads twice running), and the predicates `isTooLarge`, `isSchemaDrift` and `isInspectionBusy`. If any of
these is missing from the working tree, stop: the prerequisite is not complete.

Test data also comes from that plan. The default mock serves the recorded `hospital-capacity` document
(25 nodes, 27 edges, five aggregates: `Capacity`, `Hospital`, `Reservation`, `Supply`, `Surge`).
`@keiro-ui/testing` exports helpers returning the other golden documents by name, including the `/2`
document `incident-command-sourced` with `feeds` edges and `projection-catalog` with the projection kinds,
and a helper computing a synthetic summary for given bytes. Component tests render a route with
`apps/console/src/test/render-route.tsx`; browser tests are Playwright specs under `apps/console/e2e/` using
`apps/console/e2e/support/mock.ts`; the multi-deployment suite is
`apps/console/e2e/multi-app/multi-app.spec.ts` with data in `dev/multi-app/inspection-fixtures.ts`.

Local ADRs that apply: [ADR-13](../adr/0013-honest-gates.md) requires a missing capability to be named as
such and never rendered as an empty or negative fact, and refusals to be shown as the server states them.
[ADR-12](../adr/0012-poll-first-live-queries.md) requires reads through `useSurfaceQuery`.
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps this read-only.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) and ADR-8 are described above.
The ADR created by the prerequisite plan (look in `docs/adr/` for the record about a served declaration
document being verified and rejected whole) explains why an invalid document shows nothing rather than
what could be parsed.

This is the second child of
`docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md`. Two later plans add to the
pages built here: `docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md` adds diagrams, and
`docs/plans/30-join-topology-declarations-to-live-inspection-screens.md` adds links to live data. Both rely
on the file locations and component names in the last section of this plan.


## Plan of Work

### Milestone 1: The section, the header and every state

Add `"topology"` to `SectionId` and a section titled "Service Topology" to `sections` in
`apps/console/src/shell/navigation.ts`, placed after Overview, with the `Network` icon, link `/topology`,
prefix `/topology`, and one page "Declarations". Add `links.topology()` and `links.topologyNode(kind,
name)` to `apps/console/src/lib/links.ts`. Register a feature in a new
`apps/console/src/features/topology/register.ts` contributing a palette command "Go to Service topology",
and call it from `apps/console/src/features/index.ts`.

Create `apps/console/src/features/topology/queries.ts` with `useServiceTopology()`. It calls
`useSurfaceQuery` with `surface: "keiro"`, `queryKey: keiroKeys.topology.loaded()`, `queryFn: ({ signal })
=> keiro.topology.load(signal)` and `poll: 60_000`. It returns a discriminated state for screens:
`not-configured` (the deployment has no keiro surface; no request is sent), `loading`, `ready` (with the
loaded topology), `not-served`, `unsupported-schema` (with the schema id), `invalid` (with the reason),
`too-large`, `changing`, and `failed` (with the error). A failed refetch after a successful load keeps the
loaded document and adds a stale flag, never an empty result.

Create `apps/console/src/features/topology/TopologyStates.tsx` rendering each non-ready state. Wording
follows ADR-13. Not served: "This keiro host serves no service topology", explaining that a host serves
one only when the application mounts a committed document (`--topology FILE` or in code), that hosts older
than the release that added the route answer the same way, and naming the probe `/keiro/topology/summary`.
Unsupported schema: name the schema id and say this console understands `/1` and `/2` and shows nothing
from a document it cannot fully read. Invalid: show the reason verbatim and say the document was rejected
whole. Too large: the host refused the result size and its operator can raise
`inspectionLimits.maxResponseBytes`; there is nothing to narrow. Changing: the document changed between
reads, the deployment is probably rolling, with a retry button. Failed: the server's code and message with
retry.

Create the route `apps/console/src/routes/_shell/topology/index.tsx`. In the ready state it shows a header
card: service name; schema id; source kind and path; generator tool and version; the effective language
version and runtime semantics; the document digest shortened with a copy control; the document size; and
the node and edge totals. Below it, a members table: path, digest (shortened, copyable), declared and
effective language version, with "none" for a `null` declared version. Under the header, a fixed caption:
"This describes the committed specification the host mounted, not the running binary. The host does not
check that they agree."

### Milestone 2: The declarations inventory

On the same route, below the header, list every node grouped by kind in the order of
`TOPOLOGY_NODE_KINDS`, each group headed by a readable kind label and its count, omitting kinds with no
nodes. A row shows the name, the `stableName` where the kind has one, the context, and the source location
as `member:line`. The row links to the node detail. Add a text filter and a kind filter held in the URL
search parameters `q` and `kind` (extend the shell's search schema the way other sections do, for example
`apps/console/src/features/streams/search.ts`), so a filtered view can be shared. The text filter matches
name and stable name, case-insensitively. A filter with no matches says no declarations match the filter;
it must not read as an empty service. Put the readable kind and relation labels in one module,
`apps/console/src/features/topology/labels.ts`, since later plans need the same words.

### Milestone 3: The node detail page

Create `apps/console/src/routes/_shell/topology/$kind/$name.tsx`. Route parameters are URL-encoded by the
router; look the node up with `index.node(topologyNodeKey(kind, name))`. An unknown kind or name shows "No
such declaration in the mounted document" with a link back, and the non-ready states reuse
`TopologyStates`.

The page shows, in order: a heading with the kind label and name; the context and source location; a
Details section; for aggregates, the machine section; a Relations section; and for aggregates, a "Read
models fed" section.

Details: render `details` generically in `apps/console/src/features/topology/NodeDetails.tsx`. Scalars as
labelled values, lists of scalars as inline lists, nested objects and lists of objects through
`JsonViewer`. Show `null` as "none", never as blank. Do not hide fields the console does not recognise.

Machine: create `apps/console/src/features/topology/AggregateMachineSection.tsx`, taking an aggregate
node. With no `machine`, say the document was produced by a keiro-dsl version that did not export
machines. Otherwise show the ownership, with a notice for `legacy-hole` that the transitions are declared
but the hand-written implementation is not proven to match; the states in declared order, marking the
initial state and terminal states; and a transitions table with columns source, command, events (in
emission order, "none" when empty), target, mode and edge index. Mark `ReplayOnly` rows with a badge and a
one-line explanation. This component is the single place a machine is rendered; a later plan adds a
diagram inside it and another reuses it on a live screen, so keep its only required prop the node.

Relations: in `apps/console/src/features/topology/NodeRelations.tsx`, two tables, "Outgoing" and
"Incoming", from `index.outgoing` and `index.incoming`. Columns: relation label, the other declaration
(kind label and name, linking to its detail page), and the edge's attributes as labelled values. Group
rows by relation. An empty direction says "None declared".

Read models fed: DOC-35 states how to find which read models an aggregate's events reach. Follow
`consumes` edges back from projection owners to the aggregate, `writes` from those owners to projection
targets, and `observes` or `backed-by` from read models to the same targets. Implement it as a pure
function `readModelsFedBy(index, aggregateKey)` in `apps/console/src/features/topology/trace.ts` returning
each read model with the owner and target on the path, and render it as a short list with links. When the
trace is empty say "No projection owner consumes this aggregate", which is a statement about the document.

### Milestone 4: Proof and documentation

Write `apps/console/src/features/topology/topology.test.tsx` covering: the header and members for the
recorded document; every state from Milestone 1 using mock overrides; grouping, counts and both filters;
a node detail for one node of each of several kinds including an aggregate with a machine, an aggregate
document without `machine`, and the `/2` document's `feeds` edges in both directions; the trace on the
`projection-catalog` golden; and a late failure keeping the loaded document with a stale notice. Write
`apps/console/e2e/topology/topology.spec.ts` for the navigation entry, palette command, filter-in-URL
round trip, and following a relation there and back. Extend `dev/multi-app/inspection-fixtures.ts` and
`apps/console/e2e/multi-app/multi-app.spec.ts` so two deployments serve different documents and a third
has no keiro surface: switching must never show the previous deployment's declarations, and the third
sends no topology request. Add a read-only case to `apps/console/e2e/live.spec.ts` that opens `/topology`
against the real stack and observes a real `/topology/summary` request.

Create `docs/capabilities/service-topology.md`. Run `okf id next docs/capabilities --profile
docs/capabilities/profile.dhall CAP` for the handle (it returned `CAP-12` on 2026-11-17) and copy the
frontmatter conventions of `docs/capabilities/process-manager-inspection.md`. Add a Service Topology
section to `docs/user/console-reference.md`. Advance timestamps and add `log.md` entries in both bundles.
Inspect a screenshot of the index and of one aggregate's detail page at 1440 by 1000.


## Concrete Steps

Run from the repository root inside `nix develop`. Keep `just stack-up` and `bun run dev` each in their
own terminal for live checks.

```bash
bun run --filter @keiro-ui/console generate-routes
bun run test --project console topology.test.tsx
bun run test:e2e -- topology
bun run test:e2e:multi-app
```

Final validation:

```bash
just stack-check
bun run check
bun run test
bun run build
bun run test:e2e
bun run test:e2e:multi-app
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
okf validate docs/user --strict --profile mori/user-documentation-profile.dhall --profile-enforce --log-enforce
cd apps/console && KEIRO_UI_LIVE=1 bunx playwright test --config playwright.live.config.ts
```

Commits follow Conventional Commits and carry these trailers:

```text
MasterPlan: docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md
ExecPlan: docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md
Intention: intention_01m7nqmcx2e4kvcke3377tcg7g
```


## Validation and Acceptance

With the stack and console running, `http://localhost:5173/topology` shows service `hospital-capacity`,
schema id `keiro-dsl/service-topology/1`, one member `hospital-capacity.keiro`, and 25 declarations whose
per-kind counts equal `node_counts` in `curl -fsS http://127.0.0.1:9093/topology/summary`. The digest
shown equals `document_sha256`. Typing `res` in the filter narrows the list and puts `q=res` in the URL;
reloading keeps it. Opening the `Reservation` aggregate shows six states and six transitions that match
the node in the golden file. Each relation row links to a declaration whose own page shows the same edge
in the opposite direction.

Stop the keiro host and restart it without `--topology`: the section shows the not-served state, no error
toast, and the rest of the console works. Restore the flag afterwards.

The automated suites named above pass, including the multi-deployment cases. No request other than `GET`
is added. Leaving the page open and idle for two minutes produces summary requests about once a minute and
no `/topology/show` request after the first.


## Idempotence and Recovery

All changes are additive: a new section, new route files, new feature files and documentation. Nothing
persisted in the browser changes shape. `routeTree.gen.ts` is generated; if it conflicts, regenerate it
instead of merging by hand. Reverting the commits removes the section with no other effect.


## Interfaces and Dependencies

Hard prerequisite: `docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md`
Complete. No new npm dependency.

What later plans rely on:

```typescript
// apps/console/src/features/topology/queries.ts
type ServiceTopologyState =
  | { status: "not-configured" } | { status: "loading" }
  | { status: "ready"; topology: LoadedTopology; stale: boolean }
  | { status: "not-served" } | { status: "unsupported-schema"; schemaId: string }
  | { status: "invalid"; reason: string } | { status: "too-large" } | { status: "changing" }
  | { status: "failed"; error: unknown }
function useServiceTopology(): ServiceTopologyState & { refetch(): void }

// apps/console/src/lib/links.ts
links.topology()
links.topologyNode(kind: TopologyNodeKind, name: string)

// apps/console/src/features/topology/labels.ts
function kindLabel(kind: TopologyNodeKind): string
function relationLabel(relation: TopologyRelation): string

// apps/console/src/features/topology/AggregateMachineSection.tsx
function AggregateMachineSection(props: { node: TopologyNode }): JSX.Element

// apps/console/src/features/topology/TopologyStates.tsx
function TopologyStateView(props: { state: Exclude<ServiceTopologyState, { status: "ready" }> }): JSX.Element
```

Route files `apps/console/src/routes/_shell/topology/index.tsx` and
`apps/console/src/routes/_shell/topology/$kind/$name.tsx` are owned here. Later plans add one section
component each to the node detail route and one sidebar page to the `topology` section.
