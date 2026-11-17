---
id: 27
slug: read-and-verify-the-served-service-topology-in-the-keiro-client
title: "Read and verify the served service topology in the Keiro client"
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
      at: 2026-11-17T22:11:20Z
      mode: "implement"
      note: "Milestones 1 to 3 implemented and accepted"
---

# Read and verify the served service topology in the Keiro client

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

Keiro can serve a document describing how a service's declared parts connect, called the service
topology. This plan makes the console's keiro client able to read that document safely. Nothing new
appears on screen. What exists afterwards is a client call that returns a verified, validated, indexed
topology, or a precise typed reason why it cannot, plus the recorded test data and a local host that
serves a real document. The screens built by later plans depend on all three.

It can be seen working by running the client's live tests against the local stack: they read both
topology routes from a real keiro host, confirm the document's bytes hash to the digest the host
advertised and equal keiro's own golden file byte for byte, and confirm the document passes validation.


## Progress

- [x] M1 (2026-11-17): The representative check passes against `jitsurei-ops-http` built from keiro `43c9cdcb`. `curl` showed the summary for `hospital-capacity` under `keiro-dsl/service-topology/1`, `cmp` printed `identical`, and `shasum` gave `d34a4e15…`, the hex part of `document_sha256`. `KEIRO_UI_LIVE=1` ran `packages/client-keiro/test/live/reads.live.test.ts` with 5 of 5 tests passing and none skipped: the `show` bytes equal the golden, hash to the advertised digest, validate (25 nodes, 27 edges, per-kind counts equal `node_counts`) and `load` returns the same digest. The real bodies matched this plan; the only difference is recorded under Surprises.
- [x] M2 (2026-11-17): `topology.summary`, `topology.show`, `topology.load`, the index, the typed errors and the query keys exist. `packages/client-keiro/test/topology.test.ts` covers all five goldens, every refusal, the cache (second `load`: one summary request, no `show`), one corrupted byte (`TopologyChanging` after exactly two `show` requests) and a byte-order mark. `packages/client-core/test/http.test.ts` covers `getRaw`. The two fixtures are recorded; the recorded `show` is byte-identical to the golden and the synthetic summary equals the recorded one byte for byte (`packages/testing/test/topology.test.ts`). `bun run test`: 740 passed, 15 skipped.
- [x] M3 (2026-11-17): The default stack mounts the document and `just stack-check` prints `ok    keiro /topology/summary` with every other keiro probe. The recipe as a whole exited 1 on the two kiroku WebSocket probes, because a process outside this stack holds port 9091 (FRIC-12 in `docs/friction-log/`); that is unrelated to this plan and was left alone. `bun run check`, `bun run test`, `bun run build`, `nix build`, `bun run test:e2e` (60 passed) and strict ADR validation (16 concepts) pass. [ADR-16](../adr/0016-a-served-declaration-document-is-verified-and-rejected-whole-when-unknown.md), `dev/README.md` and `packages/client-keiro/README.md` are written.


## Surprises & Discoveries

- 2026-11-17: The served summary's `generator_version`, and the document's `generator.version`, are the
  literal text `<version>` for every golden. keiro's test suite substitutes the version so the goldens
  survive version bumps. A real service's document carries a real version. Screens must show the value as
  given and not parse it.

- 2026-11-17: `bun run fixtures:record keiro` cannot record selected entries. It re-requested all 47
  keiro entries, changed 23 existing fixtures and dropped their derived metadata (FRIC-11 in
  `docs/friction-log/`). The new fixtures were kept and everything else restored from git, so `derive`
  was not run and `_meta.json` gained exactly two entries. `_meta.json`'s `sources.keiro.commit` therefore
  still names the commit of the older recordings; the topology fixtures come from keiro `43c9cdcb`, as
  `packages/testing/topology/SOURCE.md` records. The steps below and `dev/README.md` describe this.

- 2026-11-17: The synthetic summary helper reproduces the host's summary byte for byte for the hospital
  golden, key order included. A test pins that, so the helper cannot drift from the recorded shape.

- 2026-11-17: Vite's `?raw` import and the mock handler both carry fixtures as text. The goldens are
  ASCII, so encoding the text reproduces the bytes and neither the recorder nor the handler needed a
  change. A document with non-ASCII bytes or a byte-order mark could not be served exactly by the mock;
  the byte-order-mark case is tested with a scripted `fetch` instead.


## Decision Log

- Decision: Hash with a pure SHA-256 (`@noble/hashes`) in every context instead of WebCrypto.
  Rationale: `crypto.subtle` is undefined outside secure contexts (HTTPS or localhost), and the console is
  a static bundle that may be served over plain HTTP inside a network. One synchronous code path is simpler
  to test than WebCrypto with a fallback. The documents are tens of kilobytes.
  Date: 2026-11-17

- Decision: Read `show` through a new byte-exact `getRaw` and hash those bytes, not re-encoded text.
  Rationale: `Response.text()` strips a byte-order mark and replaces invalid sequences, so re-encoding is
  not guaranteed to reproduce what the host hashed.
  Date: 2026-11-17

- Decision: Cache the verified document per digest inside the client instance, and expose one `load` call.
  Rationale: The handoff requires fetching `show` once per digest because each read takes one of the host's
  four admission slots. A client instance belongs to one connection session, so the cache cannot leak
  between deployments, and screens need no cache choreography of their own.
  Date: 2026-11-17

- Decision: Validate strictly only what the contract says to reject (schema id, node kinds, relations, edge
  endpoints) and type only the `details` of the four node kinds that later plans join on or draw.
  Rationale: Keiro may add object fields within a schema id, so everything else stays loose and other
  kinds' details are rendered generically.
  Date: 2026-11-17


- Decision: Share one exchange in the HTTP client for `get`, `post` and `getRaw`, reading every body as
  bytes and decoding with `TextDecoder`.
  Rationale: One implementation of URL, headers, slot, abort and error handling. `TextDecoder` decodes as
  `Response.text()` does (byte-order mark dropped, invalid sequences replaced), so ordinary reads are
  unchanged; the 740 unit tests and 60 browser tests pass unmodified.
  Date: 2026-11-17

- Decision: Validate the document's structure with zod using plain strings for kinds and relations, then
  check the vocabulary, uniqueness and endpoints in code.
  Rationale: The contract requires naming what was rejected. A zod enum would report a union mismatch
  with a path; the explicit pass reports `unknown relation "feeds" for schema keiro-dsl/service-topology/1`.
  Date: 2026-11-17

- Decision: `TopologyChanging` carries both digest pairs as `attempts`, and `parseTopologyDocument`,
  `topologyDigest`, `parseTopologyNodeKey`, `isTopologySchemaId` and `is…` predicates for the three
  errors are exported beyond the interface this plan listed.
  Rationale: Screens need to tell the errors apart without `instanceof` across package boundaries, and
  tests validate documents without a client.
  Date: 2026-11-17

- Decision: A document that verifies but fails validation is not cached.
  Rationale: Only a usable document is worth keeping. A host serving an invalid document costs one `show`
  per poll, which is rare and visible, and avoids caching a rejection by digest.
  Date: 2026-11-17


## Outcomes & Retrospective

Completed 2026-11-17. The keiro client reads, verifies, validates and indexes a served service topology,
and reports each way it cannot. The interfaces in the last section exist as written, with the additions
in the Decision Log. Nothing appears on screen, as intended.

The representative check did its job cheaply: the real host's bodies matched the contract page, so no
dependent plan needed correcting beyond noting the placeholder generator version.

Friction: FRIC-11 (recording keiro fixtures rewrites every existing keiro fixture) is left `logged`; it
recurs for every plan that adds a manifest entry and is a candidate for an improvement request to make
the recorder take entry slugs. FRIC-12 (a foreign process on port 9091) is left `logged`; it will also
block the live browser suite in the next plans until the port is free.

Durable context went to [ADR-16](../adr/0016-a-served-declaration-document-is-verified-and-rejected-whole-when-unknown.md).


## Context and Orientation

This repository builds a static React console for the keiro runtime. The browser calls each runtime
project's own HTTP inspection surface directly; there is no server of ours in between
([ADR-5](../adr/0005-no-backend-for-frontend.md)). The keiro surface is reached through
`packages/client-keiro`. Its `src/client.ts` builds a client whose `read` helper turns command words such
as `["aggregate", "types"]` into the path `/aggregate/types` using `src/route.ts`, validates the answer
with a zod schema from `src/schemas.ts` (zod is the runtime validation library used throughout), and
converts failures with `classifyError` in `src/errors.ts`. Cache keys live in `src/query-keys.ts`, and
`src/index.ts` re-exports everything. The shared HTTP layer is `packages/client-core/src/http.ts`; its
`request` function reads every response with `Response.text()` and parses it with `parseJsonLossless`,
which keeps integers too large for a JavaScript number as `bigint`. It limits concurrent requests; the
keiro client allows three in flight (`KEIRO_MAX_CONCURRENT`) because the host admits four.

The service topology is one JSON document produced by `keiro-dsl topology` from a service's specification.
Its contract is `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`; read that page's sections
"Top-level fields", "Node kinds", "Aggregate machines", "Relations", "Schema id /2", "Compatibility
policy" and "Serving the document" before starting. To read it on disk, run `mori registry show
shinzui/keiro --full` to find the checkout, then open `docs/user/keiro-dsl-service-topology.md` and the
JSON Schemas under `docs/user/schemas/` in it. In summary: the document has `schema`, `service`, `source`,
`effectiveSemanticContract`, `generator`, `members` (source files with a `sha256`), `nodes` and `edges`. A
node has `kind`, `name`, `context`, `member`, `line` and `details`; the pair (`kind`, `name`) is unique. An
edge has `from` and `to` (each `{kind, name}` naming a node of the same document), `relation` and
`attributes`. The document is canonical JSON followed by exactly one newline.

There are two schema ids. `keiro-dsl/service-topology/1` has these 17 node kinds and 22 relations:

```text
aggregate process workflow router contract intake emit publisher workqueue dispatch
read-model operation projection-target rebuild-group projection-owner
projection-revision external-read

dispatches saga reads projects publishes subscribes delivers enqueues commands
queries signals runs depends-on groups consumes writes member-of revises observes
backed-by exposes compatible-with
```

`keiro-dsl/service-topology/2` is the same plus the relation `feeds`. The compatibility policy
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-62`) says keiro may add object fields within a schema id and
consumers must ignore fields they do not know, but a consumer must reject a document whose schema id, node
kind or relation it does not know, rather than drop what it cannot read.

A keiro inspection host serves a mounted document at two `GET` routes. `/topology/show` returns the
mounted bytes unchanged. `/topology/summary` returns a small header in snake_case, for example:

```json
{"document_bytes":18760,"document_sha256":"sha256:d34a4e15…","edge_counts":{"consumes":1,"saga":1},"generator_version":"0.25.1.0","members":[{"path":"hospital-capacity.keiro","sha256":"sha256:0c849100…"}],"node_counts":{"aggregate":5,"workflow":1},"schema_id":"keiro-dsl/service-topology/1","service":"hospital-capacity","source":{"kind":"source","path":"hospital-capacity.keiro"}}
```

`source` is optional in the summary, and the count objects list only kinds and relations that occur. A host
mounts a document in code or with `--topology FILE`. A host that mounts none, and a host too old to know
the command, both answer `400 invalid_request` whose `details.arguments` is the translated command
(`["topology","summary"]`), exactly as unmounted aggregate hooks do today. `413
inspection_result_too_large` means the bytes exceed the host's response limit. `409 schema_drift` and `503
inspection_busy` mean what they mean for every keiro read.

The routes were added by keiro commits `9a267166` and `0ec5a7bb` on 2026-11-17 and are not in a release;
0.25.1.0 is the latest. Before starting, check
`https://hackage.haskell.org/package/keiro-ops-http.json` for a newer release and prefer building a
released tag that contains the routes if one exists; otherwise build the checkout at or after `0ec5a7bb`.

The local stack is described in `dev/README.md`. `dev/build.sh` builds the hosts into `dev/bin/`;
`dev/process-compose.yaml` starts them; `dev/.env` (copied from `dev/.env.example`) holds checkout paths
such as `KEIRO_REPO`; `dev/check.sh` probes them for `just stack-check`. The default profile's keiro host
is `jitsurei-ops-http` on port 9093, reached from the browser as `/keiro`. Jitsurei is keiro's hand-written
demo application and has no specification, so the document it will serve is one of keiro's test goldens,
about a different service. That is expected here: this plan needs real bytes over real HTTP, not agreement
with the host's data.

Test data: `packages/testing/manifests/keiro.json` lists real requests to record,
`packages/testing/scripts/record.ts` records them preserving raw bytes, `bun run --filter @keiro-ui/testing
derive` rebuilds `packages/testing/fixtures/_meta.json`, and `packages/testing/src/handlers.ts` serves the
fixtures as mock HTTP in unit and browser tests. Keiro's golden topology documents are in its checkout
under `keiro-dsl/test/fixtures/topology/`: `hospital-capacity.topology.golden.json` (25 nodes, 27 edges),
`incident-command.topology.golden.json`, `projection-catalog.topology.golden.json`,
`workspace/service.topology.golden.json`, and the `/2` document
`incident-command-sourced.topology.golden.json` (27 nodes, 32 edges).

Local ADRs that apply: [ADR-5](../adr/0005-no-backend-for-frontend.md) as above.
[ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md) requires integers the surfaces send to be
exact; the summary's `document_bytes` and counts use the existing `int64()` schema helper, while numbers
inside the document (`line`, versions) are small and stay plain numbers.
[ADR-11](../adr/0011-one-error-shape-over-three-envelopes.md) requires failures to be an `ApiError` or a
typed error that keeps the `ApiError` as its `cause`. [ADR-13](../adr/0013-honest-gates.md) requires an
absent capability to be reported as absent, not as an empty result.
[ADR-14](../adr/0014-static-nix-packages-and-layered-linux-images.md) means a new npm dependency also
requires regenerating `bun-deps.nix`.
[ADR-15](../adr/0015-target-identity-and-disposable-connection-sessions.md) means each deployment gets its
own client instance, so per-client state never crosses deployments. No local ADR yet covers verifying and
rejecting a served declaration document; this plan creates one.

This plan is the first child of
`docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md`. Three later plans build
screens on it: `docs/plans/28-browse-a-service-s-declared-topology-in-the-console.md`,
`docs/plans/29-draw-the-service-map-and-aggregate-state-machines.md` and
`docs/plans/30-join-topology-declarations-to-live-inspection-screens.md`. They consume the interfaces in
the last section of this plan and add no client members.


## Plan of Work

### Milestone 1: The representative check against a real host

The goal is to prove the uncertain interface before building on it. Rebuild the keiro hosts from a
checkout that has the routes, start `jitsurei-ops-http` with `--topology` pointing at keiro's hospital
golden, and confirm with `curl` and `cmp` that the host serves the golden unchanged.

Then add the minimum client to exercise it. In `packages/client-core/src/http.ts`, add `getRaw(path,
options)` to `HttpClient`. It shares `request`'s URL building, headers, concurrency slot, abort handling,
network-error wrapping and error normalisation, but reads the body with `Response.arrayBuffer()` and
returns `{ bytes: Uint8Array, text: string }`, where `text` is the UTF-8 decoding of those bytes. On a
non-success status it decodes the bytes and passes the text to `normalizeError` as `request` does. Refactor
so the two share one implementation of everything but the body handling.

Create `packages/client-keiro/src/topology.ts` with the schemas, and add a `topology` namespace to
`createKeiroClient` in `src/client.ts`. Add `"topology"` to `HOOK_GATED_WORDS` in `src/errors.ts` so a
refusal becomes the existing `RouteUnavailable`. Add `@noble/hashes` to `packages/client-keiro` pinned to
the exact current release on the npm registry, and compute the digest as the text `sha256:` followed by the
lowercase hex SHA-256 of the bytes.

Extend `packages/client-keiro/test/live/reads.live.test.ts` with a topology case that calls `summary`,
`show` and `load` and asserts: the summary decodes; the `show` digest equals `summary.document_sha256`; the
bytes equal the golden file read from `KEIRO_REPO`; the document validates; and `load` returns the same
digest. Run it with `KEIRO_UI_LIVE=1`. If any real body disagrees with this plan, correct this plan and the
three dependent plans named above before continuing.

### Milestone 2: The complete client, its errors and its fixtures

`TopologySummary` in `src/topology.ts` requires `schema_id`, `service`, `generator_version`,
`document_bytes` and `document_sha256`, `members` (each `path` and `sha256`), `node_counts` and
`edge_counts` (records of `int64()`), and optional `source`. It is loose on unknown fields.

`ServiceTopologyDocument` is loose on object fields and strict where the contract demands. `schema` must
be one of the two ids. Every node `kind` and every edge endpoint `kind` must be one of the 17. Every
`relation` must be one of the 22, or `feeds` only when `schema` is `/2`. Node `details` and edge
`attributes` are open records. Beyond zod, validation checks that (`kind`, `name`) pairs are unique and
that every edge endpoint names an existing node. Export the kind and relation lists as constants
(`TOPOLOGY_NODE_KINDS`, `TOPOLOGY_RELATIONS_V1`, `TOPOLOGY_RELATIONS_V2`) so screens can order and label
them. Order matters when rejecting: check `schema` first and report an unknown id as such, so a `/3`
document is not reported as merely having an unknown relation.

Typed `details` views are separate schemas applied on demand, each returning `undefined` rather than
throwing when a node's details do not match: `AggregateDetails` (`states`, `commands`, `events`, optional
`category`, optional `machine` with `ownership`, `initial`, `states` of `{name, terminal}`, and `edges` of
`{source, edgeIndex, target, mode, command, events}` where `mode` is `Live` or `ReplayOnly`),
`ProcessDetails` (`stableName`, `saga` with `aggregate` and `category`), `WorkflowDetails` (`stableName`,
`steps` of `{form, label?}`) and `ProjectionOwnerDetails` (`subscription` nullable, `delivery`, `group`).
`category` and `machine` are optional because documents emitted by older keiro-dsl versions lack them.

`indexTopology(document)` returns a `TopologyIndex`: the document, a map from node key to node, nodes
grouped by kind in document order, and `outgoing(key)` and `incoming(key)` returning edges.
`topologyNodeKey(kind, name)` is `kind`, a colon and `name`; kinds never contain a colon, so splitting at
the first colon recovers both.

The client namespace has three calls. `summary(signal?)` is an ordinary validated read. `show(signal?)`
uses `getRaw`, computes the digest, parses the text with `parseJsonLossless`, validates, and returns
`{ bytes, digest, document }`. `load(signal?)` implements the handoff's read order: read the summary; if
its `schema_id` is not one this client understands, throw `UnsupportedTopologySchema` without fetching the
document; if the client instance already holds a verified document for that digest, return it; otherwise
call `show`, and if its digest differs from the summary's, discard both and repeat the pair once; if the
second pair also disagrees, throw `TopologyChanging`. A verified result is `{ summary, digest, document,
index }` and is kept in the client instance by digest, replacing any earlier entry.

Typed errors, all in `src/topology.ts` and each keeping any `ApiError` as `cause`:
`UnsupportedTopologySchema` (carries the schema id), `TopologyDocumentInvalid` (carries a short reason
naming the first offending kind, relation, duplicate or dangling endpoint), and `TopologyChanging` (carries
both digest pairs). The existing `RouteUnavailable`, `isTooLarge`, `isSchemaDrift` and `isInspectionBusy`
cover the rest unchanged. Add `keiroKeys.topology.summary()` and `keiroKeys.topology.loaded()`.

Fixtures: add manifest entries `topology-summary` (`/topology/summary`) and `topology-show`
(`/topology/show`), record keiro only, and derive. Confirm the recorded `show` fixture is byte-identical
to the golden, trailing newline included; if the recorder or the mock handler alters bytes, fix that,
because every test of digest verification depends on it. Copy all five goldens unchanged into
`packages/testing/topology/` with a `SOURCE.md` naming the keiro commit they came from, and export a
helper from `packages/testing` that returns one by name as bytes, plus a helper that computes the summary a
host would serve for given bytes. That computed summary is synthetic and must be named so wherever it is
used.

Unit tests go in a new `packages/client-keiro/test/topology.test.ts`: all five goldens validate and index;
the `/2` golden is accepted and a `/1` document containing a `feeds` edge is rejected; an unknown schema
id, node kind, relation, duplicate node and dangling endpoint are each rejected with the right error and
reason; an added unknown object field is accepted; `load` fetches `show` once across repeated calls with
one digest and again after the digest changes; a single digest mismatch recovers and a double mismatch
throws `TopologyChanging`; an unsupported `schema_id` in the summary never requests `show`; a refused
command becomes `RouteUnavailable`; a 413 stays a real failure. Add a `getRaw` case to
`packages/client-core/test/http.test.ts` showing bytes are returned exactly, including a leading
byte-order mark, and that errors normalise as for `get`.

### Milestone 3: The stack, the documentation and the decision record

In `dev/process-compose.yaml`, add `--topology
"$KEIRO_REPO/keiro-dsl/test/fixtures/topology/hospital-capacity.topology.golden.json"` to the default
profile's `jitsurei-ops-http` command, with a comment saying the document describes another service by
design. Leave `dev/process-compose.mori.yaml` unchanged; the mori profile is handled by
`docs/plans/30-join-topology-declarations-to-live-inspection-screens.md`. Add a `/topology/summary` probe
to `dev/check.sh` for the default profile only. Update `dev/README.md` (what is mounted, why it does not
match Jitsurei, how to re-record) and `packages/client-keiro/README.md` (the three calls, the read order,
the errors).

Create the ADR. Run `okf id next docs/adr --profile docs/adr/profile.dhall ADR` (it returned `ADR-16` on
2026-11-17) and write a record titled along the lines of "A served declaration document is verified and
rejected whole when unknown". It states: the console hashes the exact bytes it received and uses a document
only when the digest matches the host's summary; it rejects a document whose schema id, node kind or
relation it does not know and shows nothing from it; it treats the document as a declaration about a
committed specification, never as runtime state; and it cites the upstream policy by its Mori handle.
Follow `agents/skills/exec-plan/ADR.md` for frontmatter, `index.md`, `log.md` and validation.


## Concrete Steps

Run from the repository root inside `nix develop`. Keep `just stack-up` in its own terminal.

```bash
mori registry show shinzui/keiro --full
curl -fsSL https://hackage.haskell.org/package/keiro-ops-http.json
just stack-build keiro
just stack-down
just stack-up
```

Before the compose file is edited in Milestone 3, start the host by hand for Milestone 1 (stop the
stack's keiro process first, or use a spare port and point the live test at it):

```bash
dev/bin/jitsurei-ops-http --database-url "$STACK_DATABASE_URL" --port 9093 \
  --allow-origin http://localhost:5173 \
  --topology "$KEIRO_REPO/keiro-dsl/test/fixtures/topology/hospital-capacity.topology.golden.json"
```

Check the producer:

```bash
curl -fsS http://127.0.0.1:9093/topology/summary
curl -fsS http://127.0.0.1:9093/topology/show | cmp - "$KEIRO_REPO/keiro-dsl/test/fixtures/topology/hospital-capacity.topology.golden.json" && echo identical
curl -fsS http://127.0.0.1:9093/topology/show | shasum -a 256
```

The summary names `hospital-capacity` and schema id `keiro-dsl/service-topology/1`, `cmp` prints
`identical`, and the hash equals the hex part of `document_sha256`.

Add the dependency, then regenerate the Nix lock expression:

```bash
bun add --exact --cwd packages/client-keiro @noble/hashes
just nix-deps
```

Run the checks as the milestones land:

```bash
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test
bun run fixtures:record keiro
bun run --filter @keiro-ui/testing derive
bun run test --project client-core
bun run test --project client-keiro
bun run test --project testing
just stack-check
bun run check
bun run test
bun run build
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
```

After recording, review the fixture diff: only the two new keiro files and their `_meta.json` entries
should change. Recording re-requests every keiro entry and rewrites the existing fixtures (FRIC-11 in
`docs/friction-log/`), and derivation rewrites other surfaces' files (FRIC-9). As implemented: keep the
two new files, save their two `_meta.json` entries, run `git checkout -- packages/testing/fixtures`, put
the two entries back in key order, and skip `derive`, which has nothing to derive for these routes.

Commits follow Conventional Commits and carry these trailers:

```text
MasterPlan: docs/masterplans/4-integrate-the-keiro-service-topology-into-the-console.md
ExecPlan: docs/plans/27-read-and-verify-the-served-service-topology-in-the-keiro-client.md
Intention: intention_01m7nqmcx2e4kvcke3377tcg7g
```


## Validation and Acceptance

Milestone 1 is accepted when the live test passes without being skipped and shows the served bytes equal
the golden and hash to the advertised digest. Mock evidence does not satisfy it.

Milestone 2 is accepted when the new unit tests pass, when deliberately corrupting one byte of the mock
`show` body makes `load` throw `TopologyChanging` after exactly two `show` requests, and when a second
`load` on an unchanged host issues one `summary` request and no `show` request.

Milestone 3 is accepted when `just stack-check` passes with the new probe on the default profile,
`bun run check`, `bun run test` and `bun run build` pass, the Nix package still builds from the regenerated
`bun-deps.nix` (`nix build`, whose default package is the console), and strict ADR
validation passes.

No screen changes. The existing browser suites must pass unchanged, which shows the HTTP refactor did not
alter ordinary reads.


## Idempotence and Recovery

Every new request is a `GET`. Rebuilding hosts, restarting the stack and re-recording keiro fixtures are
repeatable without reseeding; do not run `just stack-seed` for this plan, since it appends data and
invalidates existing pins. If recording changes files of other surfaces, restore them from git. If the
running host answers `400 invalid_request` for `/topology/summary`, it is an old binary or was started
without `--topology`; rebuild and restart before changing any schema. The dependency addition is reverted
by removing it from `packages/client-keiro/package.json`, running `bun install`, and `just nix-deps`.


## Interfaces and Dependencies

Depends on keiro at or after commit `0ec5a7bb` (`mori://shinzui/keiro`, packages `keiro-ops` and
`keiro-ops-http`), and on the new npm dependency `@noble/hashes`. No prerequisite child plan.

What later plans rely on, as conceptual TypeScript:

```typescript
// packages/client-core/src/http.ts
interface HttpClient {
  getRaw(path: string, options?: RequestOptions): Promise<{ bytes: Uint8Array; text: string }>
}

// packages/client-keiro/src/topology.ts
const TOPOLOGY_NODE_KINDS: readonly TopologyNodeKind[]
const TOPOLOGY_RELATIONS_V1: readonly TopologyRelation[]
const TOPOLOGY_RELATIONS_V2: readonly TopologyRelation[]

interface TopologyNode { kind: TopologyNodeKind; name: string; context: string; member: string; line: number; details: Record<string, unknown> }
interface TopologyEdge { from: { kind: TopologyNodeKind; name: string }; to: { kind: TopologyNodeKind; name: string }; relation: TopologyRelation; attributes: Record<string, unknown> }

function topologyNodeKey(kind: TopologyNodeKind, name: string): string
function indexTopology(document: ServiceTopologyDocument): TopologyIndex
interface TopologyIndex {
  document: ServiceTopologyDocument
  node(key: string): TopologyNode | undefined
  byKind(kind: TopologyNodeKind): readonly TopologyNode[]
  outgoing(key: string): readonly TopologyEdge[]
  incoming(key: string): readonly TopologyEdge[]
}

function aggregateDetails(node: TopologyNode): AggregateDetails | undefined
function processDetails(node: TopologyNode): ProcessDetails | undefined
function workflowDetails(node: TopologyNode): WorkflowDetails | undefined
function projectionOwnerDetails(node: TopologyNode): ProjectionOwnerDetails | undefined

interface LoadedTopology { summary: TopologySummary; digest: string; document: ServiceTopologyDocument; index: TopologyIndex }
class UnsupportedTopologySchema extends Error { readonly schemaId: string }
class TopologyDocumentInvalid extends Error { readonly reason: string }
class TopologyChanging extends Error {}

// packages/client-keiro/src/client.ts
client.topology.summary(signal?: AbortSignal): Promise<TopologySummary>
client.topology.show(signal?: AbortSignal): Promise<{ bytes: Uint8Array; digest: string; document: ServiceTopologyDocument }>
client.topology.load(signal?: AbortSignal): Promise<LoadedTopology>

// packages/client-keiro/src/query-keys.ts
keiroKeys.topology.summary()
keiroKeys.topology.loaded()
```

An unmounted or too-old host surfaces as the existing `RouteUnavailable` with `word` equal to `topology`.
Test helpers exported from `@keiro-ui/testing` return a golden document's bytes by name and compute a
synthetic summary for given bytes.
