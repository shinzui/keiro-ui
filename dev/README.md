# Local runtime stack

The console reads four inspection surfaces. This directory runs them locally against seeded
databases on the fixed ports of
[`docs/masterplans/2-build-the-keiro-runtime-console.md`](../docs/masterplans/2-build-the-keiro-runtime-console.md):

| Surface | Process                 | Port | Database                           |
| ------- | ----------------------- | ---- | ---------------------------------- |
| shibuya | `shibuya-pgmq-consumer` | 9090 | `pgmq_dev` (pgmq-hs's dev cluster) |
| kiroku  | `kiroku-inspect`        | 9091 | `jitsurei` (keiro's dev cluster)   |
| pgmq    | `pgmq-inspect`          | 9095 | `pgmq_dev`                         |
| keiro   | `keiro-ops-http`        | 9093 | `jitsurei`                         |

pgmq uses 9095 rather than its upstream default 9092 (a local Kafka-compatible container
holds 9092 on the machine this was set up on).

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
  `just stack-seed` from the checkout you built `keiro-ops-http` from.
- A port is busy: `lsof -nP -iTCP:9090-9095 -sTCP:LISTEN`. process-compose's own control API
  listens on `.dev/process-compose.sock`, not on TCP.
- Start over on pgmq: stop the stack, `dropdb`/`createdb` `pgmq_dev` in
  `$STACK_PGMQ_SOCKET_DIR`, and start it again.

## The mori profile

`just stack-up mori` runs the same four surfaces against a local
[mori](mori://shinzui/mori) dev database instead of jitsurei and `pgmq_dev`, and supervises
`mori automate daemon` beside them. mori runs 17 reactors, 3 timers, 14 kiroku subscriptions
with durable checkpoints, and four keiro-pgmq job queues with dead-letter queues, so the
Streams & Subscriptions, Queues, and Process Managers & Timers screens see a live
application rather than a demo seed. It has no durable workflows and, like every runnable
keiro host today, no aggregate or process-manager hooks; use the default profile for those.
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
