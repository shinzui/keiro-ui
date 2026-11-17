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
  revisions:
    - model: "claude-fable-5-2"
      harness: "claude-code"
      at: 2026-11-17T22:40:36Z
      mode: "implement"
      note: "Milestones 1 to 4 implemented and accepted"
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

- [x] M1 (prototype, 2026-11-17): The approach is accepted: `@dagrejs/dagre` 3.1.3 for placement, repository-owned SVG for drawing, with edge ends and self-loops routed by this repository. `apps/console/src/features/topology/graph/layout.test.ts` shows, for the whole graph of all five goldens and every machine in them, that every node is placed, no two boxes overlap, no label sits on a node, no edge crosses a node other than its own ends, and the result is identical across runs. Timings: a synthetic 300-node graph in 64 ms; a real service, mori (152 declarations, 315 relations, from `keiro-dsl topology`), in 106 ms. Screenshots of the hospital map, the `projection-catalog` map and the twelve-transition `Incident` machine were inspected.
- [x] M2 (2026-11-17): Aggregate pages draw the machine above the transitions table. The initial state has an entry arrow and the word `initial`; terminal states a double border and the word `terminal`; replay-only transitions the suffix `(replay only)` and a dashed arrow; self-transitions a loop between the state and its label. Selection in the diagram and the table stay in step.
- [x] M3 (2026-11-17): `/topology/map` draws the service with kind-group chips, a focus and a depth, all in the URL, and states what the view hides. Declaration pages draw their neighbourhood. A view of more than 80 declarations is not drawn and offers groups and a search; checked with a synthetic 115-node document and on the real 152-node mori document.
- [x] M4 (2026-11-17): `bun run check`, `bun run test` (801 passed, 15 skipped), `bun run build`, `nix build`, `bun run test:e2e` (66 passed) and the live suite (8 passed, 2 skipped as before) pass. A browser test confirms no drawn box overlaps another and every label fits its box in the real typeface. Light and dark screenshots of the map and of a machine were inspected. The map is operable by keyboard alone (browser test). Documentation is updated and validates strictly.


## Surprises & Discoveries

- 2026-11-17: dagre's raw edge routes cut across neighbouring nodes. Nodes of one rank share a centre
  and differ in width, so a line leaving a narrow node at an angle crosses a wider neighbour. The layout
  module now replaces each edge's two ends: it leaves and enters square to the node's side and turns
  only in a lane just outside its rank's widest node. dagre's interior points are kept. The layout tests
  assert that no edge crosses a foreign node.

- 2026-11-17: dagre draws a self-loop as a small curve that the edge's label then covers, so
  self-transitions were invisible. They are drawn as a staple between the state and its label instead.

- 2026-11-17: The theme's `--chart-1` to `--chart-5` tokens are a grey ramp and cannot tell five kind
  groups apart. The map uses the palette hues the console already uses for status (sky, violet, emerald,
  amber, rose), each with a dark-theme variant, and writes the group on every node.

- 2026-11-17: No golden contains a `ReplayOnly` transition. The replay-only marking is covered by a
  synthetic machine, named synthetic in `graph.test.tsx`.

- 2026-11-17: react-aria's table rows set `data-selected` themselves, and TanStack Router's `Link`
  manages `aria-current`. The transitions table marks its highlighted row with
  `data-transition-selected`, and filter chips use `data-selected`.

- 2026-11-17: The first lucide icon in a toolbar is also an `svg`, so tests must select the diagram with
  `svg[role="group"]`.

- 2026-11-17: Real-document evidence. `keiro-dsl topology` accepted mori's workspace and wrote 152
  declarations and 315 relations: 15 aggregates, 28 projection owners, 90 projection targets, 12 rebuild
  groups, 6 read models and one contract. Laid out whole it is 2061 by 11742 pixels, which confirms the
  threshold: the map refuses it, the State group (15) draws, and the Projections group (136) is itself
  too large and is reached through a focus. The file is `.dev/mori.topology.json`, git-ignored; the
  layout test over it is skipped when the file is absent.

- 2026-11-17: Routes are code-split, so dagre ships in a lazily loaded chunk (`ServiceMap-*.js`, 59.84
  kB, about 20 kB gzipped) that loads only on topology pages that draw.


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


- Decision: Keep dagre; route edge ends and self-loops in this repository's layout module.
  Rationale: The prototype's assertions pass on every golden and on a real 152-node document within
  the time budget, and the screenshots are legible once edges turn in rank lanes. `elkjs` was not needed.
  No new ADR, because the approach in this Decision Log stands.
  Date: 2026-11-17

- Decision: The prototype was inspected on the real routes instead of a temporary route.
  Rationale: The pure layout module and its tests came first; the components were then small enough to
  build directly, and screenshots of them against the live stack and against other goldens (served by
  intercepting the two topology requests) answered the legibility question. Nothing temporary was
  committed.
  Date: 2026-11-17

- Decision: The 80-node threshold applies to the view, after groups and focus, not to the document.
  Rationale: A large service narrowed to one small group or one neighbourhood is legible; a large group
  is not. The page offers each group with its count and a declaration search.
  Date: 2026-11-17

- Decision: Zoom changes the drawn size inside a scrolling viewport; drag-to-pan scrolls it.
  Rationale: Native scrolling gives panning, keyboard scrolling and touch for free, and keeps text at
  the size the layout assumed at 100%. "Fit" scales the drawing to the viewport's width.
  Date: 2026-11-17

- Decision: Identical relations between the same two declarations are shown once with a count
  (`dispatches ×2`), and lines may share a lane between columns.
  Rationale: One label per relation instance made dense pairs unreadable. Every relation is still
  counted in the "Drawing N of M relations" line, and selecting a declaration highlights its own lines.
  Date: 2026-11-17

- Decision: One shared `DiagramBoundary` wraps every diagram.
  Rationale: The neighbourhood on a declaration's page can fail as the machine diagram can. Each
  failure names the tables that still carry the information.
  Date: 2026-11-17


## Outcomes & Retrospective

Completed 2026-11-17. An operator can open `/topology/map`, see the service drawn along its relations,
narrow it by kind group or to a declaration's neighbourhood, and read each aggregate's machine as a
diagram above its table. Every diagram repeats a table, and a diagram that cannot be drawn leaves the
tables.

Bundle: the main chunk went from 372.67 kB to 373.77 kB (114.31 kB gzipped before). dagre and the
diagram code are a separate chunk of 59.84 kB loaded only by the topology pages that draw.

Interfaces differ from the plan's sketch in small ways: `GraphLayout` nodes and edge labels carry their
size; `layoutGraph` drops edges naming an absent node; `ServiceMap` takes `onFocus` and `maxHeight`;
`MapPage` holds the route's controls; `mapView`, `relationLines`, `machineGraph`, `transitionId` and
`MAP_NODE_THRESHOLD` are exported for tests and reuse. `AggregateMachineSection`'s props are unchanged.

No friction entry was recorded under this plan.

Known limits, stated in the capability page: lines that run the same way between two columns can share
a path, and a group larger than the threshold is reachable only through a focus.


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
