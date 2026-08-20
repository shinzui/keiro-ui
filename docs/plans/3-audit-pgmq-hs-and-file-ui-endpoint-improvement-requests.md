---
id: 3
slug: audit-pgmq-hs-and-file-ui-endpoint-improvement-requests
title: "Audit pgmq-hs and file UI endpoint improvement requests"
kind: exec-plan
created_at: 2026-08-20T03:01:41Z
master_plan: "docs/masterplans/1-keiro-runtime-ui-foundations.md"
---

# Audit pgmq-hs and file UI endpoint improvement requests

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime UI initiative (docs/masterplans/1-keiro-runtime-ui-foundations.md in this repository, keiro-ui) is preparing a React web UI that lets an operator inspect a running keiro-based system: queues, streams, workflows, projections, and so on. The initiative's core principle is that **every HTTP or WebSocket endpoint lives in the project that owns the concept it exposes**. Queues are owned by pgmq-hs, the Haskell client for pgmq (PostgreSQL-native message queues).

pgmq-hs currently has no way for a browser — or any out-of-process consumer — to see its queues: no HTTP server, no WebSocket, and no library primitives for looking at messages without disturbing them. This plan closes the *coordination* gap, not the implementation gap: it confirms the audit findings against the current pgmq-hs working tree, bootstraps the repository's first OKF improvement-requests bundle (pgmq-hs has none today), and files well-formed improvement requests that tell the pgmq-hs maintainers exactly what the UI needs and why. Implementation of those requests is downstream work in pgmq-hs, outside this plan.

After this plan is complete, you can see it working by running the pgmq-hs repository's own validation (`just docs-check`) and observing the new `docs/improvement-requests/` bundle validate, and by resolving the new requests through the registry (for example `mori registry concepts --id IR-1 --json` listing the pgmq-hs request). The requests become the durable, addressable statement of what the UI needs from pgmq-hs.

Terms used throughout: an **OKF bundle** is a directory of Markdown files with YAML frontmatter, validated by the `okf` CLI against a **profile** (a Dhall descriptor of required fields and conventions). An **improvement request** ("IR") is one such Markdown concept using the `coordination.improvementRequests` profile, carrying a stable handle `IR-N`. **Mori** is the local project registry; canonical cross-repository references use `mori://` URIs.


## Progress

- [x] Milestone 1: audit re-confirmed against the current pgmq-hs working tree; deltas (if any) recorded in Surprises & Discoveries. (2026-08-19: tree at exactly the audited HEAD `9ee9a2f`, clean; all four verification greps silent — no web deps, no executables, no JSON instances on the listed records, no `docs/improvement-requests/`; `Justfile` `docs-check` and `mori.dhall` `okfBundles` shaped as described. No deltas.)
- [x] Milestone 2: `docs/improvement-requests/` bundle bootstrapped in pgmq-hs (profile.dhall frozen and type-checked, index.md, log.md), registered in `mori.dhall`, wired into `just docs-check`, and validating. (2026-08-19: pgmq-hs commit `32b3c1e`; required an unplanned `mori.dhall` schema migration first — see Surprises & Discoveries.)
- [x] Milestone 3: improvement requests authored, filed, validating, and their `IR-N` handles recorded back into this plan and the MasterPlan registry notes. (2026-08-19: pgmq-hs commit `590a46f`; `just docs-check` validates both bundles, "OK: 3 concepts".)
- [x] Living sections of this plan finalized; MasterPlan updated (registry status, Progress, Surprises & Discoveries). (2026-08-19)

Allocated handles (pgmq-hs bundle, all `status: proposed`, `origin: mori://shinzui/keiro-ui`):

- IR-1 — Expose non-destructive queue inspection reads (`expose-non-destructive-queue-inspection-reads.md`)
- IR-2 — Provide JSON codecs for inspection-facing records (`provide-json-codecs-for-inspection-facing-records.md`)
- IR-3 — Add a pgmq-metrics sister package with HTTP and WebSocket inspection endpoints (`add-a-pgmq-metrics-sister-package-with-http-and-websocket-inspection-endpoints.md`)

Canonical handles for cross-repo citation: `mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-1` through `IR-3`.


## Surprises & Discoveries

- Milestone 2 (2026-08-19): `mori validate` failed on pgmq-hs's **pristine** `mori.dhall` — the file pinned mori-schema commit `0274037…` while the installed mori binary embeds `e4899c15…`, and the new schema's `Dependency.WithAugmentation` argument requires a `versionConstraint` field the old helper record lacked. Evidence:

  ```text
  Error: failed to parse config:
  note: this file pins mori-schema commit 027403783777 but this binary embeds e4899c15b6a7; ...
  Error: Wrong type of function argument
  { - versionConstraint : …, … }
  18│         Schema.Dependency.WithAugmentation
  ```

  Resolution: ran the tool's own remediation (`mori schema migrate --apply --file mori.dhall`, which bumped the pin) and added `versionConstraint = None Text` to the local `augDefault` helper, imitating kiroku's equivalent migration (kiroku commit `c2d0328`, "refactor(mori): migrate dependencies to typed package-grained refs"). Without this, `just docs-check` could not run at all, so the repair was in-scope for making the plan's acceptance checkable. Included in pgmq-hs commit `32b3c1e`.
- The v0.10.0 profile's optional `targetPlan` field means "the implementation plan" (repository-relative path or Mori URI), not the filing plan, so it was omitted; the filing plan is cited in each request's Status prose instead.


## Decision Log

- Decision: The new pgmq-hs improvement-requests bundle pins okf-profiles at v0.10.0 (the newest release tag), frozen with `dhall freeze`.
  Rationale: MasterPlan decision (2026-08-19): new bundles start current; only existing bundles keep their older pins. v0.10.0 records therefore use the `generated:` frontmatter family, not the legacy `timestamp:` key used by repos pinned at v0.5.0.
  Date: 2026-08-19

- Decision: Default to three separate improvement requests — (1) library read primitives for inspection, (2) JSON instances for wire-facing domain records, (3) a `pgmq-metrics` sister package for the HTTP+WebSocket surface — rather than one combined request.
  Rationale: The three deliverables have different blast radii and different reviewers: (1) adds statements/sessions/effect operations inside `pgmq-hasql`/`pgmq-effectful`, (2) touches `pgmq-core`/`pgmq-hasql` public types and affects every downstream consumer, (3) creates a new package with a new dependency footprint. Separable requests can be accepted, rejected, or scheduled independently.
  Date: 2026-08-19

- Decision: This plan does not create a `docs/adr/` directory in pgmq-hs. Durable design context there lives in `docs/design/NNN-slug.md`, and the requests cite those notes.
  Rationale: The shared ADR contract (agents/skills/exec-plan/ADR.md in this repository) says to preserve a repository's established convention and never introduce OKF/ADR structure as an incidental plan edit.
  Date: 2026-08-19

- Decision: The bundle's `just docs-check` wiring adds `okf validate` for the new bundle but not `okf graph`.
  Rationale: The capabilities bundle uses `okf graph` because its records cross-link (`requires:`); improvement requests here are flat and independent. Validation without `--strict` mirrors the repo's existing capabilities invocation and avoids demanding fabricated `reviews:` provenance on machine-authored records.
  Date: 2026-08-19

- Decision: Repair pgmq-hs's `mori.dhall` schema skew inside this plan (tool-driven migration plus the one-line `versionConstraint` helper fix) rather than stopping or filing it as separate maintenance.
  Rationale: The pristine file already failed `mori validate` with the installed binary, so the plan's acceptance (`just docs-check` exits 0) was unreachable without it; the fix is mechanical, recommended by the tool itself, and has a working precedent in kiroku's tree. Recorded with evidence in Surprises & Discoveries.
  Date: 2026-08-19

- Decision: `generated.by` is `anthropic/claude-fable-5` on all three requests; `targetPlan` is omitted.
  Rationale: The actor follows the profile's `<producer>/<version>` form (precedent: kiroku IR-7's `anthropic/claude-opus-5`); `targetPlan` denotes the future implementation plan, which does not exist yet.
  Date: 2026-08-19


## Outcomes & Retrospective

Completed 2026-08-19, all milestones in one session. pgmq-hs now carries its first improvement-requests bundle (pinned and frozen at okf-profiles v0.10.0, registered in `mori.dhall`, wired into `just docs-check` — commit `32b3c1e`) and its first three requests (commit `590a46f`): IR-1 non-destructive inspection reads, IR-2 JSON codecs, IR-3 the `pgmq-metrics` sister package. All are `proposed` with `origin: mori://shinzui/keiro-ui`, validate under `--profile-enforce --log-enforce`, and use the v0.10.0 `generated` frontmatter family as EP-1's discovery predicted.

The audit re-confirmation found zero drift (tree at the audited HEAD `9ee9a2f`). The one genuine surprise was pre-existing repository breakage, not audit drift: `mori validate` failed on the pristine `mori.dhall` from schema version skew, and the plan's own acceptance forced the repair (see Surprises & Discoveries). Lesson for EP-4/EP-5: run the target repo's own validation recipe once *before* touching anything — it distinguishes "my change broke it" from "it was already broken" in seconds and surfaces required maintenance early.

For EP-5's composition/non-duplication work: the pgmq-hs handle set to cite is `mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-1`..`IR-3`. Registry-dependent acceptance (resolving the new concepts via `mori registry concepts`) awaits the next registry refresh; the handles and files are committed and validating, which is this plan's deliverable. No keiro-ui ADR change was needed — the requests apply decisions already recorded as ADR-1..ADR-4.


## Context and Orientation

Two repositories are involved.

**This repository (keiro-ui)** holds the plan you are reading, its MasterPlan at docs/masterplans/1-keiro-runtime-ui-foundations.md, and (once child plan docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md — "EP-1" — completes) a cross-project conventions document at docs/architecture/inspection-api-conventions.md plus a seeded docs/adr/ bundle. At the time this plan was written, keiro-ui has **no docs/adr/ and no relevant local ADR exists**. If EP-1 has completed by the time you implement, read the conventions document and cite the keiro-ui ADR handles it created (they will have the form `mori://shinzui/keiro-ui/okf/adrs/concepts/ADR-N`; discover them with `mori registry concepts --search '<topic>' --json` and copy the `ref` field exactly — never construct one by guessing).

**The target repository (pgmq-hs)** is the Haskell client for pgmq. Locate it via the registry:

```bash
mori registry show shinzui/pgmq-hs --full
```

At authoring time (2026-08-19, HEAD `9ee9a2f`) it lives at `/Users/shinzui/Keikaku/bokuno/libraries/pgmq-hs-project/pgmq-hs`. All pgmq-hs paths below are relative to that repository root.

### What pgmq-hs is, structurally

A multi-package Cabal project (GHC 9.12.4, all libraries at 0.5.0.0), with a Nix flake and a `Justfile`:

- `pgmq-core` — types and smart constructors (`Pgmq.Types`): `Message`, `Queue`, `UnvalidatedQueue`, `QueueName`, `MessageId`, `MessageBody`, `MessageHeaders`, `RoutingKey`, `TopicPattern`, `TopicBinding`, `NotifyInsertThrottle`, `PgmqError`.
- `pgmq-hasql` — the real client. Statements live under `pgmq-hasql/src/Pgmq/Hasql/Statements/` (`Message.hs`, `QueueManagement.hs`, `QueueObservability.hs`, `TopicManagement.hs`, `Types.hs`), composed into sessions (`Sessions.hs`) and re-exported through the flat umbrella module `Pgmq`.
- `pgmq-effectful` — the `Pgmq` effect GADT (`Pgmq.Effectful.Effect`), a plain interpreter and an OpenTelemetry-traced interpreter, and a typed error model.
- `pgmq-migration` — installs the pgmq schema without the PostgreSQL extension; all SQL is vendored from upstream (`vendor/pgmq/`, currently pgmq 1.11.0).
- `pgmq-config` — declarative queue topology and an additive reconciler.
- `pgmq-bench` — internal benchmarks.

The repository's layering recipe (documented in its `CLAUDE.md`): every new operation is added as a Hasql `Statement`, then a `Session`, then re-exported from the `Pgmq` umbrella, then mirrored as an effect constructor and interpreted in both interpreters. Requests filed by this plan must ask for work that follows that recipe.

### Audit findings this plan is grounded in (confirm in Milestone 1)

Transport: **zero executables across all cabal files, and no `wai`, `warp`, `servant`, `websockets`, `http-api-data`, or metrics-exporter dependency anywhere.** The only OpenTelemetry surface is tracing (spans), with no metrics instruments and no scrape endpoint. An HTTP/WS surface for pgmq-hs is genuinely greenfield.

Wrapped SQL: queue management (`createQueue`, `dropQueue`, partitioned/unlogged variants), send/read/pop/archive/delete/purge, visibility-timeout changes, topic management, notification management (`enableNotifyInsert`, `disableNotifyInsert`, `listNotifyInsertThrottles`, `updateNotifyInsert`, with `notifyChannelName` in `pgmq-core/src/Pgmq/Types.hs`), and observability: `listQueues`, `listQueuesUnvalidated`, `queueMetrics` (`pgmq.metrics($1)`), `allQueueMetrics` (`pgmq.metrics_all()`) in `pgmq-hasql/src/Pgmq/Hasql/Statements/QueueObservability.hs`, decoding into `QueueMetrics` (`queueName`, `queueLength`, `newestMsgAgeSec`, `oldestMsgAgeSec`, `totalMessages`, `scrapeTime`, `queueVisibleLength`). Beware: upstream `pgmq.metrics_all()` loops over `pgmq.meta` running per-queue `count(*)` scans — O(number of queues) — so a UI polling it needs a documented cost caveat.

Precise absences a queue-inspection UI runs into:

1. **No non-destructive peek.** Every message read goes through `pgmq.read`/`read_with_poll`/`pop`, all of which mutate `vt` (visibility timeout) and `read_ct`. Showing a queue's messages without leasing them requires a new raw `SELECT … FROM pgmq.q_<name>` statement; nothing like it exists.
2. **No archived-message reads.** `archiveMessage` writes into `pgmq.a_<queue>`, but no statement, session, effect, or type reads an archive table back.
3. **No single-message-by-id lookup.** You can act on a `MessageId` but not fetch one.
4. **No LISTEN/NOTIFY consumer.** The library computes channel names only; there is no listener loop or streaming API (LISTEN appears only in tests via raw `postgresql-libpq`).
5. **No JSON instances on wire-facing records.** Only the newtypes have `ToJSON`/`FromJSON`; `Queue`, `UnvalidatedQueue`, `Message`, `QueueMetrics`, `TopicBinding`, `RoutingMatch`, `NotifyInsertThrottle`, `ReconcileAction` derive only `Eq`/`Generic`/`Show`.

### Repository conventions that constrain the requests

Durable design context in pgmq-hs lives in `docs/design/NNN-slug.md` — **there is no `docs/adr/` and this plan must not create one.** The notes the requests should cite:

- `docs/design/012-vendor-upstream-pgmq-sql.md` — all SQL comes from the vendored upstream; never hand-write SQL that upstream provides. A non-destructive peek and archive reads are direct table reads that upstream has no function for, so the request must explicitly justify new hand-written statements against this discipline (they read tables the upstream schema defines; they duplicate no upstream function).
- `docs/design/015-notification-delivery-contract.md` — the channel name must come from `notifyChannelName` (shape `pgmq.q_<lowercased>.INSERT`), and NOTIFY is fire-and-forget, unqueued for disconnected listeners, and throttle-suppressed: **every consumer needs a poll fallback**. Any requested live feed must carry this constraint.
- `docs/design/016-queue-name-validation.md` — why a UI listing queues should use `listQueuesUnvalidated` (strict `listQueues` can fail to decode foreign or mixed-case queue names).
- `docs/design/013-pgmq-effectful-error-model.md` and `docs/design/017-transient-error-classification.md` — the typed error vocabulary an HTTP layer should map to status codes.
- `docs/design/002-queue-visible-length.md` — what the depth numbers mean (total vs. visible length), which the UI must label correctly.

OKF in pgmq-hs today: exactly one bundle, `capabilities` at `docs/capabilities/` (profile pinned at okf-profiles v0.9.0), registered in `mori.dhall` (around lines 155–163) and validated by the `Justfile` `docs-check` recipe (around lines 59–62: `mori validate`, then `okf validate docs/capabilities --profile docs/capabilities/profile.dhall --profile-enforce --log-enforce`, then `okf graph docs/capabilities`). There are **no improvement requests anywhere in the repository**; `docs/capabilities/index.md` states the policy "a capability with no shipped evidence is an improvement request, not a catalog entry". The requests this plan files will be the repository's first, and the bundle bootstrapped here finally gives that policy a home.

Cross-repository precedents worth reading before authoring (canonical handles, resolve with `mori registry concepts --id <handle> --json` and pick the right project): the sister-package pattern this plan's third request imitates is established by kiroku's `kiroku-metrics` and shibuya's `shibuya-metrics` packages — both keep web dependencies out of the core libraries. The downstream-need-driven-upstream request chain to imitate is keiro `mori://shinzui/keiro/okf/improvement-requests/concepts/IR-9` → shibuya `mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-2` → shibuya-pgmq-adapter `mori://shinzui/shibuya-pgmq-adapter/okf/improvement-requests/concepts/IR-1`.

No ADR corpus relevant to this plan exists in either repository at authoring time (keiro-ui: none yet; pgmq-hs: uses `docs/design/`, summarized above).


## Plan of Work

### Milestone 1 — Confirm the audit against the current working tree

The audit above is a snapshot (2026-08-19, HEAD `9ee9a2f`). Before authoring requests, re-verify the load-bearing claims in the pgmq-hs working tree so the requests do not ask for something that has since appeared. Check: still no executables or web dependencies; still no peek/archive/message-by-id statements; still no aeson instances on the listed records; `docs/improvement-requests/` still absent; the `Justfile` `docs-check` recipe and `mori.dhall` `okfBundles` block still shaped as described. Record any drift in Surprises & Discoveries and adjust the requests accordingly. This milestone is complete when each claim is either confirmed or corrected in this plan.

### Milestone 2 — Bootstrap the improvement-requests bundle

Create `docs/improvement-requests/` in pgmq-hs with three files, register the bundle, and wire validation.

`docs/improvement-requests/profile.dhall` (then freeze — never hand-write a `sha256:`):

```dhall
--| Cross-repository improvement-request profile.
let Profiles =
      https://raw.githubusercontent.com/shinzui/okf-profiles/v0.10.0/package.dhall

in  Profiles.coordination.improvementRequests
```

`docs/improvement-requests/index.md` (catalog; keep the list in sync as requests land):

```markdown
---
okf_version: "0.2"
---

# Files

- [profile.dhall](profile.dhall) - Pinned improvement-request profile descriptor.
- [log.md](log.md) - Bundle update log.

# Improvement Request

(entries added as requests are filed, one bullet per request:
[Title](kebab-slug.md) - one-line description)
```

`docs/improvement-requests/log.md`:

```markdown
# Bundle Update Log
```

(The dated sections are appended per change with `okf log add` — see Concrete Steps.)

Register the bundle in `mori.dhall`, appending to the existing `okfBundles` list next to the `capabilities` entry:

```dhall
, Schema.OkfBundle::{
  , name = "improvement-requests"
  , path = "docs/improvement-requests"
  , okfVersion = "0.2"
  , profile = Some "docs/improvement-requests/profile.dhall"
  , description = Some
      "Cross-repository improvement requests owned by pgmq-hs"
  }
```

Extend the `Justfile` `docs-check` recipe with one line mirroring the capabilities validation (no `--strict`, no `okf graph` — see Decision Log):

```text
okf validate docs/improvement-requests --profile docs/improvement-requests/profile.dhall --profile-enforce --log-enforce
```

This milestone is complete when the validation commands in Concrete Steps pass on the bundle containing only `profile.dhall`, `index.md`, and `log.md`.

### Milestone 3 — Author and file the improvement requests

Three requests, filenames are kebab-case slugs of the titles (the `IR-N` handle lives in frontmatter, never the filename). Allocate each ID with `okf id next` at filing time; with an empty bundle the first will be `IR-1`, but the command's answer is authoritative, not this plan.

Frontmatter template (v0.10.0 profile — the current schema, not the legacy `timestamp:` shape used by repos pinned at v0.5.0):

```yaml
---
type: Improvement Request
title: <title>
description: >-
  <one- to three-line summary of the requested change>
generated:
  by: <OKF actor: "human:nadeem", or "<producer>/<version>" for an agent>
  at: "<RFC3339 UTC, e.g. 2026-08-21T00:00:00Z>"
requestId: IR-<N from okf id next>
status: proposed
origin: mori://shinzui/keiro-ui
---
```

Do not add structured `dependencies:` or `acceptanceCriteria:` frontmatter — no released profile defines them; dependency and acceptance content is body prose. Do not fabricate `reviews:` or `verified:` blocks. Optionally add `targetPlan: mori://shinzui/keiro-ui/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests` linking back to this plan.

Body sections for every request: `# Improvement Request: <Title>`, then `## Status`, `## Problem`, `## Requested Change`, `## Acceptance`, `## Non-goals`. Content per request:

**Request 1 — "Expose non-destructive queue inspection reads".** Problem: every existing read leases (mutates `vt`/`read_ct`); an inspection surface must observe without disturbing consumers. Requested change: following the statement → session → `Pgmq` umbrella → effect → interpreters recipe, add (a) a bounded, keyset-paginated non-destructive peek over `pgmq.q_<name>` (order by `msg_id`, cursor + limit, never `OFFSET`), (b) equivalent reads over the archive table `pgmq.a_<name>`, (c) fetch-by-`MessageId` in queue and archive. Explicitly address `docs/design/012-vendor-upstream-pgmq-sql.md`: upstream has no functions for these; the new statements read upstream-defined tables and duplicate no upstream function. Acceptance: peeking N messages leaves every row's `vt` and `read_ct` byte-identical (assertable in a test); reads decode foreign/mixed-case queue names per `docs/design/016-queue-name-validation.md`. Non-goals: no new SQL that shadows an existing `pgmq.*` function; no retention or purge semantics.

**Request 2 — "Provide JSON codecs for inspection-facing records".** Problem: `Queue`, `UnvalidatedQueue`, `Message`, `QueueMetrics`, `TopicBinding`, `RoutingMatch`, `NotifyInsertThrottle`, `ReconcileAction` have no aeson instances, so any wire format re-implements them downstream. Requested change: `ToJSON` (and `FromJSON` where round-tripping is meaningful) with a documented, stable field-naming policy consistent with the cross-project conventions (cite the EP-1 conventions document: project `mori://shinzui/keiro-ui`, path `docs/architecture/inspection-api-conventions.md`; artifact-level URI pending). Acceptance: golden encoding tests; a documented note that field names are a compatibility surface. Non-goals: no breaking change to existing newtype instances.

**Request 3 — "Add a pgmq-metrics sister package with HTTP and WebSocket inspection endpoints".** Problem: no process boundary exists for a browser to reach pgmq state, and the core principle of the UI initiative is that pgmq's endpoints live in pgmq-hs. Requested change: a new package (working name `pgmq-metrics`, mirroring the established sister-package pattern of kiroku's `kiroku-metrics` and shibuya's `shibuya-metrics` — core packages gain no web dependency) exposing: queue listing via `listQueuesUnvalidated`; per-queue and all-queue metrics with the `metrics_all()` polling-cost caveat documented; peek/archive browsing and message-by-id (from Request 1); topic bindings; health; and a WebSocket live feed built on the `enable_notify_insert` channels — with the `docs/design/015-notification-delivery-contract.md` constraint stated verbatim: NOTIFY is a wake-up hint, throttle-suppressed and lossy, so the feed's contract is poll-driven freshness with push acceleration. CORS support from day one (a browser on another origin is the primary client). Wire format and WebSocket protocol conform to the keiro-ui conventions (same citation as Request 2; also cite keiro-ui ADR handles if EP-1 has filed them — discover via `mori registry concepts`, copy `ref` exactly). Error mapping follows `docs/design/013-pgmq-effectful-error-model.md` / `017-transient-error-classification.md`. Acceptance: phrased as observable behavior, e.g. "with the example server running against a database with one queue, `curl http://localhost:<port>/queues` returns HTTP 200 with a JSON array containing that queue". Non-goals: no mutation endpoints (send/delete/purge) in the first iteration; no auth design beyond honestly documenting its absence; no Prometheus work beyond what the conventions require.

For each filed request: add the `index.md` catalog bullet, append the `log.md` entry, re-run validation, and record the allocated handle in this plan's Progress section and in the MasterPlan (Surprises & Discoveries if numbering diverged from estimates).

If EP-1 (docs/plans/1-define-cross-project-inspection-api-and-websocket-conventions.md) is not complete when you reach Milestone 3, still file the requests — reference the conventions document as forthcoming coordination context from project `mori://shinzui/keiro-ui` rather than blocking; revisit the two citing requests when EP-1 lands and update them (bump nothing else).


## Concrete Steps

Working directory for everything below: the pgmq-hs repository root (see Context and Orientation for how to locate it; `$PGMQ` denotes that path).

Milestone 1 (each command should print nothing or only the noted exceptions):

```bash
cd "$PGMQ"
grep -rn --include='*.cabal' -iE 'wai|warp|servant|websockets|http-api-data' . | grep -v dist-newstyle   # expect: no output (allow-newer lines in cabal.project are not dependencies)
grep -rn --include='*.cabal' '^executable' . | grep -v dist-newstyle                                      # expect: no output
grep -rn 'ToJSON' pgmq-hasql/src pgmq-core/src | grep -iE 'QueueMetrics|TopicBinding|Message\b'           # expect: no output
ls docs/improvement-requests 2>/dev/null                                                                  # expect: No such file or directory
```

Milestone 2:

```bash
cd "$PGMQ"
mkdir -p docs/improvement-requests
# write profile.dhall, index.md, log.md as specified in Plan of Work, then:
dhall freeze docs/improvement-requests/profile.dhall
dhall type --file docs/improvement-requests/profile.dhall     # expect: a Profile record type, no error
# edit mori.dhall (okfBundles) and Justfile (docs-check) as specified, then:
mori validate                                                  # expect: success, exit 0
okf validate docs/improvement-requests \
  --profile docs/improvement-requests/profile.dhall \
  --profile-enforce --log-enforce                              # expect: success, exit 0
just docs-check                                                # expect: exit 0, now covering both bundles
```

Milestone 3, per request (shown for the first; repeat with each slug):

```bash
cd "$PGMQ"
okf id next docs/improvement-requests IR --profile docs/improvement-requests/profile.dhall
# expect first output: IR-1  (authoritative; use whatever it prints)
# author docs/improvement-requests/expose-non-destructive-queue-inspection-reads.md
# add the index.md bullet, then:
okf log add docs/improvement-requests \
  -m "Expose non-destructive queue inspection reads (IR-1) filed from keiro-ui" \
  --kind Addition --date "$(date -u +%F)"
okf validate docs/improvement-requests \
  --profile docs/improvement-requests/profile.dhall \
  --profile-enforce --log-enforce
just docs-check
```

Commit in pgmq-hs after Milestone 2 and after Milestone 3 (conventional commits; cross-repo trailers use canonical Mori URIs because repo-relative paths are meaningless in another repository):

```text
docs(okf): bootstrap the improvement-requests bundle

Add docs/improvement-requests (profile pinned at okf-profiles v0.10.0),
register the bundle in mori.dhall, and validate it from just docs-check.

MasterPlan: mori://shinzui/keiro-ui/masterplans/1-keiro-runtime-ui-foundations
ExecPlan: mori://shinzui/keiro-ui/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests
```

When updating this plan file itself, commit in keiro-ui with repo-relative trailers:

```text
docs(plans): record pgmq-hs improvement-request handles in plan 3

MasterPlan: docs/masterplans/1-keiro-runtime-ui-foundations.md
ExecPlan: docs/plans/3-audit-pgmq-hs-and-file-ui-endpoint-improvement-requests.md
```

No `Intention:` trailer is used anywhere in this initiative (MasterPlan decision, 2026-08-19).


## Validation and Acceptance

Acceptance is behavioral:

1. In pgmq-hs, `just docs-check` exits 0 and its output shows validation of **both** `docs/capabilities` and `docs/improvement-requests`.
2. `okf id list docs/improvement-requests --profile docs/improvement-requests/profile.dhall` lists exactly the filed handles (expected `IR-1`, `IR-2`, `IR-3`) with no gaps or duplicates.
3. After the next registry refresh, `mori registry concepts --search 'non-destructive queue inspection' --json` returns the pgmq-hs request with a `ref` of the form `mori://shinzui/pgmq-hs/okf/improvement-requests/concepts/IR-1`; the `ref` values for all three are recorded in this plan.
4. Each request file, read on its own, states Problem / Requested Change / Acceptance / Non-goals concretely enough that a pgmq-hs maintainer could scope implementation work from it without reading this plan.
5. The MasterPlan registry row for EP-3 is set to Complete, and its Progress checkboxes for EP-3 are checked.

Failure modes to recognize: `okf validate` reporting `missing-required` means the frontmatter omits a required v0.10.0 field (most often `generated.by`); `wrong-prefix` or `duplicate-id` means the `requestId` was not taken from `okf id next`; a `--log-enforce` failure means a request was filed without its `log.md` entry.


## Idempotence and Recovery

Every step is safe to repeat. `dhall freeze` rewrites the same hash for the same import; `okf id next` is read-only (it reports, never allocates — the number is only consumed when a file carrying it is committed); `okf validate`, `mori validate`, and `just docs-check` are pure checks. If Milestone 2 is interrupted, re-run from the top of its steps — file writes are idempotent and re-registration in `mori.dhall` is a no-op if the entry already exists. If the bundle already exists when you arrive (someone bootstrapped it first), skip Milestone 2, note the fact in Surprises & Discoveries, and check whether the existing pin changes the frontmatter schema you must use (a v0.5.0-era pin would mean the legacy `timestamp:` key instead of `generated:` — imitate whatever the pinned profile validates). If a request needs rework after filing, edit the file in place and re-validate; never renumber or recycle a handle (`requestId` is stable once committed).


## Interfaces and Dependencies

Tools required on PATH: `okf` (0.8.x — provides `validate`, `id next`, `id list`, `log add`), `dhall` (`freeze`, `type`), `mori` (`registry show`, `registry concepts`, `validate`), `just`, `git`. No Haskell build is required — this plan changes only documentation and manifests.

Artifacts that exist at the end: in pgmq-hs, `docs/improvement-requests/{profile.dhall,index.md,log.md}` plus three request files with frontmatter conforming to `coordination.improvementRequests` at okf-profiles v0.10.0 (`type`, `title`, `description`, `generated.{by,at}`, `requestId`, `status`, `origin`), an `okfBundles` entry in `mori.dhall`, and an extended `docs-check` recipe in `Justfile`; in keiro-ui, this plan updated with the allocated handles and the MasterPlan registry/progress updated.

The Haskell surface named by the requests (for the pgmq-hs implementer, full module paths): statements in `pgmq-hasql/src/Pgmq/Hasql/Statements/QueueObservability.hs` (or a new `Inspection.hs` beside it), sessions in `pgmq-hasql/src/Pgmq/Hasql/Sessions.hs`, umbrella re-exports in `pgmq-hasql/src/Pgmq.hs`, effect constructors in `pgmq-effectful/src/Pgmq/Effectful/Effect.hs` with both interpreters updated, JSON instances beside the types in `pgmq-core/src/Pgmq/Types.hs` and `pgmq-hasql/src/Pgmq/Hasql/Statements/Types.hs`, and a new top-level `pgmq-metrics` package for the endpoint surface. These are the requests' vocabulary, not this plan's deliverables.
