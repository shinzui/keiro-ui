---
title: Service topology
type: Capability
timestamp: 2026-11-17T23:10:00Z
reviews:
  - kind: model
    reviewer: claude-code/claude-fable-5-2
    reviewed_at: 2026-11-17T23:10:00Z
    document_timestamp: 2026-11-17T23:10:00Z
    scope: catalog-metadata
    outcome: commented
    context: Checked the unique CAP handle, owning provider, workspace package names and evidence resource paths by the model that wrote the page; this is not an independent behavioral review.
    provider: anthropic
    model: claude-fable-5-2
    effort: unspecified
description: Browse the service topology a keiro host mounts — every declaration of the service's specification by kind, each declaration's details, source location and relations in both directions, a drawn map of the service or of one declaration's neighbourhood, and each aggregate's state machine as a diagram and a table.
generated:
  by: claude-code/claude-fable-5-2
  at: "2026-11-17T22:40:00Z"
capabilityId: CAP-12
provider: mori://shinzui/keiro-ui
status: shipped
stability: experimental
since: unreleased
packages:
  - "@keiro-ui/console"
  - "@keiro-ui/client-keiro"
interface:
  - /topology
  - /topology/map
  - "/topology/<kind>/<name>"
evidence:
  - kind: test
    resource: apps/console/src/features/topology/topology.test.tsx
    proves: The header, members and inventory of the mounted document; both filters; a declaration's details, machine, relations and fed read models; and every state in which there is no document to show.
  - kind: test
    resource: apps/console/src/features/topology/graph/layout.test.ts
    proves: Every golden document's service graph and every aggregate machine in them lays out identically across runs with no overlapping boxes, no label on a node and no edge crossing a node other than its own ends.
  - kind: test
    resource: apps/console/src/features/topology/graph/graph.test.tsx
    proves: The machine diagram draws one node per state and one label per transition with initial, terminal and replay-only marked as text; diagram and table selection stay in step; the map applies groups, focus and depth from the URL and states what is hidden; a service above the threshold is not drawn whole; a diagram that cannot be drawn leaves the tables.
  - kind: test
    resource: apps/console/e2e/topology/topology.spec.ts
    proves: The section is reachable from the rail and the palette, a filter survives a reload, and a relation leads to a declaration whose page shows the same edge reversed.
  - kind: test
    resource: apps/console/e2e/multi-app/multi-app.spec.ts
    proves: Two deployments show their own documents, a late read from one never enters the other, and a deployment without keiro sends no topology request.
  - kind: test
    resource: packages/client-keiro/test/topology.test.ts
    proves: The document is used only when its bytes hash to the digest the host advertised, is fetched once per digest, and is rejected whole when its schema id, a node kind or a relation is unknown.
  - kind: test
    resource: packages/client-keiro/test/live/reads.live.test.ts
    proves: Against a real keiro host, the served bytes equal keiro's golden document and hash to the advertised digest.
---

# Service topology

The Service Topology section shows what a service is made of, as its specification declares
it. A keiro service can commit a document, written by `keiro-dsl topology`, that lists every
declaration (aggregates, processes, workflows, routers, intakes, emits, queues, projections,
read models and more) and every relation between them. A keiro host that mounts that document
serves it, and the console reads it.

```text
/topology
/topology/aggregate/Reservation
```

`/topology/map` draws the declarations left to right along their relations, tinted and
labelled by kind group, and can be narrowed to some groups or to the declarations within one
or two relations of a chosen one. An aggregate's page draws its state machine above the
transitions table, and every declaration's page draws its direct neighbourhood.

`/topology` shows which service and specification the host mounted (schema id, source,
generator, the document's digest and size, and its member files with their digests), then
every declaration grouped by kind with counts. A text filter and a kind filter are kept in the
URL. Each declaration opens its own page: its details, the file and line that declare it, its
relations in both directions with links to the other declaration, and for an aggregate its
state machine as a table of transitions and the read models its events reach.

The document's contract is `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`.

## Limits

- The document describes the committed specification the host mounted, not the running binary.
  The host does not check that they agree, and neither does the console.
- A host serves a topology only when its application mounts one (`--topology FILE`, or in
  code). The routes were added to keiro after 0.25.1.0. A host that mounts none and a host
  too old to know the route refuse the read identically, so the section says the host serves
  no service topology and does not say which applies.
- The console understands schema ids `keiro-dsl/service-topology/1` and `/2`. It shows nothing
  from a document under another id, or from one that names a node kind or relation unknown to
  its id, repeats a declaration, or has a relation to a declaration that is not there. It
  says which, and why.
- The document is used only when the bytes received hash to the digest the host advertised.
  When they disagree twice in a row the section says the deployment is changing.
- When a later read fails without a definite answer, the document verified earlier stays on
  screen with a notice that it may be out of date.
- Every diagram repeats what a table already says; nothing is shown only as a picture. If a
  diagram cannot be drawn the page says so and keeps its tables.
- The map does not draw more than 80 declarations at once. A larger view asks for a kind
  group or a declaration to start from.
- Parallel relations between the same two declarations share one drawn line, and lines that
  run the same way between columns can share a path; selecting a declaration highlights its
  own relations.
- Guards, register writes and output fields are not in the document, so a machine diagram
  shows states, commands and events only.
- Declarations do not link to live instances, and live screens do not link to declarations.
- The host serves no specification source text, so a declaration's location is shown as
  `member:line` and cannot be opened.
- Documents written by older keiro-dsl versions carry no state machine and no aggregate
  category; the page says so.
- Read-only: every request is a `GET`.
