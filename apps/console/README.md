# @keiro-ui/console

The keiro runtime console: a React + TypeScript + Vite application that reads the inspection
surfaces of kiroku, pgmq, shibuya, and keiro. Run it from the repository root with
`bun run dev` (against the local stack, `just stack-up`) or `VITE_MOCK=1 bun run dev`
(against the recorded fixtures). Nothing in the first release writes to any server.

## Sections

**Streams & Subscriptions** browses kiroku: streams, categories, the `$all` log with a live
tail, events, and subscriptions with their checkpoints and dead letters. A single-stream read
does not report global positions (kiroku answers 0 there), so those rows say "not reported";
the event's own page has the real position.

**Queues & Processors** reads pgmq and shibuya. Queues are ordered by the age of their oldest
message; a queue page peeks at messages and the archive without leasing them and shows a
dead-letter panel for payloads written by shibuya-pgmq-adapter (redrive is not available
upstream yet). Processors show state, counters, and in-flight age live from the shibuya feed,
and a processor page shows its latency histogram and whether control is enabled.

**Workflows** lists keiro's durable workflow instances with every filter in the URL and keeps
the first page current from the `workflows` feed. An instance page shows the journal grouped
by step, with derived (browser-computed) spans, plus its steps, children, and awakeables.

**Aggregates** lists the kinds the keiro host registers, pages their instances, and opens an
instance as its raw kiroku events beside the folded state keiro rebuilt, with how it was
hydrated and the snapshot's health. The split between the two panes is remembered.

**Process managers** has no discovery read in keiro, so the index offers the names configured
on the active connection profile (Settings → Connections, "Process manager names") and the
ones opened recently, or opens a typed name. An instance shows its state, what it is waiting
for, its last reaction with provenance when recorded, its pending timers, and its journal.

**Timers** pages keiro's pending-timer ledger, live on the first page through the `timers`
feed, with manager and correlation filters; the Stuck tab polls stuck timers with keiro's
`min_age` (`5m`, `1h`) and `min_attempts`. A timer opens in the right sheet.

**Operator actions** (from 0.2) are few and gated by the servers: pause and resume a processor
(shibuya's `enableControl`), requeue or cancel a timer, and redrive a dead-letter queue through
keiro (keiro-ops-http's `--enable-mutations`). A closed gate shows the action disabled with the
server's reason. Every keiro action previews first and executes only after the operator types the
target; refusals render as the server sent them; executed actions are listed in the session audit
("N actions this session" in the bottom bar). `docs/deployment.md` covers the hosts' settings.

The aggregate and process-manager reads exist only on a keiro host that mounts its inspection
hooks. On any other host those pages show "… inspection is not mounted on this keiro host"
with the probed path instead of an error; see `dev/README.md` for the local stack.

## Tests

```bash
bun run test                                          # vitest, from the repository root
bun run --filter @keiro-ui/console test:e2e           # Playwright (smoke, shell, screens)
```

Component tests render the real route tree with `src/test/render-route.tsx` against the
recorded fixtures from `@keiro-ui/testing`.
