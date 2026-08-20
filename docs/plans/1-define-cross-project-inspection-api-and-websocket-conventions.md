---
id: 1
slug: define-cross-project-inspection-api-and-websocket-conventions
title: "Define cross-project inspection API and WebSocket conventions"
kind: exec-plan
created_at: 2026-08-20T03:01:41Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Define cross-project inspection API and WebSocket conventions

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime is a composable Haskell stack for event-sourced systems: **keiro** (the framework — commands, aggregates, read models and projections, process managers, timers, durable workflows) builds on **kiroku** (an append-only PostgreSQL event store with durable subscriptions), **keiki** (pure transition semantics), **shibuya** (supervised queue processing with explicit acknowledgements, backpressure, and batching), and **pgmq-hs** (a Haskell client for pgmq, the PostgreSQL-native message queue). A planned React web UI will let anyone operating an application built on this stack browse aggregates, workflows, queues, streams, subscriptions, projections, and dead letters from a browser.

The endpoints powering that UI will be implemented in four different repositories, each owned by the project whose concept the endpoint exposes. Without a shared contract, four teams (or four working sessions) will produce four dialects — different JSON casing, different pagination, different WebSocket message shapes — and the UI will need four bespoke clients. Two dialects already exist: `shibuya-metrics` and `kiroku-metrics` each ship a WebSocket protocol today, and they differ.

After this plan is complete, this repository (keiro-ui) contains a conventions document, `docs/architecture/inspection-api-conventions.md`, that every improvement request filed in the four runtime repositories can cite as shared acceptance context, plus a seeded, profile-governed Architecture Decision Record (ADR) corpus under `docs/adr/` whose records are citable from other repositories by stable `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N` handles. You can see it working by running the OKF validation command shown in Validation and Acceptance and watching it pass, and by running `okf id list docs/adr --profile docs/adr/profile.dhall` and seeing the allocated ADR handles.

No intention is linked to this plan. Every commit made under this plan must use Conventional Commits style and carry both trailers:

```text
MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md
```


## Progress

- [x] Milestone 1: `docs/architecture/inspection-api-conventions.md` written, covering all ten convention areas listed in Plan of Work. (2026-08-19: 11 `##` sections — the ten areas plus the citation section; `subscribe_events`, `subscribe_all`, and `store_position` all present per acceptance greps.)
- [ ] Milestone 2: `docs/adr/` bootstrapped as a profiled OKF bundle (`profile.dhall` pinned and frozen, `index.md`, `log.md`) and registered in `mori.dhall`; `mori validate` passes.
- [ ] Milestone 3: Four initial ADRs written with handles allocated by `okf id next`; strict profile validation and log enforcement pass.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The conventions document and the initiative's ADR corpus live in keiro-ui, not in any runtime repository.
  Rationale: keiro-ui is the only repository whose concern is the composed UI. The runtime repositories must stay independently usable and should not host cross-project UI contracts. Once the bundle is registered, other repositories cite the records as `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`.
  Date: 2026-08-19

- Decision: Pin the ADR bundle's profile at okf-profiles release tag v0.10.0 and freeze it with `dhall freeze`.
  Rationale: v0.10.0 is the newest published tag of okf-profiles. New bundles start current; hand-written `sha256:` values are forbidden because a typo silently breaks integrity checking.
  Date: 2026-08-19

- Decision: The WebSocket convention is a superset compatible with both existing dialects; published wire shapes in shibuya-metrics and kiroku-metrics are frozen and convergence requests may only be additive.
  Rationale: Both servers have shipped consumers (Prometheus scrapers, the kiroku CLI remote client, runnable examples). Breaking a published protocol to achieve cosmetic uniformity would violate the stability posture the stack applies everywhere else (frozen SQL relations, PVP discipline).
  Date: 2026-08-19

- Decision: New wire fields use snake_case; existing published shapes keep whatever casing they shipped with.
  Rationale: Both existing WebSocket dialects already use snake_case `type` tags and message names (`subscribe_all`, `event_stream_started`, `from_position`); kiroku's WS envelope keys are snake_case. The one deviation (camelCase field names inside kiroku's event payload objects) is published and therefore frozen.
  Date: 2026-08-19


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

**This repository.** keiro-ui (`/Users/shinzui/Keikaku/bokuno/keiro-ui`, project `shinzui/keiro-ui` in the Mori registry) is a nearly empty repository that will eventually hold the React web UI for the keiro runtime. Today it contains agent skills under `agents/skills/`, a `mori.dhall` project manifest, and the planning documents under `docs/masterplans/` and `docs/plans/`. There is no application code, no `docs/adr/`, and no OKF bundle yet. **No local ADR exists; this plan creates the corpus.**

**Terms.**

- *WAI* (Web Application Interface) is the standard Haskell interface between web servers and web applications; a WAI `Application` is a value that can be mounted into any WAI-compatible server (such as Warp). "Embeddable WAI Application" means a library hands the host application a value to mount, rather than insisting on running its own process.
- *OKF* (Open Knowledge Format) is a convention for directories ("bundles") of Markdown documents ("concepts") with YAML frontmatter, validated by the `okf` command-line tool. A *profile* is a Dhall file layering house rules (required fields, ID formats) onto a bundle. `okf validate` checks conformance; `okf id next` allocates the next document handle; `okf log add` appends to the bundle's reserved `log.md`.
- *Dhall* is a typed configuration language; `dhall freeze` records a cryptographic hash for a remote import so later builds verify integrity.
- *Mori* is the local project registry; `mori.dhall` at a repository root declares the project, its packages, and its OKF bundles. Registered bundles give concepts canonical cross-repository URIs of the form `mori://<namespace>/<project>/okf/<bundle>/concepts/<handle>`.
- *ADR* (Architecture Decision Record) is one Markdown file recording one durable architectural decision.
- *CORS* (Cross-Origin Resource Sharing) is the browser mechanism that blocks a web page served from one origin from calling an HTTP API on another origin unless the API sends permissive response headers.
- *NOTIFY / LISTEN* are PostgreSQL's built-in publish/subscribe primitives: a trigger or client calls `pg_notify` on a named channel; connected sessions that ran `LISTEN` on that channel receive a wake-up. Delivery is best-effort: disconnected listeners miss notifications, and there is no queueing or replay.

**The four repositories whose endpoints these conventions govern** (audited August 2026):

- *kiroku* (`shinzui/kiroku`) ships `kiroku-metrics`, a Warp/WAI server (default port 9091) with JSON metrics, Prometheus text, health probes, a live `/subscriptions` registry, and a WebSocket at `/ws/events` that tails the event log with replay (`from_position`) and category filtering. Its core store package deliberately has no web dependency.
- *shibuya* (`shinzui/shibuya`) ships `shibuya-metrics`, a Warp/WAI server (default port 9090) with JSON metrics, Prometheus text, health probes, and a WebSocket at `/ws` pushing per-processor metric deltas. Its capability record CAP-10 states the rationale: "a separate package rather than part of the core precisely so that adopting Shibuya does not mean adopting a web server."
- *pgmq-hs* (`shinzui/pgmq-hs`) has no server surface at all — libraries only, no executables, no web dependencies.
- *keiro* (`shinzui/keiro`) has no HTTP or WebSocket surface; its operational surface is `keiro-ops`, an embeddable CLI with a typed command tree and stable JSON envelope.

**The two existing WebSocket dialects** this plan must remain compatible with:

- shibuya-metrics (`shibuya/shibuya-metrics/src/Shibuya/Metrics/Types.hs` in the shibuya repository): client sends `{"type":"subscribe_all"}`, `{"type":"subscribe","processors":[...]}`, `{"type":"unsubscribe","processors":[...]}`, `{"type":"ping"}`; server sends `{"type":"snapshot","metrics":{...}}`, `{"type":"update","processor":...,"metrics":{...}}`, `{"type":"pong"}`, `{"type":"goodbye"}`. Deltas are pushed only when values change, default every 100 ms.
- kiroku-metrics (`kiroku/kiroku-metrics/src/Kiroku/Metrics/WebSocket.hs` in the kiroku repository): client sends `{"type":"ping"}`, `{"type":"subscribe_metrics"}`, `{"type":"subscribe_events","from_position":N,"category":"orders"}`, `{"type":"unsubscribe_events"}`; server sends `pong`, `snapshot`, `event`, `event_stream_started`, `goodbye`, `error`. Event delivery uses a bounded per-connection queue with drop-oldest overflow signaled by an in-band `error` frame.

**ADR context.** No local ADR exists (this plan creates `docs/adr/`). The cross-repository decisions that constrain these conventions, cited by the exact canonical handles returned by Mori:

- `mori://shinzui/keiro/okf/adrs/concepts/ADR-28` — keiro operator commands wrap supported library APIs and respect schema ownership; also fixes reporting vocabulary for keiro surfaces (`store_position`, `visible_store_head`, "global position distance" — never "lag" or "backlog").
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-35` — projection group status is a frozen, owner-rights SQL contract; external readers never receive access to the private `keiro` or `kiroku` schemas.
- `mori://shinzui/keiro/okf/adrs/concepts/ADR-36` — external readers use versioned, guarded SQL contracts; incompatible change means a new `_v2` contract, not in-place mutation.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-1` — stream names resolve via an on-demand batch lookup API, not a field on each recorded event; any surface that displays events fetched across streams must plan a resolution step.
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-3` — kiroku objects live in a dedicated PostgreSQL schema, and the schema name also scopes the LISTEN notification channel (`<schema>.events`).
- `mori://shinzui/kiroku/okf/adrs/concepts/ADR-6` — database-native integration surfaces are owner-published, structurally read-only, frozen, versioned relations; the stability posture these HTTP conventions extend to the wire.

**Tools required** on the machine executing this plan: `okf` (the OKF CLI), `dhall`, and `mori`. Verify availability with `okf --help`, `dhall --version`, and `mori --help` before starting Milestone 2.


## Plan of Work

The work has three milestones. Milestone 1 writes the conventions document. Milestone 2 bootstraps the ADR bundle. Milestone 3 writes the initial ADRs and proves the bundle validates strictly. Milestones 2 and 3 are separated because bundle bootstrap can be verified on an empty bundle before any record exists, which isolates profile/pinning mistakes from record-authoring mistakes.

### Milestone 1 — the conventions document

Create `docs/architecture/inspection-api-conventions.md` (create the `docs/architecture/` directory). The document is prose with examples, written for implementers in the four runtime repositories. It must cover the following ten areas, with the stated resolutions — the document elaborates and illustrates these rules; it does not reopen them:

1. **Transport and packaging.** Inspection surfaces are HTTP + JSON, served by an embeddable WAI `Application` that the host application mounts (the "sister package" pattern). Core libraries never gain web dependencies; each project ships its surface in a dedicated package (`shibuya-metrics` and `kiroku-metrics` are the live precedents; pgmq-hs and keiro will add analogous packages under their own future plans). Servers must allow the host to choose bind address and port (defaults today: shibuya 9090, kiroku 9091) and must also export the bare `Application` so a host can mount several surfaces in one process.
2. **JSON field conventions.** All new wire fields are snake_case. Existing published shapes are frozen regardless of casing — explicitly including kiroku's WebSocket event frames, whose envelope keys are snake_case but whose event payload objects use camelCase field names (`eventId`, `globalPosition`, ...). The document must show this exact example so implementers understand "frozen" beats "consistent".
3. **Pagination.** Position-based reads use cursor pagination: request takes `from` (an exclusive cursor; the domain's native position type) and `limit`; response returns `items` plus `next_cursor`, omitting `next_cursor` when the page is the last. Cursors are opaque to the UI: it echoes them back and never does arithmetic on them. This mirrors kiroku's exclusive-cursor read API and keiro's global-position semantics, where contiguity is an implementation detail.
4. **Error envelope.** New endpoints return errors as `{"error":{"code":"<machine_readable_snake_case>","message":"<human sentence>","details":{...}}}` with an appropriate HTTP status; `details` is optional. Existing endpoints returning `{"error":"<string>"}` are frozen. Error codes are per-project vocabularies, documented alongside the endpoints.
5. **WebSocket protocol convention.** Typed JSON frames with a required `type` tag. Client-to-server: explicit subscribe and unsubscribe frames naming what is watched, plus `ping`. Server-to-client: an initial `snapshot` after subscribe, then incremental frames (`update` for state deltas, `event` for append-only feeds), `pong`, in-band `error` frames (including queue-overflow signaling), and `goodbye` before server-initiated close. Per-connection queues are bounded with drop-oldest overflow, and overflow must be signaled in-band. Where the domain has replayable positions, subscribe frames accept a `from_position` cursor. Servers ping idle connections (30 s precedent). Both existing dialects already fit this shape; the convention names the shape so new endpoints (pgmq-hs, keiro) fit it too, and any convergence work in shibuya/kiroku is additive only.
6. **Live updates: push is a hint, poll is truth.** PostgreSQL NOTIFY is best-effort — disconnected listeners miss notifications, throttling can suppress them, and payloads are wake-up hints, not data. Every live endpoint must be backed by a poll/read path that is authoritative, with push used only to shorten latency. This is already documented independently in kiroku (`docs/architecture/notifier.md` in the kiroku repository), pgmq-hs (`docs/design/015-notification-delivery-contract.md`), and keiro (`Keiro.Wake`); the convention makes it a cross-project rule.
7. **CORS.** No existing server sets CORS headers, so a browser page on a different origin cannot call them today. New and extended servers must support configurable CORS: an explicit allowed-origins list (no wildcard when credentials are involved), configured by the host application, disabled by default. The document should note the alternative that works with zero server changes — serving the UI and proxying the APIs from one origin — and still require the configuration hook, because the composed UI will typically face several backends.
8. **Authentication and authorization posture.** None exists on any current surface, and designing auth is out of scope for the initiative. The convention records the gap honestly: inspection servers assume a trusted network or an authenticating reverse proxy in front of them. Anything mutating (future control actions such as pause/resume, DLQ redrive, checkpoint reset) must be separately gated and must follow the owning project's safety discipline — keiro-ops's preview-then-`--force` model is the named precedent.
9. **Versioning and wire stability.** A published wire shape is frozen: fields are never removed or re-typed; additive fields are allowed; an incompatible change is a new path (or new frame type), following the spirit of `mori://shinzui/kiroku/okf/adrs/concepts/ADR-6` at the HTTP layer.
10. **Vocabulary.** Each project's surface keeps its own domain vocabulary. On keiro surfaces the terms mandated by `mori://shinzui/keiro/okf/adrs/concepts/ADR-28` are binding: `store_position`, `visible_store_head`, "global position distance" — never "lag" or "backlog". Shibuya and kiroku surfaces keep their published metric names. The UI, not the endpoints, is responsible for any cross-surface terminology mapping it wants to present.

The document ends with a short "How other repositories cite this document" section: until keiro-ui exposes artifact-level Mori URIs for architecture documents, cite the canonical project URI plus repository-relative path — `mori://shinzui/keiro-ui` together with `docs/architecture/inspection-api-conventions.md` — and note that the artifact-level URI is pending; ADRs in this repository's bundle are citable now as `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`.

Acceptance for Milestone 1: the file exists and contains a heading for each of the ten areas; the section on WebSockets names both existing dialects and their message types verbatim.

### Milestone 2 — bootstrap the ADR bundle

Create `docs/adr/profile.dhall` with exactly:

```dhall
--| Shared architecture-decision profile, pinned at okf-profiles v0.10.0.
let Profiles =
      https://raw.githubusercontent.com/shinzui/okf-profiles/v0.10.0/package.dhall

in  Profiles.documentation.architectureDecisions
```

Then freeze and type-check it (commands in Concrete Steps). `dhall freeze` rewrites the file adding a `sha256:...` to the import; never write that hash by hand.

Create `docs/adr/index.md` — the reserved bundle index (not a concept):

```markdown
---
okf_version: "0.2"
---

# Files

- [log.md](log.md) - Bundle update log.

# Architecture Decision Record

(Records are listed here as they are added.)
```

Create `docs/adr/log.md` — the reserved update log (not a concept):

```markdown
# Bundle Update Log
```

Entries are appended per day with `okf log add` (Milestone 3), producing `## YYYY-MM-DD` sections with typed bullets.

Register the bundle in `mori.dhall`. The file currently ends with the `repos` field inside `Schema.Project::{...}`; add an `okfBundles` field to the same record:

```dhall
in  Schema.Project::{
    , project = Schema.ProjectIdentity::{
      , name = "keiro-ui"
      , namespace = "shinzui"
      , stableId = Some "project_01m0eh2z66e4f8qx43fq70berz"
      , type = Schema.PackageType.Application
      , language = Schema.Language.TypeScript
      , lifecycle = Schema.Lifecycle.Experimental
      , description = Some
          "Web UI for keiro, the event sourcing framework and workflow engine"
      , domains = [ "EventSourcing", "Workflow", "Frontend" ]
      }
    , repos =
      [ Schema.Repo::{ name = "keiro-ui", github = Some "shinzui/keiro-ui" } ]
    , okfBundles =
      [ Schema.OkfBundle::{
        , name = "adrs"
        , path = "docs/adr"
        , okfVersion = "0.2"
        , profile = Some "docs/adr/profile.dhall"
        , description = Some
            "Durable architecture decisions for the keiro runtime UI initiative"
        }
      ]
    }
```

Keep the existing `let Schema = ...` header unchanged. If the schema version in use rejects the `Schema.OkfBundle` constructor, inspect `mori.dhall` in the keiro repository (`/Users/shinzui/Keikaku/bokuno/keiro`, `okfBundles` field near the end) for the constructor shape that schema accepts, and record the discrepancy in Surprises & Discoveries.

Acceptance for Milestone 2: `dhall type --file docs/adr/profile.dhall` succeeds; the frozen hash is present; `mori validate` passes; `okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce` passes on the empty bundle; `okf id next docs/adr --profile docs/adr/profile.dhall ADR` reports the first free handle (expected `ADR-1` on an empty bundle — but always use the command's answer, never assume).

### Milestone 3 — the initial ADRs

Write four records, one file each, at the bundle root. Allocate each `docId` with `okf id next` immediately before writing the record; do not derive IDs by counting files, and do not reuse or pad numbers. Name each file `NNNN-<kebab-title>.md` with `NNNN` the zero-padded handle number (cosmetic convention matching keiro and kiroku; the authoritative identity is the `docId` in frontmatter).

Frontmatter for every record (the profile requires `type`, `title`, `docId`, `status`, `date`; strict authoring also requires a one-sentence `description` and a `timestamp` for the last meaningful revision):

```yaml
---
type: Architecture Decision Record
title: <decision title>
description: <one sentence>
docId: ADR-<n>
status: accepted
date: <YYYY-MM-DD>
timestamp: <YYYY-MM-DD>T00:00:00Z
---
```

If strict validation reports a differently named or shaped required field, the pinned profile (as frozen in `docs/adr/profile.dhall`) and its generated docs in the okf-profiles repository (`/Users/shinzui/Keikaku/bokuno/okf-profiles/docs/profiles/`) are authoritative — follow them and record the correction here.

The four decisions, in intended allocation order (body: Context / Decision / Consequences prose, each a few paragraphs, self-contained):

1. **Inspection endpoints live in the project that owns the concept.** Records the layer-ownership matrix from the MasterPlan (docs/masterplans/1-keiro-runtime-ui-foundations.md, Integration Points): queue-level views (queue list, depth/age metrics, peek, archive browsing, message-by-id) belong to pgmq-hs; processor/pipeline supervision views (processor state, throughput, batching, in-flight, pause/resume) to shibuya, with queue-backed context (depth behind a processor, DLQ contents) to the shibuya adapters; store-level views (streams, events, categories, `$all` tail, durable subscription checkpoints, store dead letters) to kiroku; framework-level views (aggregates, process managers, durable workflows, timers, projections and rebuilds, outbox/inbox, job semantics on queues) to keiro; composition (one process serving all mounted surfaces, plus the browser app) to keiro (mounting) and keiro-ui (the app). Overlaps resolve toward the lower layer. Consequence: keiro composes; it never re-implements a lower layer's endpoints.
2. **The WebSocket inspection protocol convention.** The typed-frame superset from the conventions document (area 5), including the frozen-dialect rule and additive-only convergence.
3. **Push is a hint; poll is truth.** NOTIFY-driven live updates are latency optimizations over an authoritative poll/read path (area 6), across all four projects' surfaces.
4. **Inspection surfaces live in sister packages.** Core libraries never gain web dependencies; each project's HTTP/WS surface is a dedicated package exporting an embeddable WAI `Application` (area 1), following shibuya-metrics and kiroku-metrics.

After writing each record, add it to `index.md`'s listing and append a log entry with `okf log add`. Then update the MasterPlan's Progress checklist for EP-1 and mark this plan's Progress entries.

Acceptance for Milestone 3: `okf id list` shows exactly the four allocated handles; strict validation with `--profile-enforce --log-enforce` passes; each record's `docId` is unique and unpadded; `log.md` has dated entries covering all four additions.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless noted.

Milestone 1:

```bash
mkdir -p docs/architecture
"$EDITOR" docs/architecture/inspection-api-conventions.md   # write per Plan of Work
grep -c '^## ' docs/architecture/inspection-api-conventions.md   # expect >= 10 sections
```

Milestone 2:

```bash
mkdir -p docs/adr
"$EDITOR" docs/adr/profile.dhall      # exact content from Plan of Work
dhall freeze docs/adr/profile.dhall   # adds sha256: to the import; do not hand-edit
dhall type --file docs/adr/profile.dhall
"$EDITOR" docs/adr/index.md           # exact content from Plan of Work
"$EDITOR" docs/adr/log.md             # exact content from Plan of Work
"$EDITOR" mori.dhall                  # add okfBundles per Plan of Work
mori validate
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
okf id next docs/adr --profile docs/adr/profile.dhall ADR
```

Expected: `dhall type` prints the profile's Dhall type without error; `mori validate` reports success; `okf validate` reports the bundle valid (an empty bundle has no concepts to fail); `okf id next` prints the first free handle, e.g.:

```text
ADR-1
```

Milestone 3, repeated for each of the four records:

```bash
okf id next docs/adr --profile docs/adr/profile.dhall ADR   # note the handle, e.g. ADR-1
"$EDITOR" docs/adr/0001-inspection-endpoints-live-in-the-owning-project.md
"$EDITOR" docs/adr/index.md                                 # add the record to the listing
okf log add docs/adr -m "Add ADR-1: inspection endpoints live in the owning project" --kind Addition --date 2026-08-19
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
```

Final check:

```bash
okf id list docs/adr --profile docs/adr/profile.dhall
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
mori validate
```

Expected final `okf id list` output: the four allocated handles (expected `ADR-1` through `ADR-4`), each mapped to its file. If `okf log add`'s flag syntax differs in the installed version, run `okf log add --help` and adapt; the requirement is a dated Addition entry per record, and `--log-enforce` failing is the signal the log is incomplete.

Commit at each milestone boundary (Conventional Commits, both trailers), for example:

```text
docs(conventions): define cross-project inspection API and WebSocket conventions

MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md
```


## Validation and Acceptance

The plan is complete when all of the following observable checks pass from the repository root:

1. `docs/architecture/inspection-api-conventions.md` exists and contains a section for each of the ten convention areas; searching it for `subscribe_events` and `subscribe_all` finds the dialect-compatibility discussion; searching for `store_position` finds the vocabulary rule.
2. `okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce` exits zero.
3. `okf id list docs/adr --profile docs/adr/profile.dhall` lists exactly four handles, matching the four record files.
4. `mori validate` exits zero with the `adrs` bundle registered.
5. `grep -r "sha256:" docs/adr/profile.dhall` finds the frozen hash.
6. The MasterPlan registry row for EP-1 is set to Complete and its Progress entries for EP-1 are checked.

Failure modes to recognize: a `--log-enforce` failure means a record changed without a same-day log entry — add the entry rather than weakening the command; a `--profile-enforce` failure names the violated rule and file (the okf-profiles repository keeps single-rule rejection fixtures — for the improvement-request profile under `fixtures/improvement-requests-invalid/` — that illustrate how one violation maps to one diagnostic; the ADR profile diagnoses analogously); a `dhall type` failure after editing `profile.dhall` usually means the frozen hash no longer matches — re-run `dhall freeze` only if you intentionally changed the import.


## Idempotence and Recovery

Every step is safe to repeat. Document edits are plain file writes; re-running `dhall freeze` on an unchanged import is a no-op; `okf validate`, `okf id next`, `okf id list`, and `mori validate` are read-only. `okf id next` allocates nothing — it only reports; the allocation happens when a record with that `docId` is committed, so abandoning a draft record leaves no gap. If validation fails midway through Milestone 3, fix the named file and re-run; records already valid are unaffected. If `mori.dhall` editing goes wrong, `git checkout -- mori.dhall` restores it (the file is otherwise untouched by this plan except the `okfBundles` addition).


## Interfaces and Dependencies

This plan produces documents, not code. The artifacts and their consumers:

- `docs/architecture/inspection-api-conventions.md` — cited by the improvement requests filed under docs/plans/2 through docs/plans/5 (in this repository's plan set) into kiroku, pgmq-hs, shibuya, and keiro, as `mori://shinzui/keiro-ui` plus this repository-relative path (artifact-level URI pending); and by docs/plans/6's UI direction document.
- `docs/adr/` records `ADR-1`..`ADR-4` (as allocated) — citable from other repositories as `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N` once the bundle is registered in `mori.dhall` and the registry has observed it.
- `docs/adr/profile.dhall` — the frozen pin every future keiro-ui ADR is validated against; changing it later is deliberate maintenance, not a side effect.

External tools: `okf` (bundle validation, ID allocation, log maintenance), `dhall` (freeze/type-check), `mori` (manifest validation and registry observation). No Haskell, Node, or React tooling is required by this plan.
