# Local runtime stack

The console reads four inspection surfaces. This directory runs them locally against seeded
databases on the default ports of
[`docs/masterplans/2-build-the-keiro-runtime-console.md`](../docs/masterplans/2-build-the-keiro-runtime-console.md),
each set by a variable in `dev/.env` (see "Moving a port"):

| Surface | Process                 | Port | Variable             | Database                           |
| ------- | ----------------------- | ---- | -------------------- | ---------------------------------- |
| shibuya | `shibuya-pgmq-consumer` | 9090 | `STACK_SHIBUYA_PORT` | `pgmq_dev` (pgmq-hs's dev cluster) |
| kiroku  | `kiroku-inspect`        | 9091 | `STACK_KIROKU_PORT`  | `jitsurei` (keiro's dev cluster)   |
| pgmq    | `pgmq-inspect`          | 9095 | `STACK_PGMQ_PORT`    | `pgmq_dev`                         |
| keiro   | `jitsurei-ops-http`     | 9093 | `STACK_KEIRO_PORT`   | `jitsurei`                         |

The mori profile adds its daemon on 9191 (`STACK_MORI_METRICS_PORT`).

pgmq uses 9095 rather than its upstream default 9092 (a local Kafka-compatible container
holds 9092 on the machine this was set up on).

`jitsurei-ops-http` is keiro's standalone host with the jitsurei application hooks mounted
([mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55](mori://shinzui/keiro/okf/improvement-requests/concepts/IR-55)),
so the aggregate, process-manager, and other hook-gated routes answer. It takes the standalone
host's flags and is read-only unless started with `--enable-mutations`; the stack never passes
that flag, so run a scratch host by hand for `just smoke-live-mutations`. `dev/build.sh` also
builds the hook-less `keiro-ops-http`, which the mori profile runs.

## First run

Run everything from the repository root inside the dev shell (`nix develop`, which provides
`process-compose`); each owning repository's recipes run inside _its own_ dev shell, which
provides its PostgreSQL 18 and cabal.

```bash
cp dev/.env.example dev/.env   # then adjust the checkout paths
just stack-build               # cabal build in each checkout, links into dev/bin/
just stack-seed                # keiro's `just jitsurei-all` against the jitsurei database
just stack-up                  # foreground; Ctrl-C (or `just stack-down`) stops everything
just stack-check               # in another terminal: every probe and upgrade prints `ok`
```

`stack-up` first checks that every port the profile binds is free (`just stack-preflight`), then
starts both socket-only PostgreSQL clusters (`stack-db-up`), then the processes in
`process-compose.yaml`. The shibuya example consumer installs the pgmq schema in `pgmq_dev`
through pgmq-migration's pg-migrate ledger (no pgmq extension is needed) and creates its
`orders`/`payments`/`notifications` queues; `pgmq-seed` then adds the console's demo queues
(`console_demo` with a message id above 2^53, `console_demo_dlq` with an adapter-shaped dead
letter, `console_notify` with insert notifications), and only then does `pgmq-inspect` start.
A simulator sends a small `orders` batch every 30 s so the processors have work.

## Troubleshooting

- keiro answers `{"status":"schema_drift",...}`: the jitsurei database was migrated by a
  different keiro checkout. Drop it (`dropdb -h "$STACK_PG_SOCKET_DIR" jitsurei`) and run
  `just stack-seed` from the checkout you built `jitsurei-ops-http` from.
- Aggregates or Process managers say "not mounted on this keiro host": the keiro port is running
  the hook-less `keiro-ops-http`. `dev/bin/jitsurei-ops-http` should be running there unless
  you started the mori profile, which is hook-less by design.
- `just stack-check` fails on `keiro /topology/summary` with HTTP 400: see "The service
  topology" below.
- A port is busy: `just stack-up` stops before starting anything and names the port, its
  variable, and the holder's PID and command line:

  ```text
  port 9091 (kiroku, STACK_KIROKU_PORT) is held by pid 1871: .../bin/rei worker kiroku
  ```

  If the holder is this stack from an earlier `just stack-up`, run `just stack-down`. Otherwise
  stop that program or move the stack's port (below). `just stack-check` likewise refuses to
  probe a port whose listener is not this stack's (`FAIL  kiroku listener ... not this stack`,
  then `SKIP` for that surface's probes), so another server on a stack port cannot pass for the
  stack. process-compose's own control API listens on `.dev/process-compose.sock`, not on TCP.

- Start over on pgmq: stop the stack, `dropdb`/`createdb` `pgmq_dev` in
  `$STACK_PGMQ_SOCKET_DIR`, and start it again.

## Moving a port

To keep another program on a stack port, set that surface's variable in `dev/.env` (for
example `STACK_KIROKU_PORT=19091`) and restart the stack. Everything that reaches the local
stack reads the same variables, with the table's ports as defaults: `just stack-up` (the
process-compose commands and readiness probes), `just stack-check`, the Vite dev and preview
proxy (restart `bun run dev`), the `KEIRO_UI_LIVE=1` client suites and smoke scripts, the
fixture recorder, and the production smoke's Caddy (`dev/caddy/Caddyfile`, which takes them
from the environment; its Playwright config passes `dev/.env`'s values). A variable set in the
shell wins over `dev/.env` for the TypeScript consumers. The browser suites go through the Vite
proxy at `localhost:5173`, so they need no change. Set `STACK_MORI_METRICS_PORT` in `dev/.env`
too, not in `dev/profiles/mori.env`, which is loaded after it.

The multi-deployment suite has its own ports (`ORDERS_PORT`, `BILLING_PORT`, `MULTI_APP_PORT`;
[`multi-app/README.md`](multi-app/README.md)).

## Re-recording fixtures

`bun run fixtures:record`, then `bun run --filter @keiro-ui/testing derive`, writes
`packages/testing/fixtures/` from the running stack. Both databases must look newly seeded, because
tests rely on what a single seed produces, such as how many pages a list has:

- `just jitsurei-all` appends rather than resets. Stop the stack, drop or rename `jitsurei`, run
  `just stack-seed` once, start the stack, and set the ids in `packages/testing/manifests/keiro.json`
  `pins` from this seed. Blank the `stream` and `event_*` pins in `manifests/kiroku.json` so the recorder
  resolves them again.
- The simulator keeps adding dead letters to `pgmq_dev`. Before recording, drop the `console_demo`,
  `console_demo_dlq`, and `console_notify` queues, delete all but the oldest row of `pgmq.q_dlq_orders`,
  and run `bash dev/seed-queues.sh`, so that `dlq_orders` holds the oldest message and `console_demo` the
  most visible ones.

The recorder takes surfaces (`bun run fixtures:record keiro`) or single manifest entries
(`bun run fixtures:record keiro:topology-show`, every variant of that slug). A run limited to
selected entries needs no reseed when the entries are new or read data the seed does not move, and it
leaves the surface's `recorded_at` and `sources` unchanged. A recording never replaces a derived
fixture: the live body goes to its `<slug>.recorded.json` sibling, and the derived file changes only
when `derive` runs. The recorder rewrites a manifest only when it resolved a blank pin, and formats it
with oxfmt.

### Workflow counts and declared consumers

Build Keiro 0.24.0.0 or later and restart the host before recording the new reads.
`just stack-check` probes `/wf/inspect/counts` and
`/projection/consumers?category=order&limit=100` for the default example profile.
The standalone Mori profile does not mount consumer metadata hooks, so those two
feature probes are omitted there.

For these additive reads, use `bun run fixtures:record keiro` and
`bun run --filter @keiro-ui/testing derive` without reseeding or changing entity pins.
Targeted recording preserves the original seed description and untouched surface provenance;
the Keiro source commit identifies the rebuilt recording host. Derivation still processes all
surfaces: inspect its diff and preserve unrelated fixtures and entity pins. The manifest
records global, pinned-name and missing-name counts, `order` and `creditLimit` consumer
metadata, and the invalid consumer cursor refusal. Review
statuses: five successes must be 200 and the invalid cursor must be 400. The example
reports projection coverage available and durable metadata unavailable; an empty
`creditLimit` result means no matches in that reported metadata. A `limit=1` response
need not have another page. Synthetic tests supply multi-page cases.

### The service topology

The default profile's keiro host is started with `--topology`, pointing at keiro's golden
document `keiro-dsl/test/fixtures/topology/hospital-capacity.topology.golden.json` in
`$KEIRO_REPO`. It then serves that file unchanged at `/topology/show` and a header for it at
`/topology/summary` (contract: `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`).
`just stack-check` probes `/topology/summary` for the default profile.

The document does not describe Jitsurei. Jitsurei is hand-written and has no specification, so
the host serves a document about another service, `hospital-capacity`, and none of its
declarations match Jitsurei's aggregates, process managers or workflows. This is deliberate:
the default stack gives real bytes over real HTTP, and is a standing example of a document that
disagrees with its host. The mori profile mounts no topology.

The routes need a keiro checkout at or after commit `0ec5a7bb` (they are not in keiro
0.25.1.0). If `/topology/summary` answers `400 invalid_request`, `dev/bin/jitsurei-ops-http`
is an older build or was started without `--topology`: run `just stack-build keiro` and restart
the stack.

To re-record the two topology fixtures, run
`bun run fixtures:record keiro:topology-summary keiro:topology-show` without reseeding. It
records only those entries and changes only their files and `_meta.json` entries; each entry gets
its own `recorded_at` and `sources`. The recorded `topology-show.json` must be byte-identical to the golden;
`packages/testing/test/topology.test.ts` checks that, and that the summary a host would
compute for those bytes equals the recorded `topology-summary.json`. When keiro changes its
goldens, also refresh the copies in `packages/testing/topology/` as its `SOURCE.md` describes.

Check the producer by hand:

```bash
. dev/.env   # STACK_KEIRO_PORT and KEIRO_REPO
curl -fsS "http://127.0.0.1:$STACK_KEIRO_PORT/topology/summary"
curl -fsS "http://127.0.0.1:$STACK_KEIRO_PORT/topology/show" | cmp - "$KEIRO_REPO/keiro-dsl/test/fixtures/topology/hospital-capacity.topology.golden.json" && echo identical
curl -fsS "http://127.0.0.1:$STACK_KEIRO_PORT/topology/show" | shasum -a 256   # the hex part of document_sha256
KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test    # the client's check against this host
```

## The mori profile

`just stack-up mori` runs the same four surfaces against a local
[mori](mori://shinzui/mori) dev database instead of jitsurei and `pgmq_dev`, and supervises
`mori automate daemon` beside them. mori runs 17 reactors, 3 timers, 14 kiroku subscriptions
with durable checkpoints, and four keiro-pgmq job queues with dead-letter queues, so the
Streams & Subscriptions, Queues, and Process Managers & Timers screens see a live
application rather than a demo seed. It has no durable workflows and runs the standalone
`keiro-ops-http`, so it has no aggregate or process-manager hooks; use the default profile
for those.

The mori profile's keiro host mounts mori's own service topology. Before the host starts,
`dev/mori-topology.sh` runs `dev/bin/keiro-dsl topology` over
`$MORI_REPO/domain/mori.keiro-workspace` and writes `.dev/mori.topology.json` (git-ignored;
nothing is written in the mori checkout). This takes about 35 seconds, and the host waits for
it. `just stack-build keiro` builds `keiro-dsl`. If generation fails, the step prints the
diagnostic, the host starts without `--topology`, and the console says it serves no topology.
`just stack-check mori` probes `/topology/summary`.

Unlike the default profile, this document describes the service the host reads: 152
declarations and 315 relations on 2026-11-17. It still yields no link to a live screen. The
standalone host mounts no aggregate hooks, so the console reports that it cannot compare
document and host; all of mori's projection owners are delivered inline, so none has a
subscription; and mori declares no process or workflow. Links in both directions are covered
by the synthetic "joined" mock scenario (`packages/testing/src/joined.ts`).

keiro refuses every read, the topology included, while the database's keiro schema differs
from the host's (`409 schema_drift`), and `/health` then answers 503, which makes
process-compose stop the host. That happens when the mori database was migrated by an older
keiro than the checkout `dev/bin/keiro-ops-http` was built from. Build the host from the
keiro version mori uses, or, to look at the topology only, start the host by hand with
`--allow-schema-drift --topology .dev/mori.topology.json` on `$STACK_KEIRO_PORT`. The gated live case
then runs with:

```bash
cd apps/console && KEIRO_UI_LIVE=1 KEIRO_UI_LIVE_PROFILE=mori bunx playwright test --config playwright.live.config.ts -g "mori profile"
```

The shibuya baseline keeps consuming `pgmq_dev` in both profiles.

```bash
just stack-seed-mori        # once: start mori's PostgreSQL, migrate, bootstrap and ingest its fixture repos
just stack-up mori          # the stack plus mori's daemon (its live registry on :9191 by default)
just stack-check mori       # every probe, plus the daemon's /subscriptions
just stack-drive-mori       # push one change through mori's automations (repeatable)
```

The recorded fixtures in `packages/testing/fixtures/` come from the default (jitsurei)
profile only: positions, stream names, and the keiro aggregate and workflow fixtures must
all refer to one `$all` log, so mori's data is for live testing, not mixed into fixtures.
