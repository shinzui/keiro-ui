# keiro-ui

The keiro runtime console: a browser application for operating systems built on
**keiro** (commands, aggregates, projections, process managers, timers, durable
workflows), **kiroku** (the PostgreSQL event store), **shibuya** (supervised queue
processing), and **pgmq-hs** (PostgreSQL work queues). It talks to each project's own
inspection endpoints directly; there is no backend-for-frontend.

The direction is in [docs/architecture/ui-direction.md](docs/architecture/ui-direction.md),
the wire conventions in
[docs/architecture/inspection-api-conventions.md](docs/architecture/inspection-api-conventions.md),
and the build-out in
[docs/masterplans/2-build-the-keiro-runtime-console.md](docs/masterplans/2-build-the-keiro-runtime-console.md).

## Quickstart

Prerequisites: Nix with flakes (`nix develop`, or `direnv allow` with the bundled
`.envrc`), or bun 1.4 plus Node 22 on the path. bun installs packages and runs scripts;
vitest and Playwright execute on Node.

```bash
bun install
bunx playwright install chromium   # once, for the end-to-end suite
bun run dev        # http://localhost:5173
bun run check      # typecheck + oxlint + oxfmt --check
bun run test       # vitest (always via `bun run`; a bare `bun test` is bun's own runner)
bun run build      # apps/console/dist
bun run test:e2e   # Playwright against `vite preview`
```

`just --list` shows the same commands as recipes.

## Workspace

| Path                   | Package                 | Role                                                  |
| ---------------------- | ----------------------- | ----------------------------------------------------- |
| `apps/console`         | `@keiro-ui/console`     | the browser application                               |
| `packages/ui`          | `@keiro-ui/ui`          | shadcn/ui React Aria components, Paper Mono, tokens   |
| `packages/client-core` | `@keiro-ui/client-core` | HTTP, errors, cursors, int64, WebSocket, live queries |
| `packages/testing`     | `@keiro-ui/testing`     | recorded fixtures and MSW handlers                    |

Screens and the shell import UI primitives only from `@keiro-ui/ui/components/<name>`.
To add a primitive, run `bunx shadcn@4.21.5 add <name>` inside `packages/ui` and commit
the generated source.

## Surfaces in development

The Vite dev server proxies each surface prefix to its local port with the prefix
stripped and WebSocket upgrades forwarded, so the console needs no CORS configuration.
Application routes never start with one of these prefixes.

| Surface | Dev server      | Port | Prefix     | WebSocket paths                           |
| ------- | --------------- | ---- | ---------- | ----------------------------------------- |
| shibuya | shibuya-metrics | 9090 | `/shibuya` | `/shibuya/ws`                             |
| kiroku  | kiroku-inspect  | 9091 | `/kiroku`  | `/kiroku/ws/metrics`, `/kiroku/ws/events` |
| pgmq    | pgmq-inspect    | 9092 | `/pgmq`    | `/pgmq/ws`                                |
| keiro   | keiro-ops-http  | 9093 | `/keiro`   | `/keiro/ws`                               |

keiro-ops-http admits a WebSocket upgrade only from an allow-listed `Origin` or one equal
to the request's own host; the proxy rewrites `Host`, so start the local keiro host with
`--allow-origin http://localhost:5173`.
