---
id: 22
slug: align-the-console-stack-and-fixtures-with-the-current-runtime-cohort
title: "Align the console stack and fixtures with the current runtime cohort"
kind: exec-plan
created_at: 2026-11-05T01:05:55Z
master_plan: "docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md"
provenance:
  created_by:
    model: "claude-opus-5-5"
    harness: "claude-code"
    at: 2026-11-05T01:05:55Z
  revisions:
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-11-05T03:13:39Z
      mode: "implement"
      note: "Milestones implemented against keiro 9da47eb7"
---

# Align the console stack and fixtures with the current runtime cohort

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture

The keiro runtime console (the React application in `apps/console`) reads four inspection servers
owned by other repositories. Its local stack and its recorded test data were last refreshed on
2026-10-21, and those servers have moved on: `dev/bin` still links keiro-ops-http 0.21.0.0,
kiroku-metrics 0.3.0.1, and pgmq-inspect 0.1.0.0, while the checkouts are at keiro 0.23.0.0 plus
unreleased commits, kiroku-metrics 0.4.0.1, and pgmq-inspect 0.7.0.0. The keiro host in the stack
also mounts no application hooks, so the Aggregates and Process managers sections show "not mounted
on this keiro host" locally, and their test data was written by hand.

After this plan, `just stack-build && just stack-seed && just stack-up` runs the console against the
current checkouts, with a keiro host that mounts real aggregate and process-manager catalogs.
Opening `http://localhost:5173/aggregates` lists `credit-limit`, `incident`, and `order` from a live
server. The test fixtures for those routes are recorded from that server rather than hand-written,
and they include the new bodies the sibling plans need: `/pm/types`, `feeding_subscriptions` on
`/projection/status`, and `/snapshot/show`. Every behaviour change in the upstream releases has been
checked against the console, and the deployment guide no longer states something the current
servers refuse. No new screen is added here; the sibling plans add them.


## Progress

- [x] M1 (2026-11-04): `just stack-check` reports `ok` for every probe, including `/aggregate/types`,
  `/pm/types`, and `/snapshot/show`, against a stack built from the current checkouts (keiro `9da47eb7`,
  kiroku `aa2c6ab`, pgmq-hs `88afb93`, adapter `e549451`) with `jitsurei-ops-http` on port 9093;
  `KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test` parses those bodies (43 tests pass).
- [x] M2 (2026-11-04): `packages/testing/fixtures` is re-recorded with updated pins, the hand-written
  aggregate and process-manager bodies are replaced by recorded ones, and `bun run test` passes (632
  tests), with `bun run test:e2e` (56) and `bun run test:e2e:multi-app` (9). Three refusal bodies stay
  derived; see Surprises & Discoveries.
- [x] M3 (2026-11-04): Each upstream behaviour change listed in Plan of Work has been checked and either
  fixed or recorded as not applicable; the deployment guide, client READMEs, and client-pgmq's OpenAPI copy
  are current; `bun run check`, `bun run test`, and the Playwright suites pass, including the production
  smoke (`CONSOLE_PORT=8088`) and the live config.


## Surprises & Discoveries

- 2026-11-04: The producer/consumer check matched the sibling plans' shapes, with three corrections.
  `timers_configured` is `null` for `jitsurei-fulfillment` rather than the illustrative `true`, so the seed
  itself exercises the "unknown" state. `state_bytes` is 69. `/snapshot/show` bodies also carry
  `observed_at` and `age_seconds`. Evidence: the bodies under `packages/testing/fixtures/keiro/`.

- 2026-11-04: `STACK_KEIRO_MUTATIONS_PORT` (9094) is declared in `dev/.env.example` and read by nothing, and
  `just smoke-live-mutations` starts no host: it only runs the Playwright spec against whatever is up. So
  there is no mutation host to switch; `dev/README.md` and the spec's header now name `jitsurei-ops-http
  --enable-mutations` as the host to start by hand for the default profile.

- 2026-11-04: `just jitsurei-all` appends rather than resets, and tests depend on what one seed produces:
  recording over the accumulated database (95 events, stale 2026-10-21 rows) failed 8 tests on page counts
  and first rows. `pgmq_dev` had drifted the same way, with 154 dead letters from the simulator. So the
  fixtures come from a new `jitsurei` (31 events) and reset demo queues, and `dev/README.md` now documents
  this as "Re-recording fixtures" (FRIC-8 in `docs/friction-log/`). The earlier database is kept as
  `jitsurei_before_ep22`, not dropped.

- 2026-11-04: The acceptance line "no `derived: true` on `keiro/aggregate-*` or `keiro/pm-*`" holds for every
  body a hook-mounting host can produce. Three refusals cannot be recorded from it, and stay derived from a
  live capture of the standalone `keiro-ops-http`: `aggregate-types.error.json`, `pm-list.error.json`, and the
  new `pm-types.error.json`, which `docs/plans/23-list-mounted-process-managers-from-the-ops-catalog.md` needs.

- 2026-11-04: `projection-status.json` stays derived, contrary to this plan's Decision Log wording, because
  tests need one group per display case (rebuilding, failed) that the seed does not produce. Its rows carry
  `feeding_subscriptions`, including one group with two names. The real shape is
  `projection-status.recorded.json`, whose managed group is fed by `jitsurei-order-audit-subscription`. Derived
  distances are now relative to the recorded head, so the literals in tests survive a reseed.

- 2026-11-04: Added `aggregate-list-credit-limit`, beyond the listed slugs, so a screen can reach the register
  aggregate from its list in mock mode.


- 2026-11-04, kiroku origin (fixed): Proved on a second kiroku-inspect with no allow-list: an upgrade with
  `Origin` gets `403 origin_not_allowed`, and one without gets 101. pgmq-inspect and the shibuya example answer
  101 to a foreign `Origin`, and keiro answers 101 to its own `Host` and 403 otherwise, so kiroku is the only
  server Recipe A must configure. Recipes A and B, the Caddy and nginx examples, and
  `docs/user/application-integration.md` now say so. `docs/deployment/kubernetes/README.md` already requires the
  public origin at each upstream, and ADR-9 already states that upstream Origin checks remain, so neither
  changes. A new production test receives `/ws/events` frames through Caddy, and is refused when run from an
  origin kiroku does not list (`CONSOLE_PORT=8089`).

- 2026-11-04, `view_retiring` (fixed): keiro sends it on `subscribe` while a view's last subscriber is still
  being cleaned up, and its guide says to retry. The console treated it as a generic error, so a quick return to
  a screen left a socket with no subscription, reporting `live` on polling alone, until the next reconnect.
  Dialects now name retryable codes, and `openFeed` re-sends with backoff.

- 2026-11-04, keiro 0.22's other errors (not applicable): `403 origin_not_allowed` reaches the console through the
  shared error handling, as it did before. `415 unsupported_media_type` cannot arise from the console, because
  `packages/client-core/src/http.ts` sends `application/json` with every body.

- 2026-11-04, reaction provenance (no change needed): The recorded `pm-show.json` has `provenance: null` and
  `provenance_status: "unavailable"`; `LastReactionCard.tsx` already renders it as information, and the
  `process-managers` Playwright spec passes against the recording.

- 2026-11-04, shibuya control (no console change): The rebuilt consumer serves `/control` as
  `{"enabled":false,"operations":["pause","resume"]}` and refuses a pause with `403 control_disabled`, so both are
  recorded instead of derived, and the live suite asserts the disabled gate with its reason. It still serves only
  basic metrics, so `/metrics` stays derived from the golden file.

- 2026-11-04, pgmq-inspect 0.7.0.0 (copied): The `jq -S` diff of the OpenAPI document shows only the version
  string; the client's generated types and tests are unchanged.

- 2026-11-04, stale text (corrected): `packages/client-keiro/README.md`, `REDRIVE_UNAVAILABLE`, and the comments in
  `dev/process-compose.yaml` and `scripts/derive.ts`.

- 2026-11-04: Port 8080 on this machine is held by a running Redpanda Console container, and the production
  Playwright config's `reuseExistingServer` silently tests whatever answers there, so `just smoke-production`
  fails in confusing ways (FRIC-7 in `docs/friction-log/`). The stack allow-lists 8088 too, for this reason.


## Decision Log

- Decision: The `jitsurei` stack profile runs `jitsurei-ops-http` on port 9093 in place of the
  standalone `keiro-ops-http`, and the `mori` profile keeps the standalone binary.
  Rationale: `jitsurei-ops-http` is the only runnable host that mounts the hook-gated routes, and it
  shares the standalone host's flags and lifecycle through `Keiro.Ops.Http.Host`. The `mori` profile
  reads another application's database, whose schema the jitsurei hooks do not describe. Component
  tests continue to prove the "not mounted" state, so the local stack does not have to.
  Date: 2026-11-04

- Decision: Fixtures for hook-gated routes are recorded from the live host, and `derive.ts` keeps
  deriving only bodies that a host still cannot produce (kiroku subscriptions and dead letters,
  shibuya detailed metrics, pending and stuck timers).
  Rationale: a hand-written body can only agree with what its author read; a recorded body proves
  what the server sends. Derivation stays where the seed produces nothing to record.
  Date: 2026-11-04


## Outcomes & Retrospective

Complete on 2026-11-04. Port 9093 now runs `jitsurei-ops-http` built from the current checkouts, and aggregate and
process-manager fixtures are recorded from it, so `/aggregates` and `/process-managers/jitsurei-fulfillment` show
live data and nothing says "not mounted". The new bodies the feature plans consume are in place under the agreed
slugs. Final evidence: `bun run check`; `bun run test` (632 passed, 13 skipped); `bun run test:e2e` (56);
`bun run test:e2e:multi-app` (9); `CONSOLE_PORT=8088 bun run test:e2e:production` (11); the live config (3 passed, 2
mutating tests skipped by design).

The audit found one real console defect, the unretried `view_retiring` refusal, and one false deployment claim, the
kiroku origin rule. Both would have been invisible on screen because polling carries the data, so each now has a
test of the socket itself. The lesson for later plans is that a poll-backed feed fails silently, so a feed behaviour
needs a test that watches the feed.

Friction: FRIC-7 is accepted, since `CONSOLE_PORT` is a sufficient override for a machine-local conflict. FRIC-8 is
resolved by the "Re-recording fixtures" section of `dev/README.md`.


## Context and Orientation

The console talks directly to four servers with no backend of its own
([docs/adr/0005-no-backend-for-frontend.md](../adr/0005-no-backend-for-frontend.md)). Each server is
called a surface. kiroku-inspect (port 9091) serves the event store, pgmq-inspect (9095) serves
queues, the shibuya example consumer (9090) serves processor metrics, and keiro-ops-http (9093)
serves keiro's operator command tree as JSON. `dev/README.md` describes the local stack.
`dev/build.sh` builds each executable inside its owning checkout and links it into `dev/bin`, and
`dev/process-compose.yaml` starts the processes. Checkout paths come from `dev/.env`, copied from
`dev/.env.example`. `dev/check.sh` probes every HTTP route and WebSocket upgrade.

keiro's command tree is mechanical: `GET /wf/inspect/list?limit=1` is the CLI command
`wf inspect list --limit 1`, and there is no hand-written route table
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-53`). Some commands exist only when the application
mounts hooks, meaning it passes its own catalogs through the `AppHooks` record of
`mori://shinzui/keiro/packages/keiro-ops`. Without them, keiro answers `400 invalid_request`, which
`packages/client-keiro/src/errors.ts` turns into `RouteUnavailable`.

Keiro's new `jitsurei-ops-http` executable (`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55`,
source at `jitsurei/ops-http/` in `mori://shinzui/keiro`, artifact-level URI pending) calls
`mainWithHooks (jitsureiOpsHooks Nothing)`. It mounts aggregates, process managers, the projection
catalog, replay audit, workflow resume, and timer firing, and takes the same flags as the standalone
host: `--database-url`, `--port`, repeated `--allow-origin`, `--enable-mutations`. It is read-only
unless `--enable-mutations` is passed. The keiro guide `docs/guides/serve-keiro-ops-over-http.md`
in `mori://shinzui/keiro` (artifact-level URI pending) documents it in "See the hook-gated routes
locally".

Test data lives in `packages/testing`. `manifests/<surface>.json` lists the requests to record, with
`pins` holding the ids a request template expands (`{aggregate_id}` and so on). `bun run
fixtures:record [surface...]` replays each manifest against the running stack and writes bodies byte
for byte under `fixtures/<surface>/`, with provenance in `fixtures/_meta.json`.
`scripts/derive.ts` then writes the bodies no host can produce and marks them `derived: true`. The mock
server in `src/handlers.ts` builds its routes from `_meta.json`, so a newly recorded route is served
to tests with no handler code. Pins change whenever the jitsurei database is reseeded, because seed
ids contain timestamps.

Relevant decisions: [ADR-9](../adr/0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md)
covers same-origin proxy deployment, [ADR-13](../adr/0013-honest-gates.md) requires the console to
name a missing capability instead of showing an error, and
[ADR-10](../adr/0010-64-bit-integers-are-bigint-end-to-end.md) is why fixtures are stored byte for
byte: ids and positions may exceed 2^53.


## Plan of Work

### Milestone 1: the stack runs the current runtime

Add `jitsurei-ops-http` to `dev/build.sh` as a `keiro` target (`jitsurei-ops-http:exe:jitsurei-ops-http`),
keeping the existing `keiro-ops-http` build for the `mori` profile. In `dev/process-compose.yaml`,
start `dev/bin/jitsurei-ops-http` on `$STACK_KEIRO_PORT` with the same database and origin flags, keep
the process name, and correct the comment above it. In `dev/process-compose.mori.yaml`, make the
`mori` profile run the standalone binary. Confirm what `smoke-live-mutations` in `justfile` and
`STACK_KEIRO_MUTATIONS_PORT` (9094) start, and use the hook-mounted host for mutations in the jitsurei
profile too. Rebuild everything, reseed so the database carries current migrations (keiro's
`jitsurei-migrate` runs inside its `jitsurei-all` recipe), and extend `dev/check.sh` with probes for
`/aggregate/types`, `/pm/types`, `/projection/status`, and `/snapshot/show`. Update the surface table
and troubleshooting notes in `dev/README.md`.

This milestone is the initiative's representative producer/consumer check. Before going further,
parse real `/pm/types`, `/projection/status`, and `/snapshot/show` bodies by adding them to
`packages/client-keiro/test/live/reads.live.test.ts` with temporary zod schemas if needed. If a body
differs from the shape the sibling plans describe, correct those plans first. The expected bodies are
below in Interfaces and Dependencies.

### Milestone 2: recorded fixtures

Update the `pins` in `packages/testing/manifests/keiro.json` to the fresh seed: find ids with
`/wf/inspect/list`, `/aggregate/list?name=order&limit=1`, and `/pm/list?name=jitsurei-fulfillment&limit=1`.
Add pins `register_aggregate_type` (`credit-limit`), `register_aggregate_id`, and `register_stream`
(`creditLimit-<id>`), found from `/aggregate/list?name=credit-limit&limit=1`, whose rows carry
`stream_name`. Add these entries, each with its query where one is shown: `pm-types` (`/pm/types`),
`aggregate-types`, `aggregate-list`, `aggregate-show`, `aggregate-snapshot`, `pm-list`, `pm-show`,
`aggregate-show-credit-limit`, `aggregate-snapshot-credit-limit`, `snapshot-show-credit-limit`
(`/snapshot/show?stream={register_stream}`), and `snapshot-show-missing`
(`/snapshot/show?stream=order-missing`, whose body is `null`). Remove from `scripts/derive.ts` every
aggregate and process-manager body that is now recorded, and update its header comment. Run
`bun run fixtures:record`, then the derive step, then the suites. Fix tests that embed old ids by
reading `pins` rather than by pasting new literals. `dev/multi-app/inspection-fixtures.ts` also reads
this data; run `bun run test:e2e:multi-app`.

### Milestone 3: upstream behaviour audit

Check each of these upstream changes against the console and record the result in this plan's
Surprises & Discoveries.

kiroku-metrics 0.4.0.0 refuses a WebSocket upgrade carrying any `Origin` header with `403
origin_not_allowed` when CORS is disabled. Browsers always send `Origin`, including through a
same-origin proxy. `docs/user/deployment.md` Recipe A says "No server needs CORS", which is no longer
true for kiroku's live feeds. Prove it first (see Concrete Steps), then correct Recipe A, the matching
Caddyfile comment in `docs/deployment/`, and `docs/deployment/kubernetes/README.md` if it needs it, so
that the public console origin is allow-listed at kiroku. State keiro's rule alongside it: keiro
admits an upgrade from an allow-listed `Origin` or its own `Host`.

keiro 0.22 adds or tightens these errors: `403 origin_not_allowed` with scheme, host, and port
normalization, `415 unsupported_media_type` on nonempty confirmations, and an in-band WebSocket
`view_retiring` code while a view shuts down. `packages/client-keiro/src/feeds/` has no mention of
`view_retiring`. Read `keiro-ops-http/src/Keiro/Ops/Http/Feed.hs` and `WebSocket.hs` in
`mori://shinzui/keiro` to find when it is sent, confirm the feed falls back to polling and resubscribes
as other in-band errors do ([ADR-12](../adr/0012-poll-first-live-queries.md)), and add a test in
`packages/client-keiro/test/feeds.test.tsx`.

keiro 0.22 also changes `pm show` and `pm list` for reaction process managers, whose provenance is now
explicitly unavailable. Confirm `apps/console/src/features/process-managers/LastReactionCard.tsx` renders
that against a recorded `pm-show` body.

The shibuya example consumer now depends on `shibuya-metrics ^>=0.12.0.0` rather than 0.10. Expect
`/control` to exist and report disabled, so the processor Control card should move from "no control
surface" to the disabled gate with its reason. Check `apps/console/src/features/processors/control-status.tsx`,
correct the comment in `dev/process-compose.yaml` and the shibuya note in `scripts/derive.ts`, and
re-record shibuya. Whether the consumer now serves detailed metrics is also checked here. shibuya's
long-running example request (`mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-9`) is
still proposed, so keep deriving what the host cannot produce.

pgmq-inspect 0.7.0.0 changes nothing in its OpenAPI document except the version string (verified with
a `jq -S` diff on 2026-11-04). Copy `pgmq-inspect/test/golden/openapi.json` from
`mori://shinzui/pgmq-hs` to `packages/client-pgmq/openapi/pgmq-inspect.openapi.json`, regenerate, and
update `SOURCE.md`.

Finally, correct text the upstream work has made stale: `packages/client-keiro/README.md` says no
runnable host mounts the hook-gated routes; `REDRIVE_UNAVAILABLE` in
`apps/console/src/features/queues/dead-letter.ts` calls adapter redrive merely "proposed". The adapter
0.18.0.0 ships `Shibuya.Adapter.Pgmq.DeadLetter` as an in-process Haskell API with no HTTP surface, so
the sentence should say there is no HTTP endpoint. Do not add any new capability for it.


## Concrete Steps

Run from the repository root inside `nix develop`, with `dev/.env` in place.

```bash
just stack-build
just stack-seed
just stack-up          # foreground; run the rest in a second terminal
just stack-check
curl -fsS http://127.0.0.1:9093/health
curl -fsS http://127.0.0.1:9093/aggregate/types
curl -fsS http://127.0.0.1:9093/pm/types
```

`/health` answers with `"status":"ok"` and an empty `schema_drift`. If it reports drift, the database
predates a migration: run `just stack-seed` again. Prove the kiroku origin rule before editing the
guide, by starting a second kiroku-inspect with no `--cors-origin` and attempting an upgrade with an
`Origin` header.

```bash
dev/bin/kiroku-inspect --port 9191 &   # add the database flag used in dev/process-compose.yaml
curl -si -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: http://localhost:8080' \
  http://127.0.0.1:9191/ws/events | head -1
```

Expect `HTTP/1.1 403`. Then re-record and test.

```bash
bun run fixtures:record
bun run --filter @keiro-ui/testing derive
bun run check
bun run test
bun run test:e2e
bun run test:e2e:multi-app
cd apps/console && bunx playwright test --config playwright.live.config.ts
```


## Validation and Acceptance

With the stack up and `bun run dev` running, `http://localhost:5173/aggregates` lists `credit-limit`,
`incident`, and `order`, and `http://localhost:5173/process-managers/jitsurei-fulfillment` lists
instances with correlation ids beginning `demo-`. No page says "not mounted". The processor page
reports the state the Milestone 3 check established.

`git diff packages/testing/fixtures/_meta.json` shows current source commits and no `derived: true` on
`keiro/aggregate-*` or `keiro/pm-*`. `bun run check`, `bun run test`, `bun run test:e2e`, and the live
Playwright config pass. The deployment guide's Recipe A no longer says that no server needs CORS, and
a browser behind `dev/caddy/Caddyfile` with kiroku's origin configured receives `/ws/events` frames.
Each item in Milestone 3 has a dated entry in Surprises & Discoveries.


## Idempotence and Recovery

Every stack and record command can be rerun. `fixtures:record` overwrites bodies byte for byte, so
`git diff` shows exactly what changed; `git checkout packages/testing/fixtures` undoes a bad recording.
Reseeding changes ids, so update pins and re-record together. Do not hand-edit recorded bodies. The
second kiroku-inspect on port 9191 reads only; stop it after the check. No step here runs a mutation
against any database other than the local seed. If an upstream checkout will not build, record it as
friction, report which surface is blocked, and do not pin the stack to an older version silently.


## Interfaces and Dependencies

This plan has no prerequisite and is a hard dependency of
`docs/plans/23-list-mounted-process-managers-from-the-ops-catalog.md`,
`docs/plans/24-show-feeding-subscriptions-on-projection-groups.md`, and
`docs/plans/25-inspect-registers-and-stored-snapshots-on-aggregates.md`. Those plans consume the
stack on port 9093 and these fixture files under `packages/testing/fixtures/keiro/`: `pm-types.json`;
`projection-status.json` with `feeding_subscriptions`; `aggregate-show-credit-limit.json`;
`aggregate-snapshot-credit-limit.json`; `snapshot-show-credit-limit.json`; and
`snapshot-show-missing.json`. Keep those slugs, and report any renaming in the parent MasterPlan.

The expected bodies, from keiro source at commit `9da47eb7`, are as follows. `feeding_subscriptions` is
unreleased in 0.23.0.0, so the keiro checkout must contain commit `3e9fbacd` or later.

```json
{"items":[{"name":"jitsurei-fulfillment","category":"fulfillment","snapshots_configured":false,"snapshot_policy":"never","timers_configured":true}]}
```

```json
{"stream":"creditLimit-<id>","stream_version":1,"state":{"state":"credit_reviewed","registers":{"active":false,"balance":25}},"state_codec_version":1,"regfile_shape_hash":"...","state_shape_hash":"...","state_bytes":60,"created_at":"...","updated_at":"..."}
```

The values shown for `timers_configured`, `state_codec_version`, and `state_bytes` are illustrative;
Milestone 1 replaces them with recorded evidence. Projection rows gain a sorted array,
`"feeding_subscriptions":["jitsurei-order-reporting"]`, empty for inline-only and unmanaged groups.
