---
id: 18
slug: package-the-console-for-deployment
title: "Package the console for deployment"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
  revisions:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T15:56:48Z
      mode: "update"
      note: "Switch workspace tooling from pnpm to bun; vitest and Playwright kept on Node 22"
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      mode: "update"
      note: "Round 2: align to owning-plan spellings, correct audited upstream facts, e2e layout, light theme where applicable"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Package the console for deployment

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

After this plan an operator can take the console that `docs/masterplans/2-build-the-keiro-runtime-console.md`
builds and actually put it in front of a running application. Today `bun run dev` serves the
console on the Vite development server and proxies the four inspection surfaces; nothing
produces a deployable artifact, nothing documents how to serve it, and nothing proves the
built bundle still works when it is not at the root of an origin. When this plan is
complete, `bun run build` produces a production bundle that works at a sub-path such as
`/console/`, `bun run release:pack` produces a versioned tarball that contains the bundle and
the font licence notices, `docs/deployment.md` gives three copy-pasteable recipes (one
origin behind Caddy or nginx; one origin where the application host already composes the
surfaces; four separate origins with the exact CORS flag per server), a checked-in
`dev/caddy/Caddyfile` lets anyone reproduce the single-origin deployment on their machine,
and a Playwright production smoke test proves it end to end.

This plan also owns the **read-only release**. The initiative's parent MasterPlan requires,
per [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md), that the console
ships a release with no mutation controls before any operator action is added. The last
milestone here executes `release/CHECKLIST.md`, cuts the git tag `v0.1.0`, and checks the
"Read-only release gate" box in the MasterPlan's Progress section with evidence.

You can see it working by running the stack from `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`,
then `VITE_BASE_PATH=/console/ bun run build`, then `caddy run --config dev/caddy/Caddyfile`,
and opening `http://localhost:8080/console/`: the Overview renders populated headline
numbers, the browser's network panel shows requests to `/kiroku/...`, `/pgmq/...`,
`/shibuya/...` and `/keiro/...` on the same origin with **no** `OPTIONS` preflight requests,
and at least one WebSocket connection (for example `/keiro/ws`) is upgraded with status 101.


## Progress

- [ ] M1 — Base-path-aware production build: `VITE_BASE_PATH=/console/ bun run build` emits
  hashed assets under `dist/assets/`, every asset URL in `dist/index.html` starts with
  `/console/`, the router resolves deep links under `/console/` on a hard reload via
  `bun run preview`, and the bottom bar's version slot shows the real version and commit.
- [ ] M2 — Release packaging: `bun run release:pack` writes
  `release/keiro-ui-console-<version>.tar.gz` containing the bundle, `VERSION`,
  `NOTICE.md`, the Paper Mono `OFL.txt`, and the two proxy examples; the optional Nix
  output `packages.<system>.console` builds the same bundle or is recorded as deferred with
  the reason.
- [ ] M3 — Deployment documentation and the development Caddyfile: `docs/deployment.md`
  carries recipes A, B and C plus the authentication posture; `dev/caddy/Caddyfile` serves
  `dist/` at `/console/` and proxies the four prefixes including WebSocket upgrades; the
  MasterPlan's early producer/consumer check (4) passes against the EP-9 stack.
- [ ] M4 — Production smoke and the read-only release: `bun run test:e2e:production` passes
  (tier 1 always, tier 2 against the live stack), `release/CHECKLIST.md` is executed, tag
  `v0.1.0` exists, `CHANGELOG.md` has the `0.1.0` entry, and the MasterPlan's "Read-only
  release gate" checkbox is checked with evidence.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The console is deployed as a static bundle in front of the surfaces, never served
  by keiro. The single-origin story is a reverse proxy (Caddy or nginx) or the application
  host's own static server placed in front of keiro's composed mount.
  Rationale: `mori://shinzui/keiro/okf/adrs/concepts/ADR-40` condition 1 forbids a bundled
  browser application in keiro; the parent MasterPlan's Decision Log records that a static
  mount in keiro is a candidate improvement request, not a dependency of this initiative.
  Date: 2026-10-21

- Decision: The router's base path is derived from Vite's `import.meta.env.BASE_URL`, which
  is set once by `VITE_BASE_PATH` at build time; the surface prefixes used by the default
  "same-origin" connection profile stay absolute (`/kiroku`, `/shibuya`, `/pgmq`, `/keiro`)
  and are **not** prefixed by the base path.
  Rationale: a console served at `/console/` must still reach the surfaces at the prefixes
  keiro's `composeSurfaces` mounts them under (`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`);
  deriving one value from the other removes a whole class of "works at root, breaks at a
  sub-path" bugs.
  Date: 2026-10-21

- Decision: The production smoke test has two tiers. Tier 1 runs with no backend and
  proves static serving at a sub-path, deep-link reloads, hashed assets, and honest
  "surface unreachable" health dots. Tier 2 runs only when the local stack answers its
  liveness probes through the proxy and proves populated screens, an upgraded WebSocket,
  and the absence of CORS preflights. Tier 2 is required for the MasterPlan's early check
  (4) and for the release checklist; tier 1 alone never satisfies the release gate.
  Rationale: packaging work must be verifiable on a machine without the Haskell toolchain,
  but the release must be proven against real surfaces.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

The keiro runtime is a Haskell stack — **keiro** (event-sourcing framework and workflow
engine), **kiroku** (append-only PostgreSQL event store), **shibuya** (supervised queue
processing) and **pgmq-hs** (PostgreSQL work queues). Each ships its HTTP/WebSocket
inspection surface as an embeddable WAI `Application` (a WAI application is a plain Haskell
value a web server such as Warp can run), which is what lets one host process mount several
of them under path prefixes; that packaging rule is
[ADR-4](../adr/0004-inspection-surfaces-live-in-sister-packages.md). The console in this
repository consumes those surfaces directly from the browser through one typed client
package per surface and has no server of its own —
[ADR-5](../adr/0005-no-backend-for-frontend.md). This plan therefore ships only static
files plus instructions for whatever sits in front of them.

**The workspace.** `docs/plans/7-scaffold-the-console-workspace-and-design-system.md`
creates a bun workspace with `apps/console` (the Vite + React + TypeScript application,
published name `@keiro-ui/console`), `packages/ui` (the shadcn-generated React Aria
components, the Paper Mono font at `packages/ui/src/fonts/PaperMono[wght].woff2` with its
licence at `packages/ui/src/fonts/OFL.txt`, and `globals.css`), `packages/client-core` and
the four `packages/client-<surface>` packages, and `packages/testing` (recorded fixtures and
mock handlers). It also provides a Nix flake at `flake.nix` with modules under `nix/` for the
toolchain, a `justfile`, and the root scripts `bun run dev`, `bun run build`, `bun run check`,
`bun run test`, `bun run test:e2e`. `apps/console/vite.config.ts` already contains the
development proxy that maps the four prefixes to the local ports; this plan extends that
file, it does not replace it.

**The shell.** `docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`
owns `apps/console/src/routes/` (TanStack Router file-based routes, the root route in
`routes/__root.tsx`, the shell layout in `routes/_shell.tsx`), the router factory (the call
to `createRouter` from `@tanstack/react-router`, which is where a base path is configured),
`apps/console/src/shell/status-bar.tsx` (the bottom bar, including a **version slot**), and
`apps/console/src/settings/connection-profiles.ts`, which defines

```typescript
type ConnectionProfile = {
  id: string
  name: string
  mode: "same-origin" | "separate"
  origins: { kiroku: string; shibuya: string; pgmq: string; keiro: string }
  processManagerNames?: string[]   // used by the process-manager screens
  deadLetterQueueSuffix?: string   // used by the actions plan
}
```

and the hook `useSurfaceBaseUrl(surface)`. In `same-origin` mode the base URL for a surface
is the absolute path prefix on the current origin (`/kiroku`, `/shibuya`, `/pgmq`, `/keiro`);
in `separate` mode it is the absolute origin stored in `origins`. The default profile is the
same-origin one. This plan does not change that model; it proves the model survives a
sub-path deployment.

**The composed-prefix convention.** The MasterPlan fixes, in its Integration Points, that
every environment reaches the surfaces under the same prefixes keiro's `composeSurfaces`
uses, and fixes the development ports:

```text
surface   dev server         dev port   prefix     WebSocket path(s)
shibuya   shibuya-metrics    9090       /shibuya   /shibuya/ws
kiroku    kiroku-inspect     9091       /kiroku    /kiroku/ws/metrics, /kiroku/ws/events
pgmq      pgmq-inspect       9095       /pgmq      /pgmq/ws
keiro     keiro-ops-http     9093       /keiro     /keiro/ws
```

Application routes never start with one of those prefixes, which is what makes a single
origin unambiguous. `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
starts those four servers on those ports against a seeded database; this plan's Caddyfile
points at them.

**Why there is no keiro-served console.** keiro's decision record
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40` allows an inspection surface as a bounded
exception to keiro's no-UI stance, and its first condition is that the surface ships "no
bundled browser application". keiro's `composeSurfaces` (recorded in
`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`) mounts the four surfaces under `/keiro`,
`/kiroku`, `/shibuya`, `/pgmq` on one listener and answers `GET /` with the list of mounted
prefixes, but serves no files. keiro's own guide for that composition is
`docs/guides/compose-runtime-inspection-surfaces.md` in `mori://shinzui/keiro` (artifact-level
URI pending); it says in prose that when console assets are served on the same origin no
CORS policy is needed, and leaves serving them to the host. Recipe B below is that case.

**CORS and the authentication posture.** `docs/architecture/inspection-api-conventions.md`
section 7 requires every server to support an explicit allowed-origins list, disabled by
default, with no wildcard when credentials are involved; section 8 records that no surface
authenticates and that the stated posture is a trusted network or an authenticating reverse
proxy in front of the surfaces. kiroku's `mori://shinzui/kiroku/okf/adrs/concepts/ADR-16`
says the same for its surface: browser access is explicit and default off. The deployment
document must restate the posture verbatim rather than imply safety that does not exist. The
flags that enable CORS, as audited on 2026-10-21 in each repository's working tree:

- `kiroku-inspect --cors-origin https://console.example` (repeatable), or the environment
  variable `KIROKU_INSPECT_CORS_ORIGINS`; `--cors-allow-credentials` exists and must stay
  off for the console, which sends no credentials.
- `pgmq-inspect --cors-origin https://console.example` (repeatable); credentials are never
  allowed by that server.
- shibuya-metrics has no command line: the host sets `corsAllowedOrigins = ["https://console.example"]`
  in `MetricsServerConfig` (module `Shibuya.Metrics.Config`); matching is exact and `*` is
  refused.
- `keiro-ops-http --allow-origin https://console.example` (repeatable); for a composed
  host, `ComposeConfig.allowedOrigins` applies CORS once on the outside.

**Vite and TanStack Router base paths.** Vite's `base` option (`https://vite.dev/config/shared-options.html#base`)
rewrites every emitted asset URL and is exposed to application code as
`import.meta.env.BASE_URL`. TanStack Router's `createRouter` accepts `basepath`, which
prefixes every route match and every generated link. The two must agree; this plan derives
the second from the first.

**Terms.** A *reverse proxy* is a server that receives browser requests and forwards some of
them to other servers while serving files for the rest; Caddy and nginx are two such servers.
*SPA fallback* means serving `index.html` for any path the proxy has no file for, so that a
browser reload on `/console/workflows/foo/bar` still loads the application and lets the
router resolve the path. A *preflight* is the `OPTIONS` request a browser sends before a
cross-origin request; on a single origin none is sent, which is the observable proof that
recipe A and B involve no CORS at all.

**Relevant local ADRs**: [ADR-4](../adr/0004-inspection-surfaces-live-in-sister-packages.md),
[ADR-5](../adr/0005-no-backend-for-frontend.md), [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md).
No local ADR covers packaging or deployment yet; the MasterPlan lists "the composed-prefix
deployment convention and the console-at-a-sub-path packaging" as a candidate ADR to write
after this plan completes, which the Outcomes section must do.


## Plan of Work

### Milestone 1 — a build that works at a sub-path

The console must not assume it lives at `/`. In `apps/console/vite.config.ts`, read
`VITE_BASE_PATH` (default `/`) and pass it as `base`; normalise it so it starts and ends with
`/`. Add a `define` block giving the application two compile-time constants:
`__APP_VERSION__` (the `version` field of `apps/console/package.json`, which this plan sets
to `0.1.0`) and `__GIT_COMMIT__` (the short commit from `git rev-parse --short HEAD`, or the
`KEIRO_UI_GIT_COMMIT` environment variable when the build runs without a git checkout, such
as inside Nix). Declare both in `apps/console/src/vite-env.d.ts`. If EP-8 already declared
placeholders with these names for the status bar's version slot, keep the names and replace
the placeholder values; the slot in `apps/console/src/shell/status-bar.tsx` renders them as
`v0.1.0 · a1b2c3d`.

In the router factory, pass `basepath: import.meta.env.BASE_URL` (TanStack Router treats a
trailing slash as optional). Then prove that the connection profile does not inherit the base
path: in `apps/console/src/settings/connection-profiles.ts` the same-origin prefixes are
literal absolute paths and the test added in this milestone asserts that
`useSurfaceBaseUrl("kiroku")` returns `/kiroku` when `BASE_URL` is `/console/`.

Mirror the development proxy into the preview server: copy the `server.proxy` table from
`docs/plans/7` into `preview.proxy` (same targets, `rewrite` stripping the prefix, `ws: true`),
so `bun run preview` reaches the EP-9 stack exactly as `bun run dev` does. Add a small
`scripts/check-dist.sh` that fails when `dist/index.html` references an asset not under the
base path or when any emitted asset lacks a content hash in its filename.

At the end of this milestone, `VITE_BASE_PATH=/console/ bun run build && bun run preview` serves
the console at `http://localhost:4173/console/`, a reload on
`http://localhost:4173/console/workflows` renders the Workflows screen (or its empty state
when no backend answers), and the version slot shows the real values.

### Milestone 2 — a release artifact

Add `scripts/release-pack.sh` (POSIX shell, run through the root script `bun run release:pack`)
that builds with the base path given by `VITE_BASE_PATH` (default `/`), then assembles
`release/keiro-ui-console-<version>/` containing the contents of `apps/console/dist/`,
a `VERSION` file (`0.1.0+<commit>`), `NOTICE.md` (third-party notices: Paper Mono under the
SIL Open Font License 1.1, pointing at the adjacent `OFL.txt` copied from
`packages/ui/src/fonts/OFL.txt`; the font files themselves are already inside `dist/assets/`),
and `deployment/Caddyfile.example` and `deployment/nginx.conf.example` copied from the
documentation written in Milestone 3. It then writes `release/keiro-ui-console-<version>.tar.gz`
and prints its SHA-256. `release/` is git-ignored except for `release/CHECKLIST.md`.

Optionally, add `packages.<system>.console` to `flake.nix` through a new module
`nix/console-package.nix`: a `stdenv.mkDerivation` whose dependencies come from a fixed-output derivation that runs
`bun install --frozen-lockfile` against `bun.lock` with a recorded `outputHash` (nixpkgs has
no first-class bun fetcher the way it has `pnpm.fetchDeps`; the `bun2nix` tool is the
alternative), running the same build with
`KEIRO_UI_GIT_COMMIT` set from the flake's `self.shortRev` and installing `dist/` into
`$out/share/keiro-ui-console`. This part is labelled **prototyping**: promote it if
`nix build .#console` succeeds with the nixpkgs revision the flake pins; discard it and record
the reason in Surprises & Discoveries if neither the fixed-output derivation nor `bun2nix`
reproduces the install with the pinned nixpkgs. The tarball is the required artifact; the Nix package is a
convenience.

### Milestone 3 — the deployment document and the development Caddyfile

Write `docs/deployment.md` with the following structure, in prose with one fenced example
per recipe. Open with the authentication posture, restated from the conventions document:
the surfaces have no authentication; deploy them on a trusted network or behind an
authenticating reverse proxy; the console adds no authentication of its own, so whatever
protects the surfaces must also protect the console's path.

**Recipe A — one origin, reverse proxy in front of four servers.** The console bundle is on
disk; the four inspection servers run on their own ports (the development table above, or
whatever the deployment chose). Caddy serves `dist/` at `/console/` with SPA fallback and
proxies each prefix with the prefix stripped; Caddy's `reverse_proxy` forwards WebSocket
upgrades without extra configuration. This is the content of `dev/caddy/Caddyfile`, with
`/srv/console` replaced by the repository path in the checked-in copy:

```text
:8080 {
	redir /console /console/ 301

	handle_path /console/* {
		root * /srv/console
		try_files {path} /index.html
		file_server
	}

	handle_path /kiroku/* {
		reverse_proxy 127.0.0.1:9091
	}
	handle_path /shibuya/* {
		reverse_proxy 127.0.0.1:9090
	}
	handle_path /pgmq/* {
		reverse_proxy 127.0.0.1:9095
	}
	handle_path /keiro/* {
		reverse_proxy 127.0.0.1:9093
	}
}
```

No server has CORS enabled in this recipe, and the default same-origin connection profile
needs no configuration. One rule keeps keiro's WebSocket working without an allow-list:
keiro-ops-http admits an upgrade whose `Origin` equals `scheme://Host` of the request it
receives, so the proxy must pass the browser's `Host` header through unchanged. Caddy does
this by default. Give the nginx equivalent beside it: a `location /console/` block with
`alias`, `try_files $uri $uri/ /console/index.html;`, and one `location /<prefix>/` block
per surface with `proxy_pass http://127.0.0.1:<port>/;` (the trailing slash strips the
prefix), `proxy_http_version 1.1;`, `proxy_set_header Host $host;` (nginx's default
`$proxy_host` would make every `/keiro/ws` upgrade a 403 `origin_not_allowed`),
`proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";` so
WebSockets pass. If a deployment cannot preserve `Host`, the alternative is
`keiro-ops-http --allow-origin https://console.example` as in recipe C.

**Recipe B — one origin, the application already composes the surfaces.** The Haskell host
runs keiro's `composeSurfaces`, so `/keiro`, `/kiroku`, `/shibuya` and `/pgmq` already answer
on one port (say 9000) and `GET /` lists them (an unmounted prefix answers 404
`surface_not_mounted`; the shipped `keiro-ops-http-compose-example` mounts only `/keiro`
and `/kiroku`, so a host composing all four is the application's own code). The proxy then has one `handle_path /console/*`
block for the bundle and a single `reverse_proxy 127.0.0.1:9000` for everything else. Point
the reader at keiro's guide `docs/guides/compose-runtime-inspection-surfaces.md`
(`mori://shinzui/keiro`, artifact-level URI pending) for the host side and note that
`ComposeConfig.allowedOrigins` must stay empty in this recipe.

**Recipe C — separate origins.** The console is served from any static host at any path.
In the console, create a connection profile with `mode: "separate"` and the four absolute
origins (Settings → Connections, or the command palette's "Switch connection"). On each
server, add the console's origin to the allowlist with the exact flag listed in Context and
Orientation, one per server, with a note that the shibuya setting is host code, not a flag.
State the costs plainly: four TLS endpoints, four allowlists to keep in sync, and preflight
requests on every cross-origin call.

Close the document with a troubleshooting list keyed on observable symptoms: a blank page
with 404s for `/assets/...` means the bundle was built with the wrong `VITE_BASE_PATH`; a 404
on reload of a deep link means SPA fallback is missing; a failed WebSocket with HTTP 403
`origin_not_allowed` means recipe C without the origin on that server's list; a 426 or 404 on
`/pgmq/ws` or `/kiroku/ws` over plain HTTP means the proxy is not forwarding the upgrade.

Verify the MasterPlan's early producer/consumer check (4) at the end of this milestone:
with the EP-9 stack running and `VITE_BASE_PATH=/console/ bun run build` done, run
`caddy run --config dev/caddy/Caddyfile`, open `http://localhost:8080/console/`, and record
in Progress that the Overview rendered with no `OPTIONS` request in the network panel.
Add `caddy` to the Nix development shell so the command is available to every contributor.

### Milestone 4 — the production smoke test and the read-only release

Add `apps/console/playwright.production.config.ts` and the root script
`bun run test:e2e:production`. Its `webServer` runs `caddy run --config dev/caddy/Caddyfile`
(with `reuseExistingServer` outside CI) and its `baseURL` is `http://127.0.0.1:8080/console/`.
Tests live in `apps/console/e2e/production/`, beside the other sections' specs.

Tier 1 (always runs, no backend required): the page at `/console/` renders the shell; a
direct navigation to `/console/workflows` renders the Workflows route (the shell's section
header is present); every `<script>` and `<link rel="stylesheet">` URL starts with
`/console/assets/` and contains a hash; the version slot shows `v0.1.0`; each health dot in
the bottom bar reports "unreachable" rather than crashing when its surface does not answer.

Tier 2 (runs when `GET /kiroku/health/live` through the proxy answers 200; otherwise the
tier is skipped with an explicit message naming the probe that failed): the Overview shows at
least one populated headline number per surface; the network log contains no request with
method `OPTIONS`; a WebSocket to `/keiro/ws` (or `/shibuya/ws`) reaches the open state; and a
request to `/pgmq/queues` is answered from the same origin as the page.

Then write `release/CHECKLIST.md` and execute it. The checklist, in order: every plan from
`docs/plans/13-build-the-streams-and-subscriptions-screens.md` through this plan is marked
Complete in the MasterPlan registry; `bun run check && bun run test && bun run test:e2e` are green;
`bun run test:e2e:production` is green with tier 2 executed (not skipped); a grep proves no
mutation path is reachable from the application —

```bash
cd /Users/shinzui/Keikaku/bokuno/keiro-ui
grep -rn -E "mutations\.(preview|execute)|/control/processors" apps/console/src && echo "FAIL: mutation path reachable" || echo "OK: no mutation path"
```

— `CHANGELOG.md` at the repository root gains a `## 0.1.0 — <date>` entry listing the
read-only sections; `apps/console/package.json` says `0.1.0`; the tag is created with
`git tag -a v0.1.0 -m "keiro runtime console 0.1.0 (read-only)"`; and finally the
"Read-only release gate" checkbox in `docs/masterplans/2-build-the-keiro-runtime-console.md`
is checked with the date, the tag, and the smoke-test transcript as evidence. The checklist
ends by reminding the reader that `docs/plans/19-add-gated-operator-actions.md` may not start
until that box is checked.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated otherwise. The Nix development shell from `docs/plans/7` provides `bun`, `node`,
`just`, and (after Milestone 3) `caddy`.

Build at a sub-path and inspect the output:

```bash
VITE_BASE_PATH=/console/ bun run build
sh scripts/check-dist.sh apps/console/dist /console/
```

Expected:

```text
vite v8.x building for production...
✓ built in 4.21s
check-dist: 1 html, 23 hashed assets, all under /console/ — OK
```

Preview and reload a deep link:

```bash
VITE_BASE_PATH=/console/ bun run preview
```

Open `http://localhost:4173/console/workflows` in a browser and reload. The Workflows screen
renders; the bottom bar reads `v0.1.0 · <7-char commit>`.

Pack a release:

```bash
bun run release:pack
```

Expected:

```text
release-pack: building (base /) ...
release-pack: wrote release/keiro-ui-console-0.1.0.tar.gz
sha256  3f9c...e1a2  release/keiro-ui-console-0.1.0.tar.gz
```

Inspect the tarball:

```bash
tar tzf release/keiro-ui-console-0.1.0.tar.gz | head
```

Expected to list `keiro-ui-console-0.1.0/index.html`, `keiro-ui-console-0.1.0/assets/...`,
`keiro-ui-console-0.1.0/VERSION`, `keiro-ui-console-0.1.0/NOTICE.md`,
`keiro-ui-console-0.1.0/OFL.txt`, and `keiro-ui-console-0.1.0/deployment/Caddyfile.example`.

Optional Nix package:

```bash
nix build .#console && ls result/share/keiro-ui-console
```

Run the single-origin deployment locally (stack from `docs/plans/9` running first):

```bash
just stack-up            # from docs/plans/9; starts 9090..9093 against the seeded database
VITE_BASE_PATH=/console/ bun run build
caddy run --config dev/caddy/Caddyfile --adapter caddyfile
```

Open `http://localhost:8080/console/`. In the browser's network panel, filter by `kiroku`:
requests go to `http://localhost:8080/kiroku/...` with status 200 and there is no request
with method `OPTIONS`. Filter by `WS`: `/keiro/ws` shows status 101.

Run the production smoke:

```bash
bun run test:e2e:production
```

Expected (with the stack running):

```text
Running 9 tests using 2 workers
  ✓ production › tier1 › serves the shell at /console/
  ✓ production › tier1 › deep link reload resolves /console/workflows
  ✓ production › tier1 › assets are hashed and under the base path
  ✓ production › tier1 › version slot shows v0.1.0
  ✓ production › tier1 › unreachable surfaces render honestly
  ✓ production › tier2 › overview is populated from every surface
  ✓ production › tier2 › no CORS preflight on a single origin
  ✓ production › tier2 › websocket /keiro/ws upgrades
  ✓ production › tier2 › pgmq queues answer from the page origin
  9 passed
```

Without the stack, the four tier-2 tests report `skipped: /kiroku/health/live did not answer
through the proxy`.

Cut the release (only after every item in `release/CHECKLIST.md` is satisfied):

```bash
git tag -a v0.1.0 -m "keiro runtime console 0.1.0 (read-only)"
git tag -l 'v0.1.0'
```

Then edit the MasterPlan's Progress section to check the "Read-only release gate" box with
the evidence, and commit with the trailers `MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md`
and `ExecPlan: docs/plans/18-package-the-console-for-deployment.md`.


## Validation and Acceptance

Required acceptance, each phrased as something a person observes:

1. `VITE_BASE_PATH=/console/ bun run build` succeeds and `sh scripts/check-dist.sh apps/console/dist /console/`
   prints `OK`; building with no `VITE_BASE_PATH` produces asset URLs starting with
   `/assets/`.
2. With `bun run preview`, a browser reload on `http://localhost:4173/console/workflows`
   renders the Workflows screen, and the bottom bar shows `v0.1.0` and a seven-character
   commit; `vitest` in `apps/console` includes a passing test that `useSurfaceBaseUrl("kiroku")`
   is `/kiroku` when `import.meta.env.BASE_URL` is `/console/`.
3. `bun run release:pack` writes `release/keiro-ui-console-0.1.0.tar.gz` whose listing includes
   `VERSION`, `NOTICE.md`, `OFL.txt`, `index.html`, hashed assets, and
   `deployment/Caddyfile.example`; running it twice produces the same listing.
4. With the EP-9 stack running and Caddy serving the build, `http://localhost:8080/console/`
   shows the Overview with populated headline numbers, the network panel shows zero
   `OPTIONS` requests, and one WebSocket shows status 101. This is the MasterPlan's early
   producer/consumer check (4); record the date in Progress.
5. `docs/deployment.md` exists, restates the authentication posture, and contains recipes
   A, B and C with the exact CORS flags; a reader following recipe A on a clean machine
   needs no information outside the document and the tarball.
6. `bun run test:e2e:production` passes with tier 2 executed; without the stack, tier 2 is
   skipped with the probe named and tier 1 still passes.
7. `release/CHECKLIST.md` has every item checked, `git tag -l v0.1.0` prints the tag,
   `CHANGELOG.md` has the `0.1.0` entry, the grep for mutation paths prints `OK`, and the
   MasterPlan's "Read-only release gate" box is checked with evidence.

Proposals that are **not** required acceptance and need a scope decision before being added:
publishing the tarball to a GitHub release, a container image bundling Caddy and the bundle,
and the keiro-side static mount (a candidate improvement request recorded in the MasterPlan).


## Idempotence and Recovery

Every build and pack step overwrites its outputs and can be rerun freely; `release/` is
git-ignored apart from the checklist, so stale tarballs never enter history. `scripts/check-dist.sh`
only reads. The Caddyfile binds port 8080; if the port is taken, stop the other process or
run `caddy run --config dev/caddy/Caddyfile --adapter caddyfile` after editing the listen
address locally (do not commit the change). The Nix package, if kept, fails loudly when the
lockfile changes without updating the recorded dependency hash; the fix is to rerun the
build, copy the hash it prints into `nix/console-package.nix`, and build again.

The only step with a one-way effect is the tag. Create it with `git tag -a` on a commit that
is already pushed or about to be pushed; if the checklist turns out to be unsatisfied after
tagging but before pushing, `git tag -d v0.1.0` removes it. Never move or delete a tag that
has been pushed; cut `v0.1.1` instead. Do not check the MasterPlan's gate box before the tag
exists, and if the box was checked prematurely, uncheck it in the same commit that explains
why in this plan's Surprises & Discoveries.


## Interfaces and Dependencies

**Prerequisites.** `docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md`
must be Complete (hard dependency declared in the MasterPlan registry): it provides the
router factory, `apps/console/src/shell/status-bar.tsx` with the version slot, and
`apps/console/src/settings/connection-profiles.ts`. `docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`
is a soft dependency: Milestones 1 and 2 need nothing from it, Milestone 3's early check and
Milestone 4's tier 2 need its `just stack-up`. `docs/plans/17-build-the-projections-and-overview-screens.md`
is a soft dependency: the smoke test asserts on the Overview, so tier 2 is final only once
EP-17 is Complete; until then tier 2 asserts on the Streams list instead and the test file
carries a `TODO(EP-17)` marker that the release checklist requires removed.

**What this plan produces for others.**

- `apps/console/vite.config.ts`: `base` from `VITE_BASE_PATH`; `define` for
  `__APP_VERSION__` and `__GIT_COMMIT__` (declared in `apps/console/src/vite-env.d.ts`);
  `preview.proxy` mirroring `server.proxy`.
- The router factory passes `basepath: import.meta.env.BASE_URL`; nothing else in the
  application may read `BASE_URL` to build URLs for the surfaces.
- `scripts/check-dist.sh`, `scripts/release-pack.sh`, root scripts `release:pack` and
  `test:e2e:production`, `just` recipes `build-console`, `release-pack`, `smoke-production`.
- `dev/caddy/Caddyfile` (ports 9090, 9091, 9095, 9093; console at `/console/` on 8080),
  consumed by the production smoke and by anyone reproducing recipe A.
- `docs/deployment.md`, `release/CHECKLIST.md`, `CHANGELOG.md`, and the tag `v0.1.0`, which
  `docs/plans/19-add-gated-operator-actions.md` requires to exist before it starts.
- Optional `nix/console-package.nix` exposing `packages.<system>.console`.

**Libraries whose choice matters.** Vite 8 (`base`, `define`, `preview.proxy`), TanStack
Router (`createRouter({ basepath })`), Playwright (`webServer`, `test.skip` with a reason for
tier 2), Caddy 2 (`handle_path`, `file_server`, `reverse_proxy`), and nginx only as a
documented alternative. No new runtime dependency is added to the console bundle by this
plan.
