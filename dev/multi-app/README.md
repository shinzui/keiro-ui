# Two applications, one production bundle

Run from the checkout root with Bun and Caddy on PATH:

```sh
bun dev/multi-app/inspection-fixtures.ts
```

In a second terminal:

```sh
VITE_BASE_PATH=/console/ bun run build
CONSOLE_DIST=apps/console/dist caddy run --config dev/multi-app/Caddyfile --adapter caddyfile
```

Open `http://localhost:18080/console/workflows?target=prod-orders`. Orders and Billing have
the same workflow and timer IDs, with completed versus failed workflow data. Switch apps with
the Application selector; Orders also offers two individually routed worker fixtures. Billing
omits PGMQ and Shibuya. Copy a workflow or worker link and open it in another tab.

Orders listens on 19193, Billing on 19293, and Caddy on 18080. Override `ORDERS_PORT`,
`BILLING_PORT`, and `MULTI_APP_PORT` in both terminals and the test command when ports collide.
A collision fails startup. Ctrl-C stops only the processes started in that terminal.

`bun run test:e2e:multi-app` starts its own fixtures and proxy and builds once into
`apps/console/dist-multi-app`. No external stack or route interception supplies inspection
responses. The suite requires all its tests to pass; it contains no backend-dependent skips.
The ordinary Playwright project selection excludes this suite.

The fixture hosts compose surface prefixes: Caddy removes `/inspection/prod/orders`, leaving
`/keiro/...`. The production examples instead strip the full surface prefix for standalone
servers. Worker paths reach one worker inventory entry. These are disposable protocol fixtures,
not real application implementations or databases.

Each fixture exposes loopback-only `/__journal` and `/__control`. The journal records path,
query, method, fixture body, Origin, worker and received WebSocket frames. Controls accept
`delayMs`, `executeDelayMs`, `closeFeeds`, `frame`, `worker`/`unavailable`, or `reset`. These
routes are never exposed by Caddy or included in release artifacts. `/inspection/forbidden/`
returns 403 for HTTP and upgrade attempts: it tests route denial, not an identity provider.

Edit `dev/multi-app/console-config.json` and reload to change the catalog. To add a third target
using an already routed endpoint, copy an entry under a new ID; the UI immediately lists it
without changing any files under `dist/assets`. For a new application upstream, stage explicit
proxy routes first. The automated suite uses a temporary catalog directory to prove this and
restores it on exit.
