# Changelog

## 0.2.0 — 2026-10-27

- **Operator actions**, each riding its server's own gate and off by default: pause and resume a
  processor (shibuya `enableControl`), requeue or cancel a timer, and redrive a dead-letter queue
  through keiro's job-level redrive (keiro-ops-http `--enable-mutations`). A closed gate renders
  the action disabled with the server's reason; keiro actions preview first and execute only
  after the operator types the target; refusals render verbatim; an unknown outcome forces a
  re-read. Executed actions are listed in a session audit sheet.
- **Multiple applications**: deployment-owned connection catalogs, Application and Worker
  selectors, shareable target URLs, and isolated connection sessions. Switching targets
  clears pending confirmations and keeps reads, live feeds, and actions on the selected app
  and logical worker. Missing surfaces render an explicit configuration state.
- **Projections**: choose a feeding subscription from kiroku's subscription inventory on a
  projection group.
- **Native packages and images**: reproducible Nix builds for Apple Silicon macOS and
  ARM64/x86-64 Linux, root and `/console/` base paths, and layered non-root Linux images.
- **Deployment**: multi-application Caddy/nginx examples and a Kubernetes recipe with
  immutable configuration, a private Service, health probes, and rollout/rollback guidance,
  all included in the release archive. Site-specific image publishing and cluster checks
  remain deployment prerequisites.
- **Validation and documentation**: real HTTP/WebSocket multi-app browser coverage, native
  package and image checks, and user and capability documentation, including guidance for
  mounting inspection surfaces in an application.

## 0.1.0 — 2026-10-21

The first release of the keiro runtime console. It is read-only: no screen writes to any
server (ADR-7), and every gated operation the surfaces expose is shown as a server fact, never
as a control.

- **Overview**: one card per concern (queue latency, workflow status counts, projection
  freshness as global position distance, processor readiness, the store position, aggregates,
  timers), the four surfaces' health, and keiro's health with its mutation gate.
- **Streams & Subscriptions**: streams, categories, the `$all` log with a live tail, event
  pages, and subscriptions with checkpoints and dead letters (kiroku).
- **Queues & Processors**: queues by oldest message age, peek-only message and archive paging,
  dead-letter panels for shibuya-pgmq-adapter payloads, and processors with live state,
  latency histograms, and control status (pgmq, shibuya).
- **Workflows**: instances with URL-held filters and a live first page, and instance pages
  with a step-grouped journal, derived spans, steps, children, and awakeables (keiro).
- **Aggregates, Process managers, Timers**: the aggregate browser (events beside folded state,
  hydration, snapshot health), process-manager instances with provenance, and the live timer
  ledger with a stuck view; an honest state on hosts without keiro's inspection hooks.
- **Projections & Shards**: projection groups with exact global position distance, rebuild
  progress, and failures, live; feeding-subscription checkpoints; shard bucket ownership.
- **Shell**: rail and sidebar, command palette with entity jumps, right-sheet inspectors
  addressable by URL, recents, connection profiles, liveness pause, light and dark themes.
- **Deployment**: a static bundle built for any base path, `bun run release:pack`,
  `docs/deployment.md` (one origin behind a proxy, a composing host, or separate origins), and
  a production smoke test.
