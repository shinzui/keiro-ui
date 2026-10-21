---
id: 9
slug: provision-the-local-runtime-stack-and-recorded-fixtures
title: "Provision the local runtime stack and recorded fixtures"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
---

# Provision the local runtime stack and recorded fixtures

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (the React application this repository will contain, see
`docs/masterplans/2-build-the-keiro-runtime-console.md`) reads from four independently
owned HTTP/WebSocket "inspection surfaces": kiroku's `kiroku-inspect` (streams, events,
subscriptions, dead letters), pgmq-hs's `pgmq-inspect` (queues, messages, archives),
shibuya's `shibuya-metrics` (processors), and keiro's `keiro-ops-http` (workflows, timers,
projections, aggregates, process managers). Nobody can build or test the console without
those surfaces answering real requests, and nobody wants to start four Haskell servers and a
database to run a unit test.

After this plan, a developer in this repository can run `just stack-up` and get a seeded
PostgreSQL database plus all four surfaces listening on fixed local ports, verified by
`just stack-check`. They can run `pnpm fixtures:record` to capture every response the
console will ever depend on into `packages/testing/fixtures/`, byte for byte. And every
later plan's tests (unit tests under vitest, browser tests under Playwright, and the
console's `VITE_MOCK=1` mode) can import `@keiro-ui/testing` and get those recorded
responses served by Mock Service Worker, including scripted WebSocket feeds, with no
Haskell toolchain present at all. Where no runnable server exists yet for a route the
console needs, this plan hand-derives fixtures from the owning repository's encoders and
files the improvement requests that would close the gap.

You can see it working by running `just stack-check` (every surface answers), then
`pnpm fixtures:record` (fixture files appear with a `_meta.json` naming the source commits),
then `pnpm --filter @keiro-ui/testing test` (every fixture parses, every handler answers,
every scripted feed plays snapshot-then-delta in order).


## Progress

- [ ] M1 — Database, seed, and the three keiro-family servers: `just stack-db-up`,
  `just stack-seed`, and `just stack-up` bring up PostgreSQL with the jitsurei seed and
  `kiroku-inspect` (9091), `pgmq-inspect` (9092), and `keiro-ops-http` (9093); `just stack-check`
  reports every HTTP probe and WebSocket upgrade green for those three.
- [ ] M2 — shibuya baseline: the decision in the Decision Log is recorded (jitsurei's own
  metrics server if it has one, otherwise the shibuya-pgmq-adapter example consumer), a
  shibuya-metrics server answers on 9090, and `just stack-check` is green for all four.
- [ ] M3 — Recorder and recorded fixtures: `pnpm fixtures:record` writes one raw-text
  fixture per manifest entry for all four surfaces plus `_meta.json` with source commits,
  versions, and seed name; the pgmq message-id fixture contains an id above 2^53 unchanged.
- [ ] M4 — Mock handlers, scripted feeds, and entry points: `@keiro-ui/testing` exports
  `startMockServer()` (node) and `startMockWorker()` (browser), serves every recorded route
  with cursor-paging emulation and on-demand error envelopes, replays a snapshot-then-delta
  WebSocket script per dialect with an overflow error, and its own test suite passes.
- [ ] M5 — Gaps handled: hand-derived fixtures exist for keiro `/aggregate/*` and `/pm/*`
  and for shibuya detailed metrics and the `terminal`/`error` frames, each marked
  `derived: true` in `_meta.json`; the keiro and shibuya improvement requests are filed,
  validated by their repositories' own recipes, and their handles recorded here.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: Reuse the keiro repository's own PostgreSQL recipes (`just postgres-start`,
  `just db-create`, `just jitsurei-all`) instead of running a second PostgreSQL from this
  repository, and connect every surface to that database over its unix socket.
  Rationale: the jitsurei seed is the only existing dataset that populates kiroku streams,
  keiro workflows, timers, and projection groups in one database, and keiro's dev
  PostgreSQL is deliberately socket-only (`listen_addresses=''`), so pointing the servers at
  `host=<keiro checkout>/db` is simpler and safer than teaching a second instance about
  keiro's migrations.
  Date: 2026-10-21

- Decision: Fixtures store the raw response bytes exactly as received, never a
  re-serialized object.
  Rationale: pgmq message ids and store positions are 64-bit integers that JavaScript's
  `JSON.parse` would round; the recorder must not touch the text, and tests must be able to
  prove the console's lossless parsing against real wire bytes.
  Date: 2026-10-21

- Decision: Routes that no runnable host serves today (keiro `/aggregate/*` and `/pm/*`;
  shibuya detailed metrics, `terminal`, and `error` frames) get fixtures derived from the
  owning repository's encoders and golden files, flagged `derived: true`, and the gaps are
  filed as improvement requests in the owning repositories; the requests are not
  dependencies of any plan in this initiative.
  Rationale: `docs/adr/0005-no-backend-for-frontend.md` and ADR-1's lineage forbid
  building a host for another project's concept here; the console can be built and tested
  against derived fixtures and re-recorded when the hosts land.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

This repository currently contains documentation only: `docs/architecture/ui-direction.md`
(what the console is), `docs/architecture/inspection-api-conventions.md` (the wire rules
all four surfaces follow: `snake_case` fields on new routes, cursor pages as
`{items, next_cursor?}` with `next_cursor` omitted on the last page, errors as
`{"error": {"code", "message", "details"?}}`, WebSocket frames tagged by `type` with
snapshot-then-delta and in-band `error` frames), `docs/adr/` (decisions), and the plans. The
TypeScript workspace is created by `docs/plans/7-scaffold-the-console-workspace-and-design-system.md`
(EP-7); this plan's Haskell-side milestones (M1, M2) do not need it, and its TypeScript
milestones (M3, M4, M5) assume EP-7 has produced `pnpm-workspace.yaml`, `apps/console`, and
an empty `packages/testing` directory with a `package.json` named `@keiro-ui/testing`. If
`packages/testing/package.json` does not exist when you reach M3, create it as described in
Concrete Steps; EP-7 will not overwrite it.

Terms used below. An **inspection surface** is an HTTP + WebSocket server one of the
runtime libraries ships as a sister package so a browser can read its state; the four we
run are named in the port table. A **fixture** is one HTTP response (status, content type,
raw body text) captured from a real surface and stored under `packages/testing/fixtures/`.
**MSW** (Mock Service Worker, npm package `msw`, major version 3) intercepts `fetch` and
WebSocket connections in Node and in the browser and answers them from handlers we write;
it lets tests and the console run without any server. **process-compose** is a small
process supervisor driven by a YAML file; keiro and pgmq-hs already use it for their dev
databases. **jitsurei** is keiro's worked-example application (`jitsurei/` in the keiro
checkout) whose `just jitsurei-all` recipe migrates and populates a database named
`jitsurei` with aggregates, workflows, timers, and projections. A **prefix** is the path
under which the console reaches a surface (`/kiroku`, `/shibuya`, `/pgmq`, `/keiro`); in
development the Vite dev server (owned by EP-7) proxies each prefix to the port below.

The port and prefix table is fixed by the MasterPlan's Integration Points and must not be
changed here:

```text
surface   dev server                 dev port   prefix     WebSocket path(s)
shibuya   shibuya-metrics            9090       /shibuya   /shibuya/ws
kiroku    kiroku-inspect             9091       /kiroku    /kiroku/ws/metrics, /kiroku/ws/events
pgmq      pgmq-inspect               9092       /pgmq      /pgmq/ws
keiro     keiro-ops-http             9093       /keiro     /keiro/ws
console   vite dev server            5173       /          (application routes)
```

The sibling checkouts this plan builds from, with the commits the MasterPlan audited on
2026-10-21 (pin these in `_meta.json`; later commits are fine if you record them):

- kiroku at `/Users/shinzui/Keikaku/bokuno/kiroku-project/kiroku` (`ea364cf`): package
  `kiroku-metrics` 0.3.0.1 ships the `kiroku-inspect` executable
  (`kiroku-metrics/app-inspect/Main.hs`, options in `kiroku-metrics/src/Kiroku/Metrics/Standalone.hs`).
  Routes are hand-routed in `kiroku-metrics/src/Kiroku/Metrics/Server.hs`; the contract for
  UI builders is `docs/guides/building-an-inspection-ui.md` and `docs/user/metrics.md`.
  Flags: `--schema` (or `KIROKU_INSPECT_SCHEMA`), `--pool-size`, `--port`, repeatable
  `--cors-origin` (or `KIROKU_INSPECT_CORS_ORIGINS`), `--ws-max-connections`; the database
  comes from `DATABASE_URL`. It runs no subscriptions and applies no migrations.
- pgmq-hs at `/Users/shinzui/Keikaku/bokuno/libraries/pgmq-hs-project/pgmq-hs` (`d6750a6`):
  package `pgmq-inspect` 0.1.0.0, executable `pgmq-inspect`
  (`pgmq-inspect/app/PgmqInspectCli.hs`; flags `--database-url`, `--host`, `--port`,
  repeatable `--cors-origin`, `--poll-interval-ms`, `--pool-size`, `--no-listener`; env
  `PGMQ_INSPECT_DATABASE_URL`). Contract: `docs/user/queue-inspection.md`,
  `docs/design/021-inspection-surface-wire-contract.md`, and the served OpenAPI document
  checked in at `pgmq-inspect/test/golden/openapi.json`. `nix build .#pgmq-inspect` yields
  `result/bin/pgmq-inspect`. The server installs nothing: the pgmq schema (extension or
  pgmq-migration's native schema) must already exist in the target database.
- shibuya at `/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya` (`0967f45`): package
  `shibuya-metrics` 0.10.0.1 with an Unreleased changelog holding CORS, control, detailed
  metrics, and `error`/`terminal` frames. Contract: `docs/architecture/METRICS.md` and the
  golden `shibuya-metrics/test/golden/processor-metrics.json.golden`. There is no standalone
  executable: a metrics server exists only inside an application that starts one.
  `shibuya-example` (`just example`) starts one on 9090 and exits after about five seconds.
- shibuya-pgmq-adapter at `/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya-pgmq-adapter`
  (`c443ac3`): its `shibuya-pgmq-example` consumer (`just example-consumer`, metrics port
  from `METRICS_PORT`, default 9090) runs indefinitely against the adapter's own dev
  PostgreSQL (`just process-up`) with `just example-simulator` producing load, but it builds
  against Hackage `shibuya-metrics ^>=0.10.0.0`, so it serves basic metrics only: no
  `latency`/`oldestInFlight`/`progress` fields, no `/control` routes, no `error` frames.
- keiro at `/Users/shinzui/Keikaku/bokuno/keiro` (`5893c7eb` or later): package
  `keiro-ops-http` 0.21.0.0 (unreleased) with executables `keiro-ops-http`
  (`keiro-ops-http/app/Main.hs`; flags `--database-url`, `--bind`, `--port`, repeatable
  `--allow-origin`, `--enable-mutations`, `--allow-schema-drift`, `--request-timeout`; env
  `KEIRO_OPS_DATABASE_URL` or `DATABASE_URL`) and `keiro-ops-http-compose-example`
  (`keiro-ops-http/example/Compose.hs`, built only with the cabal flag `compose-example`).
  Contracts: `docs/guides/serve-keiro-ops-over-http.md`,
  `docs/guides/stream-keiro-inspection-views.md`,
  `docs/guides/compose-runtime-inspection-surfaces.md`. Both executables use
  `emptyAppHooks`, so `/aggregate/*` and `/pm/*` do not exist in any process you can start,
  although `jitsurei/src/Jitsurei/Inspection.hs` defines the inspectors; the JSON encoders
  are `keiro/src/Keiro/Inspection/Aggregate.hs` and `keiro/src/Keiro/ProcessManager/Inspect.hs`,
  and `keiro-ops-http/test/Main.hs` has a `seedInspection` helper. keiro's dev PostgreSQL
  (`Justfile`, `[group('database')]`) listens only on the unix socket directory `db/` inside
  the keiro checkout with `listen_addresses=''`; the jitsurei database is named `jitsurei`,
  the kiroku schema inside it is `kiroku`, and the projection schema is `jitsurei`.

Relevant local decisions: `docs/adr/0003-push-is-a-hint-poll-is-truth.md` (every feed
script must be reconcilable from the poll fixture it accompanies, and overflow must be
scripted so the console's re-read path is exercised) and
`docs/adr/0005-no-backend-for-frontend.md` (this plan runs the owners' servers and mocks
their wire formats; it never aggregates them). Cross-repository:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` (keiro ships no browser application and
its inspection surface is a bare WAI application, which is why the aggregate hooks gap is
keiro's to close), `mori://shinzui/kiroku/okf/adrs/concepts/ADR-18` (kiroku's surface is
self-describing through `/capabilities`, which `stack-check` and the recorder use as the
discovery entry point), and `mori://shinzui/pgmq-hs/okf/capabilities/concepts/CAP-12` (the
shipped pgmq-inspect surface and its served OpenAPI document).


## Plan of Work

**Milestone 1 — database, seed, and the keiro-family servers.** Create `dev/` with a
README, an `.env.example`, a `process-compose.yaml`, and justfile recipes. `stack-db-up`
delegates to keiro's `just postgres-start` and `just jitsurei-db-create`; `stack-seed` runs
keiro's `just jitsurei-all`, then checks whether the jitsurei database already carries a
`pgmq` schema (keiro-pgmq uses pgmq-migration's native schema; verify with `psql -c '\dn'`).
If it does, `stack-seed` also creates and fills demo queues using the seed SQL from pgmq-hs's
`docs/user/queue-inspection.md` so the pgmq surface has something to show; if it does not,
record that in Surprises & Discoveries and point `pgmq-inspect` at pgmq-hs's own dev
database instead (`just process-up` in that checkout), which is acceptable because queues
and streams never cross-link in the console. `stack-build` builds `kiroku-inspect`,
`pgmq-inspect`, and `keiro-ops-http` from the sibling checkouts into `dev/bin/` (symlinks to
`cabal list-bin` results or the nix `result/bin`), and `stack-up` starts them through
`process-compose` on 9091, 9092, and 9093 with the console's dev origin on each CORS
allowlist (harmless in development, required for the separate-origins deployment test later).
`stack-check` curls each surface and attempts each WebSocket upgrade. At the end of M1,
`just stack-check` prints green for kiroku, pgmq, and keiro.

**Milestone 2 — the shibuya baseline.** First look in the keiro checkout for any shibuya
metrics server the jitsurei application starts (search `jitsurei/` for `Shibuya.Metrics` or
`startMetricsServer`; at the time of writing there is none). If one exists, use it. Otherwise
run the shibuya-pgmq-adapter example consumer with `METRICS_PORT=9090` against the adapter's
dev PostgreSQL, with the simulator producing load, and accept that it serves basic metrics
only. Record the choice in the Decision Log. Add it to `process-compose.yaml` and
`stack-check`. At the end of M2 all four probes are green.

**Milestone 3 — the recorder.** Write `packages/testing/manifests/<surface>.json`, one
entry per request the console will make (method, path template, query, the expected
status, and for list routes the instruction to follow `next_cursor` once so a second page
is recorded). Write `packages/testing/scripts/record.ts`, run with `pnpm fixtures:record`,
which reads `dev/.env`, resolves path parameters by first fetching the list routes and
taking the first item (a stream name, a queue name, a message id, a workflow name and id,
a timer id, a subscription name), performs each request against the local ports, and
writes the raw body text to `packages/testing/fixtures/<surface>/<slug>.json` with status
and content type in `_meta.json`. Record error responses too (unknown stream, bad limit,
bad cursor, control disabled, mutations disabled). Optionally start a second
`keiro-ops-http` with `--enable-mutations` on 9094 to record a mutation *preview* (an empty
POST body changes nothing) for EP-19. At the end of M3 the fixture tree exists and the pgmq
message fixture round-trips an id above 2^53 byte for byte.

**Milestone 4 — mock handlers and feeds.** Implement `packages/testing/src/handlers/<surface>.ts`
(MSW `http` handlers matched on `*/<prefix>/...` so the same handlers work for
`http://localhost:5173/kiroku/streams` in the browser and for relative URLs in Node),
`packages/testing/src/feeds/<surface>.ts` (MSW `ws` handlers that play a script per
dialect), `packages/testing/src/scenario.ts` (a small API to swap a route's response for a
recorded error fixture or to inject an overflow into a feed), `src/node.ts`
(`startMockServer()`), and `src/browser.ts` (`startMockWorker()`), plus the worker file in
`apps/console/public/`. Write the package's own tests. At the end of M4
`pnpm --filter @keiro-ui/testing test` passes.

**Milestone 5 — gaps.** Derive fixtures for keiro `/aggregate/types`, `/aggregate/list`,
`/aggregate/show`, `/aggregate/snapshot`, `/pm/list`, `/pm/show`, and for shibuya detailed
metrics plus `terminal` and `error` frames, from the owners' encoders and goldens; mark
them `derived: true`. File the two improvement requests in the owning repositories and
record their handles in Progress. At the end of M5 every route any screen plan names has
a fixture, recorded or derived.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless a
`cd` is shown. `just` is available in the Nix dev shell EP-7 provides and on the host.

**M1.** Create `dev/.env.example`:

```bash
# Checkout paths of the owning repositories (override to match your machine).
KIROKU_REPO=/Users/shinzui/Keikaku/bokuno/kiroku-project/kiroku
PGMQ_HS_REPO=/Users/shinzui/Keikaku/bokuno/libraries/pgmq-hs-project/pgmq-hs
SHIBUYA_REPO=/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya
SHIBUYA_PGMQ_ADAPTER_REPO=/Users/shinzui/Keikaku/bokuno/shibuya-project/shibuya-pgmq-adapter
KEIRO_REPO=/Users/shinzui/Keikaku/bokuno/keiro
# keiro's dev PostgreSQL is socket-only; the socket directory is <KEIRO_REPO>/db.
STACK_PG_SOCKET_DIR=${KEIRO_REPO}/db
STACK_PG_USER=${USER}
STACK_PG_DATABASE=jitsurei
# libpq key=value form; every surface accepts it.
STACK_DATABASE_URL="host=${STACK_PG_SOCKET_DIR} dbname=${STACK_PG_DATABASE} user=${STACK_PG_USER}"
STACK_CONSOLE_ORIGIN=http://localhost:5173
```

Copy it to `dev/.env` (git-ignored; add `dev/.env` and `dev/bin/` to `.gitignore`). Add
recipes to the root `justfile` (EP-7 creates it; if it does not exist yet, create it with
only these recipes and EP-7 will merge):

```just
set dotenv-load := true
set dotenv-filename := "dev/.env"

# Start keiro's socket-only dev PostgreSQL and ensure the jitsurei database exists.
stack-db-up:
    just -f "$KEIRO_REPO/Justfile" -d "$KEIRO_REPO" postgres-start
    just -f "$KEIRO_REPO/Justfile" -d "$KEIRO_REPO" jitsurei-db-create

# Migrate and populate the jitsurei database, then seed demo queues when pgmq is present.
stack-seed: stack-db-up
    just -f "$KEIRO_REPO/Justfile" -d "$KEIRO_REPO" jitsurei-all
    bash dev/seed-queues.sh

# Build the inspection executables from the sibling checkouts into dev/bin.
stack-build:
    bash dev/build.sh

# Start all surfaces under process-compose (foreground; Ctrl-C stops them).
stack-up: stack-db-up
    process-compose up -f dev/process-compose.yaml

stack-down:
    process-compose down -f dev/process-compose.yaml || true

# Probe every surface over HTTP and attempt every WebSocket upgrade.
stack-check:
    bash dev/check.sh
```

`dev/build.sh` runs, in each checkout, `cabal build exe:kiroku-inspect` then
`ln -sf "$(cabal list-bin exe:kiroku-inspect)" dev/bin/kiroku-inspect`; `nix build .#pgmq-inspect -o dev/bin/pgmq-inspect-result`
in the pgmq-hs checkout and links `dev/bin/pgmq-inspect`; and in keiro
`cabal build -f compose-example exe:keiro-ops-http exe:keiro-ops-http-compose-example` with
links for both. Use `nix develop -c cabal ...` where the checkout expects its dev shell.

`dev/process-compose.yaml` declares one process per surface, each with a readiness probe:

```yaml
version: "0.5"
log_location: ./.dev/stack.log
processes:
  kiroku-inspect:
    command: >-
      env DATABASE_URL="$STACK_DATABASE_URL" KIROKU_INSPECT_SCHEMA=kiroku
      dev/bin/kiroku-inspect --port 9091 --cors-origin "$STACK_CONSOLE_ORIGIN"
    readiness_probe:
      http_get: { host: 127.0.0.1, port: 9091, path: /health/live }
  pgmq-inspect:
    command: >-
      env PGMQ_INSPECT_DATABASE_URL="$STACK_DATABASE_URL"
      dev/bin/pgmq-inspect --port 9092 --cors-origin "$STACK_CONSOLE_ORIGIN"
    readiness_probe:
      http_get: { host: 127.0.0.1, port: 9092, path: /health/live }
  keiro-ops-http:
    command: >-
      dev/bin/keiro-ops-http --database-url "$STACK_DATABASE_URL" --port 9093
      --allow-origin "$STACK_CONSOLE_ORIGIN"
    readiness_probe:
      http_get: { host: 127.0.0.1, port: 9093, path: /health }
```

`dev/seed-queues.sh` checks `psql -h "$STACK_PG_SOCKET_DIR" -d jitsurei -Atc "select 1 from pg_namespace where nspname='pgmq'"`;
when it prints `1`, it runs the seed SQL from pgmq-hs's `docs/user/queue-inspection.md`
(create a queue such as `console_demo`, send a few messages with JSON bodies and headers,
archive one) so `/pgmq/queues` is non-empty; otherwise it prints a clear message that pgmq
is absent and the pgmq surface should use pgmq-hs's dev database (document the alternative
`STACK_PGMQ_DATABASE_URL` in `.env.example`).

`dev/check.sh` probes and prints one line per check:

```bash
curl -fsS http://127.0.0.1:9091/capabilities | head -c 200; echo
curl -fsS http://127.0.0.1:9092/ ; echo
curl -fsS http://127.0.0.1:9093/health ; echo
curl -fsS http://127.0.0.1:9090/health/live ; echo
for u in 9091/ws/events 9092/ws 9093/ws 9090/ws; do
  curl -s -o /dev/null -w "ws $u -> %{http_code}\n" \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' "http://127.0.0.1:$u"
done
```

Expected output after M1 (shibuya lines fail until M2):

```text
{"package":"kiroku-metrics","version":"0.3.0.1","routes":{"metrics":true,...},"cors":{"enabled":true},...
{"service":"pgmq-inspect","version":"0.1.0.0","websocket_path":"ws","openapi_path":"openapi.json"}
{"status":"ok","schema_drift":[],"mutations_enabled":false}
ws 9091/ws/events -> 101
ws 9092/ws -> 101
ws 9093/ws -> 101
```

If keiro answers `{"status":"schema_drift",...}` the jitsurei database was migrated by an
older binary: re-run `just stack-seed` with the same checkout you built from.

**M2.** Search the keiro checkout: `grep -rn -E "Shibuya\.Metrics|startMetricsServer" "$KEIRO_REPO/jitsurei"`.
With no hit, add to `process-compose.yaml`:

```yaml
  shibuya-db:
    command: just -f "$SHIBUYA_PGMQ_ADAPTER_REPO/Justfile" -d "$SHIBUYA_PGMQ_ADAPTER_REPO" process-up
  shibuya-consumer:
    command: env METRICS_PORT=9090 just -f "$SHIBUYA_PGMQ_ADAPTER_REPO/Justfile" -d "$SHIBUYA_PGMQ_ADAPTER_REPO" example-consumer
    depends_on: { shibuya-db: { condition: process_started } }
    readiness_probe:
      http_get: { host: 127.0.0.1, port: 9090, path: /health/live }
  shibuya-simulator:
    command: just -f "$SHIBUYA_PGMQ_ADAPTER_REPO/Justfile" -d "$SHIBUYA_PGMQ_ADAPTER_REPO" example-simulator
    depends_on: { shibuya-consumer: { condition: process_healthy } }
```

Read the adapter's `Justfile` first and copy the exact recipe names it uses; the ones above
are the names found on 2026-10-21. `just stack-check` then prints `{"alive":true}` for 9090
and `ws 9090/ws -> 101`.

**M3.** If `packages/testing/package.json` is missing, create it:

```json
{
  "name": "@keiro-ui/testing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./node": "./src/node.ts",
    "./browser": "./src/browser.ts",
    "./scenario": "./src/scenario.ts",
    "./fixtures/*": "./fixtures/*"
  },
  "scripts": { "record": "tsx scripts/record.ts", "test": "vitest run" },
  "dependencies": { "msw": "^3.0.3" },
  "devDependencies": { "tsx": "^4", "vitest": "^5", "ws": "^8", "@types/ws": "^8" }
}
```

and add `"fixtures:record": "pnpm --filter @keiro-ui/testing record"` to the root
`package.json`. Write the manifests. The kiroku manifest, for example, names
`GET /capabilities`, `/health`, `/health/live`, `/health/ready`, `/metrics`,
`/subscriptions`, `/subscription-checkpoints`,
`/subscriptions/{subscription}/dead-letters?limit=100`, `/streams?limit=100`,
`/streams?category={category}&limit=100`, `/streams/{stream}`,
`/streams/{stream}/events?from=0&limit=100` (forward and `direction=backward`),
`/categories?limit=100`, `/categories/{category}/events?from=0&limit=100`,
`/events?from=0&limit=100` (both directions), `/events/{event_id}`, and the error cases
`/streams/does-not-exist` (404), `/events?limit=abc` (400 `invalid_query_parameter`),
`/metrics/does-not-exist` (legacy 404 string envelope). The pgmq manifest names `/`,
`/openapi.json`, `/queues`, `/queues/{queue}`, `/queues/{queue}/metrics`, `/metrics`,
`/queues/{queue}/messages?limit=50`, `/queues/{queue}/messages/{msg_id}`,
`/queues/{queue}/archive?limit=50`, `/queues/{queue}/archive/{msg_id}`,
`/queues/{queue}/bindings`, `/bindings`, `/routing/test?routing_key=console.demo`,
`/notify/throttles`, `/health/live`, `/health/ready`, plus errors `/queues/nope` (404
`queue_not_found`), `/queues/{queue}/messages?limit=0` (400 `invalid_limit`),
`/queues/{queue}/messages/abc` (400 `invalid_message_id`). The shibuya manifest names
`/metrics`, `/metrics/{processor}`, `/health`, `/health/live`, `/health/ready`, `/control`,
and `POST /control/processors/{processor}/pause` (403 `control_disabled`). The keiro
manifest names `/health`, `/wf/inspect/list?limit=100` (plus `status_class=running` and
`ordering=created_desc` variants), `/wf/inspect/header|journal|steps|children|awakeables/{workflow_name}/{workflow_id}`,
`/timer/pending/list?limit=100`, `/timer/stuck/list`, `/projection/status?limit=100`,
`/projection/position?subscription={subscription}`, `/shard/list`,
`/shard/status?subscription={subscription}`, `/stream/show/{stream}?from=0&limit=100`,
`/stream/subscriptions`, `/outbox/backlog`, `/outbox/list?limit=100`, `/inbox/backlog`,
`/inbox/list`, and errors `/wf/inspect/header/nope/nope` (422 `command_failed`),
`/wf/inspect/list?limit=9999` (400 `invalid_page_size`), `/wf/inspect/list?after=garbage`
(400 `invalid_cursor`), `POST /timer/requeue/{timer_id}` (403 `mutations_disabled`). Each
entry carries `follow_next_cursor: true` where a second page should be captured as
`<slug>.page2.json`.

The recorder resolves `{param}` placeholders from the first item of the corresponding list
fixture (recorded first), performs the request with `fetch`, and writes
`await response.text()` unchanged. Run it:

```bash
pnpm fixtures:record
```

Expected transcript (abbreviated):

```text
kiroku   GET /capabilities                      200  packages/testing/fixtures/kiroku/capabilities.json
kiroku   GET /streams?limit=100                 200  packages/testing/fixtures/kiroku/streams-list.json
...
pgmq     GET /queues/console_demo/messages/1    200  packages/testing/fixtures/pgmq/queue-message.json
...
wrote 61 fixtures; _meta.json updated (kiroku ea364cf, pgmq-hs d6750a6, shibuya 0967f45, keiro 5893c7eb; seed jitsurei-all)
```

Prove int64 fidelity by inserting one pgmq message after the sequence has been advanced
past 2^53 (`SELECT setval('pgmq.q_console_demo_msg_id_seq', 9007199254740993)` then
`pgmq.send`), re-recording, and checking
`grep -o '"msg_id":9007199254740994' packages/testing/fixtures/pgmq/queue-message.json`
prints the exact digits.

**M4.** Handlers follow one pattern:

```typescript
// packages/testing/src/handlers/kiroku.ts
import { http, HttpResponse } from "msw"
import { fixture } from "../fixtures"

export const kirokuHandlers = [
  http.get("*/kiroku/capabilities", () => fixture("kiroku", "capabilities")),
  http.get("*/kiroku/streams", ({ request }) => {
    const from = new URL(request.url).searchParams.get("from")
    return from === null ? fixture("kiroku", "streams-list") : fixture("kiroku", "streams-list", { page: 2, cursor: from })
  }),
  // ... one handler per manifest entry
]
```

`fixture()` returns `new HttpResponse(rawText, { status, headers: { "content-type": meta.contentType } })`,
serving page 2 when the requested cursor equals the recorded `next_cursor` and an empty
last page otherwise. `scenario.ts` exports `useScenario({ fail: { kiroku: ["streams-list"] } })`
which swaps the named routes for their recorded error fixtures, and `feedScript(surface, { overflowAfter })`.
Feeds use MSW's `ws.link("ws://*/kiroku/ws/events")` and, on a `subscribe_events` frame,
send `event_stream_started`, then the `event` frames taken from the recorded `events-all`
fixture, then (when `overflowAfter` is set) `{"type":"error","code":"event_stream_overflowed","message":"...","dropped":3}`
before continuing, and `{"type":"goodbye"}` when the scenario closes. The pgmq script sends
`snapshot {queue, metrics, push:true}` then `update {source:"poll"}`, an `error {code:"overflow", queue}`;
the shibuya script sends `snapshot {metrics}`, `update {processor, metrics}`, `terminal`, and
`error {code:"queue_overflow"}` followed by a fresh `snapshot`; the keiro script, for each of
`workflows`, `timers`, `projection_groups`, sends `snapshot {feed, sequence:1, trigger:"subscribe", items}`
then `update {sequence:2, changed, removed}` and `error {code:"queue_overflow", feed}`. Every
frame body is taken from the recorded poll fixture of the same data so the console's
reconcile logic sees consistent keys.

Generate the browser worker once EP-7's app exists:

```bash
pnpm dlx msw init apps/console/public --save
```

Tests under `packages/testing/test/`: `fixtures.test.ts` (every file under `fixtures/`
parses, every manifest slug has a file, `_meta.json` lists every file), `handlers.test.ts`
(start the server, `fetch` each manifest route, compare status and that the body equals the
fixture text), `feeds.test.ts` (open each scripted feed with the `ws` client, assert the
first frame is the dialect's snapshot or `event_stream_started`, assert the overflow error
arrives when requested). Run:

```bash
pnpm --filter @keiro-ui/testing test
```

**M5.** Derived fixtures: from keiro's encoders write `fixtures/keiro/aggregate-types.json`,
`aggregate-list.json`, `aggregate-show.json`, `aggregate-snapshot.json`, `pm-list.json`,
`pm-show.json` using the field names in `keiro/src/Keiro/Inspection/Aggregate.hs`
(`name`, `category`, `aggregate_id`, `stream_name`, `stream_version`, `state_version`,
`hydration{source}`, `state_label`, `state`, `snapshot`, `history{owner, stream_name, head_version}`,
and the `{items, skipped, next_cursor?}` page) and `keiro/src/Keiro/ProcessManager/Inspect.hs`
(`correlation_id`, `journal_stream_name`, `observed_head_version`, `last_reaction`,
`pending_timers`, `waiting_for[{input, target_state}]`), with values consistent with the
recorded jitsurei stream fixtures where possible. From shibuya's golden copy a detailed
`ProcessorMetrics` into `fixtures/shibuya/processor-detailed.json` and script `terminal`
and `error` frames from `docs/architecture/METRICS.md`. Set `"derived": true` and a
`derived_from` path for each in `_meta.json`.

File the keiro request from the keiro checkout:

```bash
cd "$KEIRO_REPO"
okf id next docs/improvement-requests IR --profile docs/improvement-requests/profile.dhall
```

Create `docs/improvement-requests/<slug>.md` with the printed id, imitating the newest
record's frontmatter family exactly (keiro pins okf-profiles v0.5.0 for this bundle:
`timestamp`-era frontmatter, `origin: mori://shinzui/keiro-ui`, `status: proposed`; the
bundle is log-only, no `index.md`). Title it "Provide a runnable inspection host that
mounts the jitsurei aggregate and process-manager hooks"; the body asks for an executable
(or a flag on `keiro-ops-http-compose-example`) that constructs `AppHooks` from
`jitsurei/src/Jitsurei/Inspection.hs` so `/aggregate/*` and `/pm/*` are reachable against
the jitsurei database, and cites this plan by canonical URI
`mori://shinzui/keiro-ui` with path `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
(artifact-level URI pending). Then:

```bash
okf log add docs/improvement-requests IR-<N> --kind Addition -m "Add IR-<N>: runnable inspection host with jitsurei hooks"
okf validate docs/improvement-requests --profile docs/improvement-requests/profile.dhall --profile-enforce --log-enforce
git add docs/improvement-requests && git commit -m "docs(improvement-requests): request a jitsurei-backed inspection host (IR-<N>)"
```

Do the same in the shibuya checkout for "Provide a long-running example that serves
detailed metrics with control and CORS configurable" (ask for `MetricsDetailed`,
`enableControl` and `corsAllowedOrigins` driven by flags or environment — note for any local
shibuya host that enables control: the Vite proxy forwards the browser's `Origin`
(`http://localhost:5173`), and shibuya requires that origin in `corsAllowedOrigins` for
control POSTs even when CORS is otherwise off, so the recipe must set it — and a process that
runs until interrupted). Record both handles in this plan's Progress line for M5.


## Validation and Acceptance

M1 is accepted when, after `just stack-build`, `just stack-seed`, and `just stack-up` in
one terminal, `just stack-check` in another prints the kiroku capabilities object with
`"version":"0.3.0.1"`, the pgmq service descriptor with `"service":"pgmq-inspect"`, keiro's
`{"status":"ok",...}`, and `101` for the three WebSocket upgrades; and
`curl -s 'http://127.0.0.1:9091/streams?limit=3'` returns a non-empty `items` array from
the jitsurei seed.

M2 is accepted when `just stack-check` additionally prints `{"alive":true}` for 9090 and
`101` for `9090/ws`, and `curl -s http://127.0.0.1:9090/metrics` returns at least one
processor whose `state.status` is `processing` or `idle`.

M3 is accepted when `pnpm fixtures:record` exits 0, every manifest entry has a file,
`_meta.json` names the source commits and seed, at least one `*.page2.json` exists for a
surface whose first page had a `next_cursor`, and the int64 check above prints the exact
digits.

M4 is accepted when `pnpm --filter @keiro-ui/testing test` passes and a smoke script in
the test suite starts `startMockServer()`, fetches `http://localhost/kiroku/streams?limit=100`
and `http://localhost/pgmq/queues`, and receives the recorded bodies byte for byte; and
when, with EP-7's console present, `VITE_MOCK=1 pnpm dev` serves a page whose network
requests are answered by the worker (visible in the browser devtools as "(from
ServiceWorker)").

M5 is accepted when every route named in the MasterPlan's endpoint inventory for aggregates,
process managers, and shibuya detail has a fixture whose `_meta.json` entry says
`"derived": true`, `okf validate` passes in both owning repositories with the new requests,
and the handles are recorded in Progress.

The early producer/consumer check the MasterPlan assigns to EP-9 with EP-10 (the client
core fetching kiroku `/capabilities` and a pgmq message with an id above 2^53 through the
Vite proxy) uses this plan's running stack; keep the stack reproducible so EP-10 can run it.


## Idempotence and Recovery

Every recipe is safe to repeat: `stack-db-up` is a no-op when PostgreSQL is running,
`jitsurei-migrate` is idempotent, and `jitsurei-all` re-runs the demo scenarios on top of
existing data (the fixtures therefore depend on the seed name, not on exact counts; tests
compare recorded bodies to themselves, never to live data). `stack-build` relinks binaries.
`stack-up` fails fast on a port conflict; run `just stack-down` or `lsof -i :9091` to find
the holder. Re-recording overwrites fixtures and `_meta.json`; commit the previous versions
first so a bad recording is one `git checkout` away. If a server refuses with
`schema_drift`, rebuild and re-seed from the same checkout. Derived fixtures are re-derived
by hand; when a real host lands, record over them and drop the `derived` flag in the same
commit. Filing an improvement request twice is prevented by `okf id next`: check the log
for an existing request before allocating.


## Interfaces and Dependencies

Libraries whose choice matters: `msw` 3 (HTTP and WebSocket interception in Node and
browser), `tsx` to run the recorder, `ws` for feed tests in Node, `process-compose` (host
tool) for the stack, `just`, `curl`, `psql`, and the owning repositories' toolchains
(`cabal`, `nix`).

This plan owns and other plans consume: the fixture layout
`packages/testing/fixtures/<surface>/<slug>.json` plus `_meta.json`; the manifests
`packages/testing/manifests/<surface>.json`; `@keiro-ui/testing/node` exporting
`startMockServer(): { server, use, reset, close }`; `@keiro-ui/testing/browser` exporting
`startMockWorker(): Promise<void>`; `@keiro-ui/testing/scenario` exporting `useScenario` and
`feedScript`; and the dev stack recipes `stack-db-up`, `stack-seed`, `stack-build`,
`stack-up`, `stack-down`, `stack-check` with the ports 9090–9093.

Prerequisites: none hard. The TypeScript milestones expect the workspace from
`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`; the `VITE_MOCK=1`
bootstrap in `apps/console/src/main.tsx` is EP-7's to wire against this package's
`startMockWorker`. Consumers: `docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
(client core contract tests and the int64 check),
`docs/plans/11-implement-the-kiroku-pgmq-and-shibuya-typed-clients.md` and
`docs/plans/12-implement-the-keiro-typed-client.md` (client contract tests), every screen
plan (vitest and Playwright against the handlers), and
`docs/plans/18-package-the-console-for-deployment.md` (the composed deployment smoke test
runs against this stack).
