---
id: 29
slug: draw-the-service-map-and-aggregate-state-machines
title: "Draw the service map and aggregate state machines"
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

# Draw the service map and aggregate state machines

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

The console can list a service's declarations and relations as tables. Tables answer "what does this
declaration relate to" but not "how does a message travel through this service" or "what does this
aggregate's lifecycle look like". After this plan an operator can open a map that draws the service's
declarations and relations, focus it on one declaration's neighbourhood, and see each aggregate's state
machine as a diagram with its initial and terminal states, the command and events on every transition, and
replay-only transitions marked.

To see it working, start the local stack and console, open `http://localhost:5173/topology/map`, and see
the `hospital-capacity` service drawn left to right. Select the `Reservation` aggregate to highlight what
it touches, open it, and see its six states and six transitions as a diagram above the transitions table.


## Progress

- [ ] M1 (prototype): The layout approach is accepted or replaced. All five golden documents and every aggregate machine in them lay out deterministically without overlapping nodes, within the time budget, and a screenshot of the largest is legible.
- [ ] M2: Aggregate node pages show the machine diagram above the transitions table, with initial, terminal, replay-only and self-transitions distinguishable without colour.
- [ ] M3: `/topology/map` draws the service with kind-group filters and a focus mode, and node pages show their neighbourhood; large documents open focused instead of drawing everything.
- [ ] M4: Browser and live checks pass in light and dark themes, keyboard navigation works, and the documentation is updated.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Lay out with `@dagrejs/dagre` and render with repository-owned SVG components, subject to the
  Milestone 1 prototype.
  Rationale: Dagre computes layered layouts as pure functions from node sizes, so layouts can be unit
  tested without a browser. Owning the SVG keeps diagrams in the console's design tokens and single
  typeface and keeps them keyboard-accessible. A canvas framework would measure the DOM, resist testing in
  jsdom and bring its own styling.
  Date: 2026-11-17

- Decision: Diagrams never carry information that is absent from the text screens.
  Rationale: The relation tables and transitions table are the accessible equivalent; a diagram that fails
  to render must cost the operator nothing but the picture.
  Date: 2026-11-17

- Decision: Above 80 nodes the map opens in focus mode on a chosen declaration or kind group instead of
  drawing the whole service.
  Rationale: Real services have hundreds of declarations, and a full layered drawing of them is illegible
  and slow. The threshold is a starting value to be confirmed by the prototype.
  Date: 2026-11-17


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

This repository builds a static React console for the keiro runtime. The application is `apps/console`;
routes are files under `apps/console/src/routes/_shell/` (run `bun run --filter @keiro-ui/console
generate-routes` after adding one), and each screen area has a directory under
`apps/console/src/features/`. UI primitives come only from `packages/ui`, and Paper Mono is the console's
single typeface ([ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)).
Because the typeface is monospaced, the width of a label is its character count times a fixed advance
width, which lets node sizes be computed without measuring the DOM. Colours come from the CSS variables in
`apps/console/src/styles.css` and `packages/ui/src/styles`, which switch with the light and dark theme
(`apps/console/src/shell/theme.tsx`).

The service topology is a JSON document a keiro host serves, describing a service's specification as
nodes (declarations) and edges (relations). Its contract is
`mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`; run `mori registry show shinzui/keiro
--full` for the checkout and open `docs/user/keiro-dsl-service-topology.md`. A node has `kind` (one of 17,
such as `aggregate`, `process`, `workflow`, `intake`, `read-model`), `name`, and `details`. An edge has
`from` and `to` (each `{kind, name}`), `relation` (one of 23, such as `dispatches`, `consumes`, `writes`,
`feeds`) and `attributes`. Several edges may join the same two nodes with different relations.

An aggregate node's `details.machine`, when present, is its state machine: `ownership` (`generated` or
`legacy-hole`), `initial` (a state name), `states` (each `name` and `terminal`), and `edges`, each with
`source`, `edgeIndex`, `target`, `mode` (`Live` or `ReplayOnly`), `command` and `events`. A transition may
start and end in the same state. Several transitions may join the same two states. `ReplayOnly`
transitions exist only so old events still replay and do not serve new commands. A `legacy-hole` machine
lists declared transitions whose hand-written implementation is not proven to match
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-63`). Older documents have no `machine`.

The console already reads and shows this document as text, built by two plans that must be Complete
before this one starts: `docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md`
(the client) and `docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md` (the screens).
From them this plan uses:

- `useServiceTopology()` in `apps/console/src/features/topology/queries.ts`, returning a state whose
  `ready` form carries `topology.index`; and `TopologyStateView` in
  `apps/console/src/features/topology/TopologyStates.tsx` for every other state.
- `TopologyIndex` from `@keiro-ui/client-keiro`: `node(key)`, `byKind(kind)`, `outgoing(key)`,
  `incoming(key)`; `topologyNodeKey(kind, name)`; `TOPOLOGY_NODE_KINDS`; `aggregateDetails(node)` for the
  typed machine.
- `kindLabel` and `relationLabel` in `apps/console/src/features/topology/labels.ts`, and
  `links.topologyNode(kind, name)` in `apps/console/src/lib/links.ts`.
- `AggregateMachineSection` in `apps/console/src/features/topology/AggregateMachineSection.tsx`, which
  renders a machine as a transitions table and is the single place a machine is shown. This plan adds the
  diagram inside it.
- The node detail route `apps/console/src/routes/_shell/topology/$kind/$name.tsx` and the `topology`
  section in `apps/console/src/shell/navigation.ts`.

If any of these is missing from the working tree, stop: a prerequisite is not complete.

Test documents: the default mock serves `hospital-capacity` (25 nodes, 27 edges; aggregates with up to six
states and seven transitions). `@keiro-ui/testing` returns the other goldens by name:
`incident-command-sourced` (27 nodes, 32 edges, an aggregate with twelve transitions and `feeds` edges),
`projection-catalog` (20 nodes, 37 edges, the densest), `incident-command` and the `workspace` document.

Local ADRs that apply: ADR-8 as above. [ADR-13](../adr/0013-honest-gates.md) requires absent information
to be stated, so a missing machine or an unavailable topology is said, not drawn as an empty diagram.
[ADR-14](../adr/0014-static-nix-packages-and-layered-linux-images.md) means the new npm dependency also
requires regenerating `bun-deps.nix` with `just nix-deps`.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) means internal links must use
the link builders so the selected deployment survives. No ADR covers diagram rendering; this plan records
one only if the prototype overturns the approach in its Decision Log.

This is the third child of
`docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md`. A sibling,
`docs/plans/30-join-topology-declarations-to-live-inspection-screens.md`, may run at the same time. It
adds a different section to the node detail route and reuses `AggregateMachineSection`, so the diagram
added here appears there with no further work. Expect at most a trivial textual merge in the route file.


## Plan of Work

### Milestone 1 (prototype): Decide the layout approach

This milestone answers one question: does a layered layout from dagre, drawn as our own SVG, give legible
diagrams for both the service graph and the machines? It is bounded to the pure layout module, its tests
and a throwaway page.

Add `@dagrejs/dagre` to `apps/console` pinned to the exact current release on the npm registry. Create
`apps/console/src/features/topology/graph/layout.ts` exporting a pure function that takes nodes (id,
label lines, optional group), edges (id, source, target, label lines) and a direction, and returns each
node's box, each edge's points and label position, and the overall size. Node size comes from label length
times the typeface advance width plus padding; no DOM measurement. Use dagre's multigraph mode so parallel
edges stay distinct, and handle self-transitions explicitly if dagre's own routing is poor, by drawing a
loop on the node's side.

Write `apps/console/src/features/topology/graph/layout.test.ts` asserting, for the whole graph of each
golden and for every machine in them: every node is placed; no two node boxes overlap; the result is
identical across runs; and layout completes within 200 milliseconds for the largest. Render the two
hardest cases (the `projection-catalog` service graph and the twelve-transition `Incident` machine) on a
temporary route and inspect screenshots.

If a real large document is available, try it: with a checkout of `mori://shinzui/mori` and keiro's
`keiro-dsl` executable built, `keiro-dsl topology <mori checkout>/domain/mori.keiro-workspace --format
json` produces one. Use it to set the node threshold above which the map opens focused, and to confirm
that a focused neighbourhood stays legible. This is optional evidence; do not block on it.

Accept the approach if the assertions pass and the screenshots are legible without manual adjustment.
Otherwise record why in the Decision Log, replace the layout engine behind the same `layout.ts` signature
(`elkjs` is the alternative, at the cost of bundle size and an asynchronous API), record the choice in a
new ADR, and re-run this milestone. Remove the temporary route either way.

### Milestone 2: The machine diagram

Create `apps/console/src/features/topology/graph/GraphCanvas.tsx`, the shared SVG renderer. It takes a
layout result and render callbacks for nodes and edges, draws into an SVG with a `viewBox` equal to the
layout's size, and offers fit-to-view, zoom in and out, and drag-to-pan, each also reachable by a button.
Nodes are focusable in a sensible order; arrow keys move focus along edges, and Enter activates. The SVG
has an accessible name and a description pointing to the table that carries the same information. Colours
come from theme variables only.

Create `apps/console/src/features/topology/graph/MachineDiagram.tsx`. States are nodes in declared order,
laid out left to right. The initial state has an entry marker; terminal states have a double border; both
also carry a text marker so the distinction does not depend on shape recognition alone. Each transition is
an edge labelled with the command on one line and its events on the next, or "no events". Transitions
sharing a source and target are drawn as one edge with stacked labels, so the picture stays readable; each
label keeps its own mode. `ReplayOnly` transitions are dashed and suffixed "(replay only)", with a legend.
Selecting a transition highlights the matching row of the transitions table, and selecting a row
highlights the transition.

Mount `MachineDiagram` inside `AggregateMachineSection`, above the existing table, only when the machine
is present. Keep the `legacy-hole` notice and the no-machine message from that component unchanged. If
layout throws, show the table alone with a short note that the diagram could not be drawn.

### Milestone 3: The service map and neighbourhoods

Create `apps/console/src/features/topology/graph/ServiceMap.tsx` and the route
`apps/console/src/routes/_shell/topology/map.tsx`, and add a "Map" page to the `topology` section's
sidebar. Add `links.topologyMap(search?)` to `apps/console/src/lib/links.ts`.

The map lays declarations out left to right following relation direction. Nodes show the kind label and
name and are tinted by kind group; the group is also written on the node. The groups are: Messaging
(`contract`, `intake`, `emit`, `publisher`), Coordination (`process`, `router`, `workflow`, `operation`),
State (`aggregate`), Queues (`dispatch`, `workqueue`), and Projections (`projection-owner`,
`projection-target`, `rebuild-group`, `projection-revision`, `read-model`, `external-read`). Put the
grouping in `apps/console/src/features/topology/labels.ts` beside the labels. Edges are labelled with the
relation; parallel relations between the same two nodes share one edge with stacked labels.

Controls, all held in URL search parameters so a view can be shared: `groups` (which kind groups are
shown; all by default), `focus` (a node key) and `depth` (1 or 2). With a focus, only the declarations
within that many relations of the focused one are drawn, in either direction. Selecting a node highlights
it and its direct relations and shows a small panel with its name, kind and a link to its detail page;
activating it (double-click or Enter) sets it as the focus. When the document has more nodes than the
threshold and no focus is set, the route does not draw the whole graph: it explains that the service is
too large to draw whole and offers the kind groups and a declaration search as starting points. Edges
whose other end is filtered out are omitted, and the map states how many declarations and relations are
hidden by the current filters so the picture is never mistaken for the whole service.

On the node detail route, add a "Neighbourhood" section rendering the same component focused on that node
at depth 1, with a link to open it in the full map.

### Milestone 4: Proof and documentation

Extend `apps/console/src/features/topology/topology.test.tsx` or add `graph.test.tsx` beside it: the
machine diagram renders one node per state and one label per transition for a hospital aggregate; replay
and terminal markers are present as text; a machine with a self-transition and with parallel transitions
renders; table and diagram selection stay in step; the map applies group, focus and depth from the URL and
reports hidden counts; the oversize rule is exercised with a synthetic document above the threshold; a
layout failure falls back to the table. Extend `apps/console/e2e/topology/topology.spec.ts` with opening
the map, focusing by keyboard, following a node to its page, and a screenshot of the map and of a machine
in both themes, which must be inspected, not merely captured. Add a read-only case to
`apps/console/e2e/live.spec.ts` opening `/topology/map` against the real stack.

Update `docs/capabilities/service-topology.md` and the Service Topology section of
`docs/user/console-reference.md` with the map, its controls and the machine diagram, including what the
replay-only and unproven markers mean. Advance timestamps and add `log.md` entries.


## Concrete Steps

Run from the repository root inside `nix develop`.

```bash
bun add --exact --cwd apps/console @dagrejs/dagre
just nix-deps
bun run test --project console layout.test.ts
bun run --filter @keiro-ui/console generate-routes
bun run test --project console topology
bun run test:e2e -- topology
```

Optional large-document evidence for Milestone 1, from the keiro checkout's development shell:

```bash
cabal run -v0 exe:keiro-dsl -- topology "$MORI_REPO/domain/mori.keiro-workspace" --format json > /tmp/mori.topology.json
```

If the command refuses the specification, note the diagnostic in Surprises & Discoveries and continue
without it.

Final validation:

```bash
bun run check
bun run test
bun run build
bun run test:e2e
okf validate docs/capabilities --strict --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce
okf validate docs/user --strict --profile mori/user-documentation-profile.dhall --profile-enforce --log-enforce
cd apps/console && KEIRO_UI_LIVE=1 bunx playwright test --config playwright.live.config.ts
```

Compare the production bundle size before and after (`bun run build` prints chunk sizes) and record the
difference in Outcomes & Retrospective.

Commits follow Conventional Commits and carry these trailers:

```text
MasterPlan: docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md
ExecPlan: docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md
Intention: intention_01m7nqmcx2e4kvcke3377tcg7g
```


## Validation and Acceptance

With the stack and console running, `http://localhost:5173/topology/map` draws all 25 `hospital-capacity`
declarations with no overlapping boxes, and every one of the document's 27 relations appears as an edge
label. Turning off the Projections group removes those nodes, updates the URL, and the hidden count
changes accordingly. Setting the focus to the `Reservation` aggregate at depth 1 leaves exactly the
declarations that the Relations tables on its detail page list. Reloading keeps the view.

On `http://localhost:5173/topology/aggregate/Reservation` the diagram shows six states and six transition
labels matching the table below it; the initial state is marked; selecting a table row highlights the
transition. In the `incident-command-sourced` document (through the test suite) a replay-only transition,
if the golden contains one, is dashed and labelled; otherwise a synthetic machine covers it and is named
synthetic in the test.

Everything is operable by keyboard alone, and both themes are legible in the inspected screenshots. The
existing topology tables are unchanged. The layout tests, component tests, browser tests and live case
pass, and the Nix package builds from the regenerated `bun-deps.nix`.


## Idempotence and Recovery

Changes are additive: one dependency, a `graph/` directory, one route, one sidebar entry, and one
insertion each into `AggregateMachineSection` and the node detail route. Removing the insertion lines
restores the text-only screens. The dependency is reverted by removing it from
`apps/console/package.json`, running `bun install` and `just nix-deps`. The prototype's temporary route
must not be committed.


## Interfaces and Dependencies

Hard prerequisite: `docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md` Complete (which
itself requires `docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md`). New
npm dependency: `@dagrejs/dagre` in `apps/console`.

New modules, all under `apps/console/src/features/topology/graph/`:

```typescript
// layout.ts
interface LayoutNode { id: string; lines: string[]; group?: string }
interface LayoutEdge { id: string; source: string; target: string; lines: string[] }
interface GraphLayout {
  width: number; height: number
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>
  edges: Array<{ id: string; points: Array<{ x: number; y: number }>; label?: { x: number; y: number } }>
}
function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[], direction: "LR" | "TB"): GraphLayout

// MachineDiagram.tsx
function MachineDiagram(props: { machine: AggregateMachine; selected?: string; onSelect?(id: string): void }): JSX.Element

// ServiceMap.tsx
function ServiceMap(props: { index: TopologyIndex; groups?: string[]; focus?: string; depth?: 1 | 2 }): JSX.Element
```

`AggregateMachineSection`'s props do not change, so any screen that already renders it gains the diagram.
