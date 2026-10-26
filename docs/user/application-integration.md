---
type: Guide
title: Mounting the inspection surfaces in an application
description: What an application built on keiro, such as rei, has to serve so the console can operate it, which process each surface must live in, and how to compose and front them.
docId: DOC-5
tags: [integration, application-host, compose-surfaces, app-hooks, shibuya, rei]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:59:00Z
---

# Mounting the inspection surfaces in an application

The console has no server of its own (ADR-5). It reads four inspection surfaces, and each
one is a WAI `Application` owned by its project. An application that wants the console
mounts those applications in its own processes, then puts a proxy in front that also serves
the bundle. This guide explains what that takes, using rei (`mori://shinzui/rei`) as the
worked example. Any keiro application with the same pieces follows the same steps.

[Deploying the console](deployment.md) covers serving the bundle and the proxy. This guide
covers the application side, which comes before it.

## What the console expects

On the page's origin, or on four separate origins (recipe C in the deployment guide), the
console expects:

| Prefix     | Owner package (version checked 2026-10-21)        | WAI constructor                                       | Screens that read it                                 |
| ---------- | ------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `/keiro`   | `keiro-ops-http` 0.21.0.0 (unreleased; build from the keiro checkout) | `opsApplicationWithBudget` + `feedsMiddleware`         | Overview, Aggregates, Workflows, Process managers, Timers, Projections, DLQ redrive |
| `/kiroku`  | `kiroku-metrics` 0.3.0.1                           | `combinedAppWithProviders`                             | Streams, Categories, Events, Subscriptions, store position |
| `/pgmq`    | `pgmq-inspect` 0.1.0.0 (not yet on Hackage)        | `withInspectApplication`                               | Queues, messages, archive, dead letters              |
| `/shibuya` | `shibuya-metrics` 0.10.0.1                         | `combinedApp` (or `startMetricsServer`)                | Processors, processor readiness, pause/resume        |

The console strips nothing and adds nothing. A request to `/kiroku/streams` must reach
kiroku's application as `/streams`, and WebSocket upgrades must pass through on `/keiro/ws`,
`/kiroku/ws/metrics`, `/kiroku/ws/events`, `/pgmq/ws`, and `/shibuya/ws`.

A missing surface is not fatal. Its health dot reads down, and the screens that need it show
the error, while every other screen keeps working. You can start with `/keiro` and `/kiroku`
and add the other two later.

## Which process each surface must live in

Three of the surfaces read only PostgreSQL. The fourth reads in-memory state:

- **`/keiro`, `/kiroku`, `/pgmq` are database-only.** They can run in any process that can
  reach the application's database, including a process that runs nothing else.
- **`/shibuya` reads the shibuya `Master` of a running `runApp`.** Processor state, inbox
  depth, and pause/resume all live in that process's memory. The surface must be mounted in
  the process that runs the workers, and it can only show that process's processors.

In rei this means the surfaces cannot all share one listener:

| rei process           | What it runs                                               | Surfaces it can serve                    |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `rei-api`             | The Servant API on `REI_API_PORT` (8080)                   | `/keiro`, `/kiroku`, `/pgmq`             |
| `rei worker`          | The four pgmq job processors via keiro-pgmq's `runJobWorkers` | `/shibuya` (for those processors)     |
| `rei worker kiroku`   | Subscriptions, process managers, and timers via `Rei.Infrastructure.WorkerHost` | `/shibuya` (for those processors) |

A target may contain a named inventory of Shibuya worker endpoints, with a Worker selector
and worker-bearing shareable URLs. Each endpoint must address exactly one logical replica;
load balancing several worker processes cannot expose their combined in-memory state. Keep
one direct Shibuya endpoint for deliberately single-process targets or migrated profiles.
If a worker cannot be addressed individually, omit it rather than imply a fleet view. A
logical replica may restart; observed connection loss discards pending control confirmation,
while a stronger incarnation-bound command guarantee requires upstream protocol support.

Serve one console plus its runtime catalog for all application deployments. Each catalog entry
names one app/environment and optional surface base URLs; explicit gateway routes map those
public prefixes to the owning application or worker. This requires no change to application
composition or inspection protocols. See [deployment](deployment.md#one-console-for-multiple-applications)
and the [Kubernetes recipe](../deployment/kubernetes/README.md), including application-owned
single-worker Services. Preserve the public HTTPS browser Origin, protect both HTTP and socket
routes at the gateway, and keep Shibuya's control Origin allow-list even on the public origin.

## The shape to build

```text
                    ┌─────────────── proxy :443 (auth here) ───────────────┐
browser ──────────▶ │ /console/*  → static bundle                          │
                    │ /shibuya/*  → rei worker      127.0.0.1:9090 (strip) │
                    │ /*          → inspection host 127.0.0.1:9093         │
                    └──────────────────────────────────────────────────────┘
  inspection host = composeSurfaces [/keiro, /kiroku, /pgmq] on its own loopback listener
```

Keep the inspection host off rei's API listener. The surfaces have no authentication.
rei-api authenticates its own routes, so mounting the surfaces beside them would put
unauthenticated reads on an authenticated port. Give the surfaces their own loopback
listener, either a second listener inside the `rei-api` process or a separate command such as
`rei inspect`. A separate command is easier to restart and to keep off public interfaces.
Put authentication in the proxy (see "Authentication posture" in the deployment guide).

## Step 1: add the dependencies

The executable that hosts the surfaces needs `keiro-ops-http`, `kiroku-metrics`, and
`pgmq-inspect`. The worker needs `shibuya-metrics`. rei's `cabal.project` pins the keiro
runtime through `cabal/runtime/keiro-runtime/5/`. Add `keiro-ops-http` and `pgmq-inspect` to
that pin set as `source-repository-package` entries, because neither is on Hackage yet.
`kiroku-metrics` is already in that pin set.

## Step 2: give inspection its own store and pool

Inspection must never borrow the runtime writer's connections. Open a store for inspection
only, with a small pool and a SQL statement timeout on every connection. keiro's
`withOpsInspectionPool` installs the timeout. Size it to `inspectionLimits.maxConcurrentReads`,
which defaults to 4. The details and the defaults are in keiro's
`docs/guides/serve-keiro-ops-over-http.md` in `mori://shinzui/keiro` (the artifact-level URI
is pending).

pgmq-inspect admits two concurrent reads by default. Give it its own small hasql pool,
separate from keiro's. Build it the same way rei's worker builds the pool it passes to
`runPgmq`. That keeps keiro's admission budget and its pool size in step.

## Step 3: build the keiro `AppHooks`

Without hooks, `/keiro` serves its database-only reads: workflows, timers, projections, shards,
health, and the DLQ redrive mutation. The Aggregates and Process managers screens need code
from the application. Without that code they show "… inspection is not mounted on this keiro
host". That message is expected, not an error. The console detects it from keiro's
400 `invalid_request` on the `aggregate` and `pm` command words.

| `AppHooks` field   | Turns on in the console                                  | rei's existing value                                       |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| `aggregates`       | Aggregates index, list, and detail                       | none yet; build `reiAggregateInspectors` (below)            |
| `processManagers`  | Process manager instances by correlation                 | none yet; build `reiProcessManagerInspectors` (below)       |
| `projectionCatalog`| Projection group catalog reads                            | `reiProjectionCatalogOperations` (`Rei.Cli.Commands.Ops`)   |
| `replayAudit`      | keiro's replay-audit route (the console does not use it yet) | `reiReplayAuditConfig` (`Rei.Cli.Commands.Ops`)        |
| `workflowResume`   | keiro's workflow resume (the console does not offer it yet) | `reiWorkflowResume` (`Rei.Cli.Commands.Ops`)            |
| `timerFire`        | keiro's timer drain (the console does not offer it)      | `reiTimerFire = Nothing`, deliberately                      |

rei builds these values for `rei ops` already. Move them, or re-export them, where the
inspection host can use them, so the CLI and the HTTP surface run the same code.

**Aggregate inspectors.** Build one `Keiro.Inspection.Aggregate.aggregateInspector` per
aggregate type and gather them with `aggregateInspectors`, which refuses duplicate names. Each
inspector takes a display name, the `ValidatedEventStream`, its `StreamCategory`, and a
function that renders the folded state as JSON. Set `stateLabel` to give the list a readable
state column. rei's replay-audit catalog already names every aggregate's stream and category,
but its `SomeAuditTarget` hides the state type and carries no `Show s`. So build the inspectors
from the typed `AuditTarget` values before they are wrapped, with `inspectorFromAuditTarget`,
not from `catalogAuditTargetsOrThrow`. keiro's jitsurei example,
`jitsurei/src/Jitsurei/Inspection.hs` in `mori://shinzui/keiro` (the artifact-level URI is
pending), is the reference:

```haskell
reiAggregateInspectors :: Aggregate.AggregateInspectors
reiAggregateInspectors =
  either (error . Text.unpack) id $
    Aggregate.aggregateInspectors
      [ Aggregate.SomeAggregateInspector
          ((Aggregate.aggregateInspector "intention" intentionEventStream intentionCategory display)
             {Aggregate.stateLabel = intentionStateLabel})
      , -- one entry per aggregate type
      ]
```

**Process manager inspectors.** Build a `Map` from the process manager's name to
`Keiro.ProcessManager.Inspect.SomeProcessManagerInspector`, one entry per manager that
`rei worker kiroku` runs, using `processManagerInspector manager category display`. keiro has
no discovery read for process managers. List the same names in the console's connection
profile ("Process manager names"), so the index can offer them.

```haskell
reiInspectionHooks :: Ops.AppHooks
reiInspectionHooks =
  Ops.emptyAppHooks
    { Ops.aggregates = Just reiAggregateInspectors,
      Ops.processManagers = Just reiProcessManagerInspectors,
      Ops.projectionCatalog = Just reiProjectionCatalogOperations,
      Ops.replayAudit = Just reiReplayAuditConfig,
      Ops.workflowResume = reiWorkflowResume
    }
```

## Step 4: compose `/keiro`, `/kiroku`, and `/pgmq`

Allocate each application once at startup, inside the store's and pool's lifetimes. Then mount
the three with keiro's `composeSurfaces`. The example below follows keiro's
`keiro-ops-http/example/Compose.hs` and adds `/pgmq`. It is a sketch: the names were checked
against the owner checkouts on 2026-10-21, but `reiInspectionSettings` and `pgmqPool` stand in
for rei's own connection settings and pool.

```haskell
withReiInspectionHost :: IO ()
withReiInspectionHost = do
  let config = defaultOpsHttpConfig -- MutationsDisabled, RefuseOnDrift, no origins
      settings = reiInspectionSettings {poolSize = config.inspectionLimits.maxConcurrentReads, statementTimeout = Just 2}
  withStore settings $ \baseStore ->
    withOpsInspectionPool config.inspectionLimits settings $ \pool -> do
      let store = baseStore {pool}
      -- /kiroku: metrics and its WebSocket providers; no server thread of its own
      metrics <- Metrics.newKirokuMetrics store
      providers <- Metrics.storeServerProviders Metrics.defaultConfig metrics store
      let kiroku = Metrics.combinedAppWithProviders Metrics.defaultConfig metrics [] providers
      -- /pgmq: its own small pool, its own read budget
      Pgmq.withInspectApplication Pgmq.defaultInspectConfig (Pgmq.poolEnv pgmqPool Nothing) $ \pgmq ->
        -- /keiro: the HTTP routes and /keiro/ws share one feed handle's budget
        withFeedHandle config defaultFeedConfig store $ \feeds -> do
          http <- opsApplicationWithBudget config (handleBudget feeds) reiInspectionHooks store
          let keiro = feedsMiddleware config feeds http
          app <-
            either (fail . Text.unpack . renderComposeError) pure $
              composeSurfaces
                (ComposeConfig [])
                [ MountedSurface keiroPrefix keiro,
                  MountedSurface kirokuPrefix kiroku,
                  MountedSurface pgmqPrefix pgmq
                ]
          withOpsHttpServer defaultOpsHttpServerConfig {port = 9093} app $ \server ->
            wait server.serverThread
```

The imports follow keiro's guide. `Keiro.Ops.Http.Config` is imported qualified as `Config`,
`opsApplicationWithBudget` comes from `Keiro.Ops.Http.Application`, `feedsMiddleware` comes
from `Keiro.Ops.Http.WebSocket`, and everything else is from `Keiro.Ops.Http`. `Metrics` is
`Kiroku.Metrics` and `Pgmq` is `Pgmq.Inspect`. Pass `Just` connection settings to
`Pgmq.poolEnv` to have pgmq's WebSocket push on `NOTIFY` instead of polling.

Mounted this way, `GET /` on port 9093 lists the mounted prefixes. A request to an unmounted
prefix (`/shibuya/...` on this listener) answers 404 `surface_not_mounted`. That is why the
proxy must send `/shibuya` to the worker before anything else.

`ComposeConfig []` and `allowedOrigins = []` are correct when the console and the surfaces
share one origin behind the proxy. Set them only for separate origins, and pass the same list
to `ComposeConfig`, to keiro's `OpsHttpConfig.allowedOrigins` (its WebSocket origin check),
and to kiroku's `corsAllowOrigins`.

## Step 5: mount `/shibuya` in the worker

`runJobWorkers` returns shibuya's `AppHandle`, and its `master` field is the `Master` the
surface reads. In rei's `Rei.Cli.Commands.Worker.Runner`, start the metrics server once
`appResult` is `Right appHandle`. Stop it before `shutdownWorkers`, so the drain does not race
open sockets:

```haskell
Right appHandle -> do
  let metricsConfig = Shibuya.defaultConfig {port = 9090} -- loopback by default
  server <- liftIO $ Shibuya.startMetricsServer metricsConfig appHandle.master
  liftIO $ readMVar shutdownSignal
  liftIO $ Shibuya.stopMetricsServer server
  shutdownResult <- shutdownWorkers shutdownConfig appHandle
  ...
```

`startMetricsServer` validates the configuration and owns its WebSocket state. If the worker
already has its own HTTP listener, mount `combinedApp metricsConfig master wsState []`
instead. Allocate `newWebSocketState` once, and call `shutdownWebSockets` when the mount is
released. Pass `DependencyCheck`s for the database through `startMetricsServerWithDeps` if
you want `/shibuya/health/ready` to report the database as well as the processors.

## Step 6: put the proxy in front

This is recipe A of the deployment guide with two upstreams instead of four. Order matters:
the more specific `/shibuya` and `/console` blocks come before the catch-all.

```text
:8080 {
	redir /console /console/ 301
	handle_path /console/* {
		root * /srv/console
		try_files {path} /index.html
		file_server
	}
	handle_path /shibuya/* {
		reverse_proxy 127.0.0.1:9090
	}
	reverse_proxy 127.0.0.1:9093
}
```

Keep the browser's `Host` header (Caddy does by default). keiro admits a `/keiro/ws` upgrade
whose `Origin` equals the request's own `scheme://Host`. Build the bundle with
`VITE_BASE_PATH=/console/`. The default "Same origin" connection profile then needs no
configuration.

## Step 7: verify

```bash
curl -s http://127.0.0.1:9093/                   # {"surfaces":[keiro, kiroku, pgmq]}
curl -s http://127.0.0.1:9093/keiro/health       # "status":"ok", "schema_drift":[]
curl -s http://127.0.0.1:9093/keiro/aggregate/types   # your aggregate names, not 400
curl -s http://127.0.0.1:9093/kiroku/capabilities
curl -s http://127.0.0.1:9093/pgmq/queues        # rei's four job queues and their _dlq
curl -s http://127.0.0.1:9090/health/ready       # the worker's processors
```

Then open `/console/`. All four health dots should be green, and the Aggregates card should
list rei's aggregate types instead of "not mounted".

## Turning on operator actions

The first release is read-only, and every action stays off until the server that owns it
opens its gate:

- **Timer requeue/cancel and DLQ redrive.** Set `mutations = MutationsEnabled` on the
  `OpsHttpConfig` given to `opsApplicationWithBudget`. keiro previews each mutation, and the
  console asks the operator to type the target before it executes.
- **Processor pause/resume.** Set `enableControl = True` on the worker's
  `MetricsServerConfig`, and also set `corsAllowedOrigins` to the console's origin (for
  example `["https://ops.example"]`), even on one origin. Browsers send `Origin` on every
  `POST`, and shibuya refuses a control `POST` from an origin that is not on the list.

## Checklist

- [ ] A loopback listener that composes `/keiro`, `/kiroku`, `/pgmq`, separate from the
      authenticated API.
- [ ] An inspection-only store and pool with a statement timeout. pgmq-inspect has its own
      small pool.
- [ ] `AppHooks` with `aggregates` and `processManagers`, plus the hooks rei already builds
      for `rei ops`.
- [ ] `/shibuya` started from the worker's `appHandle.master` and stopped before the drain.
- [ ] A proxy that serves the bundle, routes `/shibuya` to the worker and everything else to
      the inspection host, keeps `Host`, forwards upgrades, and authenticates.
- [ ] Process manager names entered in the console's connection profile.
