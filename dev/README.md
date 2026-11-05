# Local runtime stack

The console reads four inspection surfaces. This directory runs them locally against seeded
databases on the fixed ports of
[`docs/masterplans/2-build-the-keiro-runtime-console.md`](../docs/masterplans/2-build-the-keiro-runtime-console.md):

| Surface | Process                 | Port | Database                           |
| ------- | ----------------------- | ---- | ---------------------------------- |
| shibuya | `shibuya-pgmq-consumer` | 9090 | `pgmq_dev` (pgmq-hs's dev cluster) |
| kiroku  | `kiroku-inspect`        | 9091 | `jitsurei` (keiro's dev cluster)   |
| pgmq    | `pgmq-inspect`          | 9095 | `pgmq_dev`                         |
| keiro   | `jitsurei-ops-http`     | 9093 | `jitsurei`                         |

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

`stack-up` starts both socket-only PostgreSQL clusters (`stack-db-up`), then the processes in
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
- Aggregates or Process managers say "not mounted on this keiro host": port 9093 is running
  the hook-less `keiro-ops-http`. `dev/bin/jitsurei-ops-http` should be running there unless
  you started the mori profile, which is hook-less by design.
- A port is busy: `lsof -nP -iTCP:9090-9095 -sTCP:LISTEN`. process-compose's own control API
  listens on `.dev/process-compose.sock`, not on TCP.
- Start over on pgmq: stop the stack, `dropdb`/`createdb` `pgmq_dev` in
  `$STACK_PGMQ_SOCKET_DIR`, and start it again.

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

## The mori profile

`just stack-up mori` runs the same four surfaces against a local
[mori](mori://shinzui/mori) dev database instead of jitsurei and `pgmq_dev`, and supervises
`mori automate daemon` beside them. mori runs 17 reactors, 3 timers, 14 kiroku subscriptions
with durable checkpoints, and four keiro-pgmq job queues with dead-letter queues, so the
Streams & Subscriptions, Queues, and Process Managers & Timers screens see a live
application rather than a demo seed. It has no durable workflows and runs the standalone
`keiro-ops-http`, so it has no aggregate or process-manager hooks; use the default profile
for those.
The shibuya baseline keeps consuming `pgmq_dev` in both profiles.

```bash
just stack-seed-mori        # once: start mori's PostgreSQL, migrate, bootstrap and ingest its fixture repos
just stack-up mori          # the stack plus mori's daemon (its live registry on :9191)
just stack-check mori       # every probe, plus the daemon's /subscriptions
just stack-drive-mori       # push one change through mori's automations (repeatable)
```

The recorded fixtures in `packages/testing/fixtures/` come from the default (jitsurei)
profile only: positions, stream names, and the keiro aggregate and workflow fixtures must
all refer to one `$all` log, so mori's data is for live testing, not mixed into fixtures.
