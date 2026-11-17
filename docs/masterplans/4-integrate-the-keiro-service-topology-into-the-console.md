---
id: 4
slug: integrate-the-keiro-service-topology-into-the-console
title: "Integrate the Keiro service topology into the console"
kind: master-plan
created_at: 2026-11-17T21:49:45Z
intention: "intention_01m7nqmcx2e4kvcke3377tcg7g"
provenance:
  created_by:
    model: "claude-fable-5-2"
    harness: "claude-code"
    at: 2026-11-17T21:49:45Z
---

# Integrate the Keiro service topology into the console

This MasterPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Vision & Scope

Keiro can now describe how a service's parts connect. `keiro-dsl topology` writes one JSON document, the
service topology, listing every declaration in a service's specification (aggregates, processes, workflows,
routers, intakes, emits, queues, projections, read models and more) as nodes, and every relation between them
as edges. Each aggregate node carries its state machine. A keiro inspection host can mount a committed copy
and serve it at `GET /topology/summary` and `GET /topology/show`. Today the console knows nothing about
these routes. An operator sees live instances screen by screen but cannot see what the service is made of or
how a workflow, a process and a read model relate.

After this initiative, the console has a Service Topology section. An operator opens it and sees which
service and specification the selected host mounted, every declaration grouped by kind, and for any
declaration its details, its relations in both directions and where it is declared in the specification
source. A map draws the service or the neighbourhood of one declaration, and each aggregate shows its state
machine as a diagram. Declarations link to the live screens they correspond to, live screens link back to
their declaration, and the console says so when the mounted document and the running host disagree. A host
that mounts no topology, or serves a document the console cannot read, is reported as exactly that.

The upstream contract is `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`, whose section
"Handoff for keiro-ui" is the direct input to this work, with the serving guide
`mori://shinzui/keiro/okf/guides/concepts/DOC-30` and the decisions
`mori://shinzui/keiro/okf/adrs/concepts/ADR-62` (the document is a versioned contract and consumers fail
closed), `mori://shinzui/keiro/okf/adrs/concepts/ADR-63` (machines are derived from the specification and
proven against the compiled transducers) and `mori://shinzui/keiro/okf/adrs/concepts/ADR-64` (declared input
sources are checked documentation, exported as `feeds` edges under schema id `/2`). The serving routes were
added by `mori://shinzui/keiro/plans/342-serve-the-committed-service-topology-to-keiro-ui-through-keiro-ops-http`.
On 2026-11-17 this work was at keiro commit `43c9cdcb`, 29 commits after the 0.25.1.0 release and not yet
released.

Excluded, each deliberately:

- No change to keiro or any other repository. Gaps found upstream are reported, not patched here.
- No mutation. Every new request is a `GET`, consistent with [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md).
- No live links for `workqueue`, `intake` or `emit` nodes. DOC-35 lists these joins as not guaranteed, and a
  link would be a guess.
- No "current state" highlight on a machine diagram from an aggregate instance's `state_label`. That label
  comes from an application callback, and nothing upstream guarantees it equals a machine state name.
- No specification source viewer. The host serves no source text, so `member` and `line` are shown as a
  location only.
- No freshness verdict. The host never checks that the document matches the binary; the console reports only
  the disagreement it can observe (aggregate categories against mounted aggregate types).
- No comparison of topologies across deployments, and no console release.


## Decomposition Strategy

The work divides by what an operator can verify at each step. First the client can read the document
safely; nothing is visible, but the two reads, digest verification and fail-closed validation are proven
against a real host. Then the document is browsable as text, which is already a complete, accessible
feature. Then it is drawn. Then it is connected to live data. Each step ships alone and each has its own
acceptance against the running stack.

Reading is separate from browsing because it carries the uncertain producer/consumer interface (exact
bytes, a digest computed in the browser, a vocabulary the client must reject when unknown) and because
every other plan consumes it. Drawing is separate from browsing because it brings the initiative's only
new rendering dependency and a layout question that needs a bounded prototype; the text screens must not
wait on it, and they remain the accessible equivalent of every diagram. Joining is separate because it
touches the existing aggregate, process-manager, workflow and projection screens and needs a different
host to prove (a real keiro-dsl service), where the first three plans are proven with keiro's golden
documents.

Alternatives rejected: one plan for the whole page, because a single plan would hide four separately
verifiable behaviours and would serialize the diagram behind the joins. Folding the client into the browse
plan, because the read is consumed by three plans and its byte-level proof has nothing to do with screens.
Splitting the service map and the machine diagram into two plans, because they share one layout and
rendering component and would have to modify it together.

Relevant local ADRs: [ADR-1](../adr/0001-inspection-endpoints-live-in-the-owning-project.md) and
[ADR-5](../adr/0005-no-backend-for-frontend.md) mean the console reads keiro's routes directly through
`packages/client-keiro` and adds no server, so parsing, hashing and indexing happen in the browser.
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md) keeps this initiative read-only.
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md) makes
`packages/ui` the only source of UI primitives and Paper Mono the single typeface, which the diagrams rely
on for text measurement. [ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md) governs the
summary's integers. [ADR-11](../adr/0011-one-error-shape-over-three-envelopes.md) governs error
normalisation. [ADR-12](../adr/0012-poll-first-live-queries.md) requires reads to go through
`useSurfaceQuery`. [ADR-13](../adr/0013-honest-gates.md) requires a missing capability to be named and
never shown as an empty fact; an unmounted topology is such a capability.
[ADR-14](../adr/0014-static-nix-packages-and-layered-linux-images.md) means every new npm dependency also
changes `bun.lock` and `bun-deps.nix`. [ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md)
means each deployment has its own document and nothing may leak between targets.

No existing local ADR covers how the console treats a served declaration document. EP-27 creates one (see
Integration Points).


## Exec-Plan Registry

| # | Title | Path | Hard Deps | Soft Deps | Status |
|---|-------|------|-----------|-----------|--------|
| 27 | Read and verify the served service topology in the Keiro client | docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md | None | None | Not Started |
| 28 | Browse a service's declared topology in the console | docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md | EP-27 | None | Not Started |
| 29 | Draw the service map and aggregate state machines | docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md | EP-28 | None | Not Started |
| 30 | Join topology declarations to live inspection screens | docs/plans/30-join-topology-declarations-to-live-inspection-screens.md | EP-28 | EP-29 | Not Started |

Status values: Not Started, In Progress, Complete, Cancelled.
Rows use each child's repository plan number, so EP-27 means `docs/plans/27-...`.
A whole-child hard dependency requires that child to be Complete.


## Dependency Graph

EP-27 comes first. EP-28 needs its client reads, the validated document type, the index over nodes and
edges, the recorded fixtures and the local host that mounts a document. Without them a screen would have
nothing truthful to render or test against.

EP-28 comes second. EP-29 and EP-30 both add to the pages it creates: the `/topology` section, the node
detail route, the shared `useServiceTopology` hook, the link builders and the aggregate machine section.

Once EP-28 is Complete, EP-29 and EP-30 can proceed in parallel. EP-30's soft dependency on EP-29 is only
that the declaration panel it adds to the live aggregate screen shows the diagram if EP-29 has landed and
the transitions table if it has not; the shared component described under Integration Points makes either
order work without a second edit.

```text
EP-27 ── EP-28 ──┬── EP-29
                 └── EP-30   (soft: EP-29)
```


## Integration Points

**The client surface (`packages/client-keiro`).** EP-27 owns `src/topology.ts` (schemas, the document
type, `indexTopology`, `topologyNodeKey`, the typed errors), the `topology` namespace in `src/client.ts`,
`keiroKeys.topology` in `src/query-keys.ts`, and the addition of `topology` to `HOOK_GATED_WORDS` in
`src/errors.ts`. EP-28, EP-29 and EP-30 consume these and add no client members. If a later plan needs a
typed view of another node kind's `details`, it adds a schema beside the existing per-kind ones in
`src/topology.ts` and changes no existing one.

**The raw read (`packages/client-core/src/http.ts`).** EP-27 adds `HttpClient.getRaw`, which returns a
response's exact bytes. No other plan changes the HTTP client.

**Fixtures and the local host.** EP-27 owns the `topology-summary` and `topology-show` entries in
`packages/testing/manifests/keiro.json`, the copied golden documents under `packages/testing/topology/`,
and the `--topology` argument on the default profile's keiro host in `dev/process-compose.yaml`. EP-30 owns
the mori profile's generated document (`dev/process-compose.mori.yaml`, `dev/build.sh`) and the synthetic
"joined" mock scenario. Recording stays single-writer per plan: a plan that adds manifest entries records
keiro only, without reseeding, so existing pins hold.

**The topology feature (`apps/console/src/features/topology/`).** EP-28 owns `queries.ts`
(`useServiceTopology`, the single way any screen obtains the document), the state components for
unmounted, unsupported, invalid, oversize and changing documents, `links.topology*` in
`apps/console/src/lib/links.ts`, the `topology` section in `apps/console/src/shell/navigation.ts`, and the
route files `apps/console/src/routes/_shell/topology/index.tsx` and `$kind/$name.tsx`. EP-29 adds
`apps/console/src/routes/_shell/topology/map.tsx`, a sidebar entry and the `graph/` directory. EP-30 adds
`joins.ts` and its panels.

**The aggregate machine section.** EP-28 defines `AggregateMachineSection` in
`apps/console/src/features/topology/AggregateMachineSection.tsx`, which renders a machine as a transitions
table. EP-29 adds the diagram inside that component, above the table. EP-30 reuses the component on the
live aggregate screen. Because both later plans go through this one component, neither needs to know
whether the other has landed.

**The node detail page.** EP-29 adds a neighbourhood map section and EP-30 adds a live-links section to
`$kind/$name.tsx`. Each adds one self-contained component and one line in the route; expect a trivial
textual merge if run in parallel.

**Documentation.** EP-28 creates the capability page `docs/capabilities/service-topology.md` (handle
`CAP-12`, to be confirmed with `okf id next` at the time) and the Service Topology section of
`docs/user/console-reference.md`. EP-29 and EP-30 each extend those. EP-30 owns the follow-ups upstream
asked for: the integration guide `docs/user/application-integration.md` and the capability pages for
aggregate, process-manager and workflow inspection and projection monitoring. EP-27 owns `dev/README.md`
and the client README. Every plan adds its own entries to the bundles' `log.md`.

**ADRs.** EP-27 creates a new ADR (handle `ADR-16`, to be confirmed with `okf id next`) recording that a
served declaration document is verified against its digest before use and rejected whole when its schema
id, a node kind or a relation is unknown. EP-30 amends that ADR with the join rule: a declaration links to
live state only through a field the owning project guarantees, and disagreement between document and host
is shown. EP-29 records the diagram rendering choice in a new ADR only if its prototype changes the
approach stated in that plan.

**The representative producer/consumer check.** Owned by EP-27 Milestone 1: the client reads
`/topology/summary` and `/topology/show` from a locally built `jitsurei-ops-http --topology`, the bytes
hash to the summary's `document_sha256`, they equal keiro's golden file byte for byte, and the document
passes the client's validation. It runs before fixtures are recorded and before any screen is built. A
body that differs from what the child plans describe changes those plans first.

**Version skew.** Topology routes exist only on hosts newer than 0.25.1.0 that also mount a document. An
older host and an unmounted host refuse the command the same way, so the console says the host serves no
topology and does not guess which. EP-27 implements the classification; every screen in EP-28 to EP-30
that reads the topology outside the Service Topology section (the reverse panels) must stay silent rather
than show an error when it is absent.


## Progress

No child plan has started. EP-27 is ready; EP-28, EP-29 and EP-30 are blocked on their hard dependencies.

Integration gate, outside any single child: with all four children complete, the read-only live browser
suite (`cd apps/console && KEIRO_UI_LIVE=1 bunx playwright test --config playwright.live.config.ts`)
passes against the default stack with `/topology` showing the mounted document, its map and a machine
diagram, and the disagreement notice naming the host's aggregates; and against the mori profile, if EP-30's
real-service check was accepted, with a workflow declaration linking to live instances.


## Surprises & Discoveries

- 2026-11-17: keiro's demo host Jitsurei is hand-written and has no specification, so the document the
  default stack serves describes another service (`hospital-capacity`) and none of its nodes join to
  Jitsurei's data. This is useful rather than a defect: the default stack is a permanent live example of a
  document that disagrees with its host. Positive joins need a keiro-dsl service, which is why EP-30 uses
  the mori profile and a synthetic mock scenario.

- 2026-11-17: `packages/client-core`'s HTTP client reads every response as text and parses it. The handoff
  requires hashing the raw response bytes, and `Response.text()` strips a byte-order mark and replaces
  invalid sequences, so EP-27 adds a byte-exact read instead of hashing re-encoded text.

- 2026-11-17: `crypto.subtle` exists only in secure contexts (HTTPS or localhost). A console served over
  plain HTTP inside a network would have no SHA-256, so EP-27 uses a pure implementation in every context.


## Decision Log

- Decision: Build against keiro's unreleased topology routes now, with an absent route as a first-class
  state.
  Rationale: The routes are committed with tests and a published contract, the handoff was written for this
  console, and the console must handle hosts without the routes in any case because one console may face
  hosts at different versions. Released hosts behave as they do today. The risk is an upstream change
  before release, bounded by EP-27's producer/consumer check and a re-record.
  Date: 2026-11-17

- Decision: Four child plans in the order read, browse, draw, join.
  Rationale: Each is one operator-verifiable behaviour; reading carries the uncertain interface and is
  consumed by all; the text screens are complete without diagrams; joins need a different host to prove.
  Date: 2026-11-17

- Decision: Link a declaration to live state only through the four joins DOC-35 traces to code (aggregate
  category, process saga category, workflow stable name, projection-owner subscription). Leave `workqueue`,
  `intake`, `emit` and the instance `state_label` unlinked and say why on screen.
  Rationale: A wrong link is worse than no link in an operator tool, and upstream states these are not
  guaranteed. Each can be added when upstream guarantees it.
  Date: 2026-11-17

- Decision: Diagrams are repository-owned SVG laid out by `@dagrejs/dagre`, validated by a prototype
  milestone in EP-29, and never the only way to reach information.
  Rationale: A layout-only dependency keeps rendering in the console's own tokens and typeface, computes
  positions without a browser so layouts are unit-testable, and avoids a canvas framework that measures the
  DOM. The relation tables from EP-28 remain the accessible equivalent.
  Date: 2026-11-17


## Outcomes & Retrospective

(To be filled during and after implementation.)
