---
okf_version: "0.2"
---

# keiro-ui capabilities

What the **keiro runtime console** provides to an operator today: what a team running keiro,
kiroku, shibuya, and pgmq-hs can deploy, use, and verify against evidence it can open. Each
record is one capability — one thing a consumer adopts *and* verifies independently — backed by
at least one artifact a reader can open. There is no roadmap here: a capability that does not
yet exist is an improvement request, not a record.

keiro-ui is a static browser application that reads each project's own inspection endpoints;
it has no backend. It is pre-1.0: every capability below is **experimental** in its
compatibility promise, and that uniformity is the project's single stability policy, not a
missing distinction. Everything except the gated operator actions shipped in 0.1.0, the
read-only release.

## What keiro-ui provides

| Capability | Handle | Since | Provides |
|---|---|---|---|
| [Runtime overview and surface health](runtime-overview.md) | CAP-1 | 0.1.0 | One page across all four surfaces, with per-surface health and liveness |
| [Event store browsing](event-store-browsing.md) | CAP-2 | 0.1.0 | Streams, categories, the `$all` log with a live tail, subscriptions and dead letters |
| [Work queue inspection](queue-inspection.md) | CAP-3 | 0.1.0 | Queues by oldest message age; peek-only messages, archive, and dead letters |
| [Queue processor monitoring](processor-monitoring.md) | CAP-4 | 0.1.0 | Live processor state, in-flight age, latency histograms, control status |
| [Durable workflow inspection](workflow-inspection.md) | CAP-5 | 0.1.0 | Filtered instance lists and step-grouped journals |
| [Aggregate inspection](aggregate-inspection.md) | CAP-6 | 0.1.0 | Raw events beside keiro's folded state, hydration, and snapshot health |
| [Process manager inspection](process-manager-inspection.md) | CAP-7 | 0.1.0 | State, waiting-for, last reaction, timers, and journal of an instance |
| [Timer ledger](timer-ledger.md) | CAP-8 | 0.1.0 | Live pending timers and a stuck-timer view |
| [Projection and shard monitoring](projection-monitoring.md) | CAP-9 | 0.1.0 | Exact projection distance, rebuild progress, failures, shard ownership |
| [Static deployment at any base path](static-deployment.md) | CAP-10 | 0.1.0 | A release bundle for any base path, on one origin or separate origins |
| [Gated operator actions](gated-operator-actions.md) | CAP-11 | unreleased | Pause/resume, timer requeue/cancel, dead-letter redrive behind server gates |

## Deliberately excluded

- **Shell conveniences** — the command palette, keyboard shortcuts, URL-addressable inspector
  sheets, recents, and themes. Nobody adopts them apart from the screens they serve, so they
  are part of every record above rather than records of their own.
- **The workspace packages** (`@keiro-ui/client-*`, `@keiro-ui/ui`, `@keiro-ui/testing`). All
  are private to this repository; a consumer adopts the console, not a client library. They
  are named in `packages` where a capability's evidence lives in them.
- **The local runtime stack** under `dev/`. It is a development harness for this repository,
  not something a consumer deploys.

## Evidence

Apart from CAP-10's release script and deployment guide, every record's evidence is a vitest
suite (`bun run test`) or a Playwright suite
(`bun run test:e2e`) running against responses recorded from the real servers in
`packages/testing/fixtures/`. The live runs need the local stack and do not run by default:
`apps/console/e2e/live.spec.ts` and the packages' `live` tests with `KEIRO_UI_LIVE=1`, the
production smoke's second tier (`just smoke-production`) when the stack answers, and the
mutation smoke (`just smoke-live-mutations`) only on a scratch stack.
