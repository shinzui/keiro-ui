---
type: Guide
title: Deploying the keiro runtime console
description: Serve the static console bundle at any base path and make the four inspection surfaces reachable from it, on one origin behind a proxy, on a composing host, or on separate origins.
docId: DOC-3
timestamp: 2026-10-26T17:24:00Z
tags: [deployment, reverse-proxy, cors, base-path, operator-actions]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T22:52:08Z
---

# Deploying the keiro runtime console

The console is a static bundle: an `index.html` and hashed assets. It has no server of its own
(ADR-5); the browser talks to the four inspection surfaces directly. Deploying it means
putting the bundle somewhere a browser can load it and making the surfaces reachable from that
page. keiro does not serve the bundle (its inspection surface ships no browser application,
`mori://shinzui/keiro/okf/adrs/concepts/ADR-40`), so whatever serves the bundle sits in front
of the surfaces.

## Authentication posture

**The inspection surfaces have no authentication.** Deploy them on a trusted network or behind
an authenticating reverse proxy (`docs/architecture/inspection-api-conventions.md`, section 8;
kiroku's `mori://shinzui/kiroku/okf/adrs/concepts/ADR-16` says the same of its surface). The
console adds no authentication of its own, so whatever protects the surfaces must also protect
the console's path. Operator actions remain gated by each upstream; disabled UI controls and catalog visibility are not authorization.

## Getting the bundle

From a release, unpack `keiro-ui-console-<version>.tar.gz`: it contains the bundle, `VERSION`,
`NOTICE.md`, the Paper Mono licence `OFL.txt`, and proxy examples in `deployment/`. From a checkout, build it with the base path the console will
be served at:

```bash
VITE_BASE_PATH=/console/ bun run build        # writes apps/console/dist
VITE_BASE_PATH=/console/ bun run release:pack # or the tarball, in release/
```

The base path is fixed at build time. A release tarball is built for `/` unless it was packed
with `VITE_BASE_PATH`; serve it at the path it was built for. The surfaces are always reached at
their absolute prefixes (`/kiroku`, `/shibuya`, `/pgmq`, `/keiro`), whatever the console's path.

Every recipe below serves the bundle with an *SPA fallback*: any path under the console's base
that is not a file answers `index.html`, so a reload of `/console/workflows/order/42` loads the
application and its router resolves the path.

## Native Nix packages and container images

From a checkout with Nix flakes enabled, no local `node_modules` is required:

```bash
nix build --out-link result-console
nix build .#console-subpath --out-link result-console-subpath
nix flake check
```

The served directory is `result-console/share/keiro-ui`, including `VERSION`, `NOTICE.md`,
the font licence, and proxy examples. The default package builds for `/`; `console-subpath`
builds for `/console/`. Packages support `aarch64-darwin`, `aarch64-linux`, and `x86_64-linux`.
Bun 1.4.2 builds the assets; the deployed image runs Caddy, with no JavaScript toolchain.

On a Linux coordinator with Nix and a Docker daemon:

```bash
nix build .#docker-image
nix run .#docker-image.copyToDockerDaemon
docker run --rm --read-only -p 127.0.0.1:18088:8080 keiro-ui-console:dev
# Or the /console/ build, with a separate tag:
nix run .#docker-image-subpath.copyToDockerDaemon
bash scripts/check-container.sh keiro-ui-console:dev-subpath /console/
```

`docker-image` is a nix2container image description referencing the package and layers;
`result` is not an image tarball. Importing is a separate step. The image listens on port 8080,
runs as numeric user/group `65532:65532`, needs no writable directories, and works with a
read-only root filesystem. Root and sub-path deep links resolve to the app shell. Missing
assets, exact inspection prefixes and their children, and paths outside `/console/` return
404. Hashed assets use immutable caching; HTML revalidates. The default configuration includes
no upstream addresses. Route inspection traffic through your ingress or use a separate-origins
connection profile. Recipe A below shows the proxy rules; use reachable service addresses
rather than the development loopback addresses.

For a mounted configuration, start from
[the container proxy example](../deployment/container.Caddyfile.example), set its upstreams
and base-path routing for your deployment, then mount it read-only:

```bash
docker run --rm --read-only -p 127.0.0.1:18088:8080 \
  -v "$PWD/operator.Caddyfile:/etc/caddy/Caddyfile:ro" keiro-ui-console:dev
```

Caddy preserves Host and forwards WebSocket upgrades by default. Preserve the browser Origin
and configure upstream origin policies as described below. A container environment variable
cannot relocate assets already built for a different base path. To customize the package and
matching image, change the console binding in `flake.module.nix`, for example:

```nix
console = pkgs.callPackage ./nix/console.nix {
  inherit bun2nix gitCommit;
  basePath = "/operations/";
};
```

`nix/console.nix` also accepts an explicit `gitCommit`. Normal Git flakes use `self.rev` or
`self.dirtyRev`; source archives and `path:` flakes use `unknown`. That same value is embedded
in the app, `VERSION`, and notices. A new Git revision rebuilds the bundle, including after a
docs-only commit. With a fixed explicit revision, excluded docs changes preserve the package
identity. Base paths reject traversal, query/fragment syntax, inspection-prefix collisions,
and characters unsafe for literal Caddy paths.

### Apple containers on macOS

Use Apple Container exclusively on macOS; do not start Colima or select a Docker runtime.
The image smoke defaults to Apple Container on macOS and rejects other runtimes there.
`just nix-image-load` is Linux-only; use the OCI export/load workflow below on macOS.

Native static builds run directly on macOS. Image assembly and the Linux importer run inside
a Linux coordinator. A generic remote-builder setting alone does not cover the locally
preferred nix2container metadata steps. With Apple's `container` CLI running, create a
coordinator from the repository root; keep the exchange directory outside the checkout:

```bash
mkdir -p /tmp/keiro-ui-images
container run --detach --name keiro-ui-linux --arch arm64 --cpus 8 --memory 16G \
  --volume "$PWD:/workspace:ro" --volume /tmp/keiro-ui-images:/exchange \
  --workdir /workspace --entrypoint /bin/sh ghcr.io/nixos/nix:2.35.2 -c 'sleep infinity'
container exec keiro-ui-linux nix --extra-experimental-features 'nix-command flakes' \
  build path:/workspace#docker-image --no-link --option sandbox true
container exec keiro-ui-linux nix --extra-experimental-features 'nix-command flakes' \
  run path:/workspace#docker-image.copyTo -- --format oci \
  oci-archive:/exchange/console.oci.tar:keiro-ui-console:dev
python3 scripts/check-oci-archive.py /tmp/keiro-ui-images/console.oci.tar
container image load --input /tmp/keiro-ui-images/console.oci.tar
CONTAINER_RUNTIME=apple bash scripts/check-container.sh keiro-ui-console:dev /
container run --detach --name keiro-ui-console --read-only \
  -p 127.0.0.1:18088:8080 keiro-ui-console:dev
```

Open `http://127.0.0.1:18088/`. For `/console/`, export `docker-image-subpath.copyTo` using
tag `keiro-ui-console:dev-subpath`, and pass that image and `/console/` to the smoke script.
The path-flake example deliberately identifies the build as `unknown`. Apple loads OCI
archives, so this workflow materializes an archive during export even though Nix image
assembly itself does not. Stop and delete the two containers you named when finished; no
shared images or other containers need pruning.

### Dependency updates and validation

Keep the committed Bun lock and generated dependency expression together. Update dependencies
with the pinned Bun in the shell, then regenerate using the pinned, compatibility-patched
bun2nix helper:

```bash
nix develop -c bun install --frozen-lockfile # normal installation without dependency changes
# After deliberately changing package.json and refreshing bun.lock:
nix run .#bun2nix -- --lock-file bun.lock --output-file bun-deps.nix
nix build .#console-deps
nix flake check
```

The bun2nix 2.1.2 patch accepts lockfile v2 without rewriting it. Frozen sandbox installs and
the generation check validate the generated cache. Update helper pins deliberately in
`flake.nix`; retain the Seihou-managed nixpkgs/Bun pin unless a coordinated upgrade is needed.
Ordinary builds use only hash-verified registry downloads and their prepared local cache.

The smoke and benchmark scripts require Python 3 (provided by `nix develop`), the developer
dependencies, and Playwright's Chromium installed on the host. It tests the imported artifact without rebuilding it. An already running deployment
can also be checked directly:

```bash
CONSOLE_EXTERNAL_URL=http://127.0.0.1:18088/ \
  CONSOLE_EXPECTED_REVISION=unknown bun run test:e2e:production
bash scripts/benchmark-image.sh --output /tmp/keiro-ui-image-benchmark
# Apple coordinator variant (measures OCI export/load, rather than Docker import):
APPLE_NIX_CONTAINER=keiro-ui-linux APPLE_NIX_EXCHANGE=/tmp/keiro-ui-images \
  bash scripts/benchmark-image.sh --output /tmp/keiro-ui-apple-benchmark
```

Supply the package's exact revision, obtainable with `nix eval --raw .#console.gitCommit` for
a Git-flake build. The verified ARM64 Apple workflow measured 5.77 seconds median for a fresh UI edit through
import, versus 6.03 seconds for the matched streamed control. Patched importer compilation
took 26.37 seconds in a separate probe with cached dependencies; warm timing excludes that
one-time preparation. These host-specific OCI results do not predict Docker-daemon import
performance. [Plan 21](../plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md)
records the samples and limits. Benchmark reports preserve first-use/cached tool state, phase logs, three
fresh source edits, unchanged repeats, stable cache/runtime identities, and both builders'
assembly/import medians. They never prune caches or edit the working tree. Apple results
include OCI archive conversion and do not predict Docker-daemon import performance.

## One console for multiple applications

Build the asset base once, for example `VITE_BASE_PATH=/console/ bun run release:pack`. Serve
[console-config.example.json](../deployment/console-config.example.json) as
`/console/console-config.json` and adapt the explicit
[Caddy](../deployment/Caddyfile.multi-app.example) or
[nginx](../deployment/nginx.multi-app.conf.example) mappings. The release archive includes the
examples and [Kubernetes recipe](../deployment/kubernetes/README.md); it does not install a fake
catalog at the asset root. New targets need configuration and proxy routes, never a new build.
The catalog contains connection data only: no tokens, passwords, arbitrary headers or asserted
permissions. HTTPS consoles reject HTTP inspection URLs as mixed content.

Boot fetches the exact config path relative to the asset base with JSON Accept, no-store,
redirect rejection and a five-second timeout, before any inspection consumers mount. Only a
real 404 enables legacy same-origin/local-profile behavior. HTML fallback, empty/malformed JSON,
unsupported versions, authorization errors, network failures and timeouts show a configuration
error with Retry. A valid empty catalog offers configuration/local settings without connecting
to fixed prefixes. Config changes take effect after reload; a failed catalog never selects a
different app. **On upgrade, configure the exact JSON path before the SPA fallback**, including
a real 404 when absent. The supplied Vite dev/preview and proxy examples do so. Kubernetes uses
a mandatory catalog and responds 503 when its file is missing.

Each target identifies one application/environment with explicit optional base URLs.
`target` and `worker` in the URL select it per tab. Inferred selections are written with a
history replace before requests begin; user selection opens Overview with a new history entry.
An unknown explicit ID sends no inspection requests. Managed connections are read-only;
browser-local v1 profiles migrate only after complete validation into
`keiro-ui.connection-targets.v2`, preserving opaque legacy IDs, exact endpoints and settings.
The v1 document stays untouched. Invalid v2 blocks selection and offers raw export/reset.
Old unscoped recent/pinned links remain untouched for rollback and must be recreated in context.

For standalone servers, strip the entire external surface prefix:
`/inspection/prod/orders/keiro/wf/inspect/list` becomes `/wf/inspect/list`. For a composed
application host, remove only `/inspection/prod/orders`, keeping `/keiro/wf/inspect/list`.
Use one shape per route; never strip twice. The local fixture demonstration uses composed hosts.
Keep methods, raw encoded entity identifiers, query strings, bodies, WebSocket upgrades and
browser Origin unchanged. The nginx multi-app example maps the raw request URI so encoded IDs
survive prefix removal. No unknown inspection prefix may reach the SPA or a default app.

Route Shibuya worker entries to exactly one logical replica. A Service selecting several
workers, even a headless Service or sticky session, represents no stable process identity.
The Kubernetes recipe includes individual StatefulSet-pod Services owned by the application.
If reliable individual addressing is unavailable, omit Shibuya. Stable replicas may restart;
refresh after observed connection loss, and do not treat a replica name as an incarnation
precondition on commands. Database-backed surfaces can load-balance equivalent replicas.

Protect both HTTP routes and WebSocket handshakes at the existing gateway, with per-app
access decisions. Cookie-authenticated mutations require the gateway's CSRF protection;
socket handshakes require explicit Origin checks. Reject unauthorized API calls with 401/403,
not login HTML. Strip untrusted identity/forwarding headers before setting trusted ones.
Preserve the public browser Origin across TLS termination and allow-list that origin at every
owner, including Shibuya controls. Origin is scheme/host/port, never an inspection base path.
The catalog, a hidden UI button and same-origin routing enforce none of these policies.

Disable shared caching for API responses, errors and catalog; revalidate HTML and cache only
hashed assets immutably. Disable proxy mutation retries. Set finite socket idle limits suitable
for your gateway (nginx example: 300 seconds), and allow graceful shutdown. Feed reconnects
re-read HTTP state. A lost mutation response is an unknown result on its original app; do not
replay it automatically. Use route/status access logs without cookies, tokens, query values or
request bodies. The nginx example logs only fixed target identity, method and status; its routine raw-URI error logs are suppressed. Caddy runtime logs filter request headers and URI, and its request access logging is disabled.

Stage route additions on every replica before publishing catalog entries. Remove catalog
entries before retiring routes, and keep explicit errors at retired paths indefinitely because
open tabs retain old catalogs. Never reuse target IDs or inspection prefixes. Keep old bundle,
image and immutable configuration revisions for rollback. Restore those revisions together;
old bundles do not understand target-bearing links, so do not route those links to another
application as a compatibility shortcut. Navigation or asset rollback cannot roll back a
submitted action. See the Kubernetes runbook for two-replica rollout and cluster release checks.

A self-contained demonstration and required HTTP/feed/action regression is documented in
[dev/multi-app](../../dev/multi-app/README.md). Run `bun run test:e2e:multi-app`; it starts real
fixture hosts and Caddy and contains no external-stack skips. Runtime configuration alone is
not proof of your gateway's authentication or cluster network enforcement.

## Recipe A — one origin, a reverse proxy in front of four servers

The four inspection servers run on their own ports; a reverse proxy serves the bundle at
`/console/` and forwards each surface prefix to its server with the prefix stripped. No server
needs CORS and the console's default "Same origin" connection profile needs no configuration.

With Caddy (`deployment/Caddyfile.example`; Caddy forwards WebSocket upgrades and keeps the
browser's `Host` header by default):

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

Replace `/srv/console` with the unpacked bundle and the ports with your servers'. With nginx,
`deployment/nginx.conf.example` is the same layout: `location /console/` with `alias` and
`try_files $uri $uri/ /console/index.html;`, and one `location /<prefix>/` per surface with
`proxy_pass http://127.0.0.1:<port>/;` (the trailing slash strips the prefix),
`proxy_http_version 1.1;`, the `Upgrade` and `Connection` headers for WebSockets, and
`proxy_set_header Host $host;`.

Keep the browser's `Host` header. keiro-ops-http admits a WebSocket upgrade whose `Origin`
equals `scheme://Host` of the request it receives; nginx's default `Host` (`$proxy_host`) makes
every `/keiro/ws` upgrade a 403 `origin_not_allowed`. If your proxy cannot preserve `Host`,
start keiro-ops-http with `--allow-origin https://console.example` as in recipe C.

The repository's `dev/caddy/Caddyfile` is this recipe for the local stack (`dev/README.md`):

```bash
VITE_BASE_PATH=/console/ bun run build
caddy run --config dev/caddy/Caddyfile --adapter caddyfile   # from the repository root
```

It listens on 8080 (`CONSOLE_PORT=8088 caddy run …` picks another port) and serves
`apps/console/dist` (`CONSOLE_DIST` overrides it). Open `http://localhost:8080/console/`.

## Recipe B — one origin, the application already composes the surfaces

When the application host runs keiro's `composeSurfaces`, `/keiro`, `/kiroku`, `/shibuya`, and
`/pgmq` already answer on one port (say 9000), and `GET /` lists the mounted prefixes (an
unmounted prefix answers 404 `surface_not_mounted`; keiro's shipped
`keiro-ops-http-compose-example` mounts only `/keiro` and `/kiroku`, so a host composing all
four is the application's own code). The proxy then needs one block for the bundle and one for
everything else:

```text
:8080 {
	redir /console /console/ 301

	handle_path /console/* {
		root * /srv/console
		try_files {path} /index.html
		file_server
	}

	reverse_proxy 127.0.0.1:9000
}
```

`ComposeConfig.allowedOrigins` stays empty: the page and the surfaces share an origin. The host
side is keiro's guide `docs/guides/compose-runtime-inspection-surfaces.md` in
`mori://shinzui/keiro` (the artifact-level URI is pending).

## Recipe C — separate origins

The console is served from any static host at any path, and each surface keeps its own origin.
In the console, open Settings → Connections (or the palette's "Switch connection profile…"),
create a local target whose `surfaces` object contains the required absolute HTTP(S) base URLs, and select it in the Application selector. Paths are allowed; omitted surfaces stay disabled. Each
server must then allow the console's origin, with its own setting:

| Surface | Setting                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kiroku  | `kiroku-inspect --cors-origin https://console.example` (repeatable), or `KIROKU_INSPECT_CORS_ORIGINS`. Leave `--cors-allow-credentials` off: the console sends no credentials.                                |
| pgmq    | `pgmq-inspect --cors-origin https://console.example` (repeatable); the server never allows credentials.                                                                                                       |
| shibuya | Host code, not a flag: `corsAllowedOrigins = ["https://console.example"]` in `MetricsServerConfig` (`Shibuya.Metrics.Config`). Matching is exact; `*` is refused.                                                |
| keiro   | `keiro-ops-http --allow-origin https://console.example` (repeatable); a composed host sets `ComposeConfig.allowedOrigins` once, outside.                                                                       |

The costs: four TLS endpoints, four allow-lists to keep in sync, and a CORS preflight before
cross-origin requests. Recipes A and B have none of these.

## Operator actions

From 0.2 the console can pause and resume a shibuya processor, requeue or cancel a keiro timer,
and redrive a pgmq dead-letter queue through keiro. Each action rides its server's own gate and
is off by default: shibuya's `enableControl` (default `False`) and keiro-ops-http's
`--enable-mutations` (default off). With a gate off, the console shows the action disabled with
the server's reason.

**shibuya control needs the console's origin even on one origin.** Browsers send an `Origin`
header on every `POST`, including same-origin ones, and shibuya-metrics refuses a control `POST`
whose `Origin` is not in `corsAllowedOrigins` (403 `origin_not_allowed`), even when CORS is
otherwise off. Whenever `enableControl` is on, set `corsAllowedOrigins` to the console's origin:
the page's own origin in recipes A and B (for example `https://ops.example`), the console's
origin in recipe C. The console never strips or rewrites the header.

keiro previews every mutation before it can be confirmed, and the console requires the operator
to type the target (a timer id or a queue name) before executing. Executed actions are listed in
the session's audit sheet ("N actions this session" in the bottom bar), which is kept in the
browser tab only.

## keiro's read budget

keiro-ops-http admits a fixed number of concurrent inspection reads (4 by default) and answers
503 `inspection_busy` beyond it. The console keeps at most 3 keiro requests in flight so its
pages and the health probe stay within the default; a host that lowers the limit should expect
"busy" health states and retried reads.

## Troubleshooting

- **A blank page and 404s for `/assets/...`:** the bundle was built for a different base path
  than it is served at. Rebuild with `VITE_BASE_PATH` set to the serving path.
- **A 404 when reloading a deep link:** the SPA fallback is missing (`try_files` in both
  examples).
- **A WebSocket fails with HTTP 403 `origin_not_allowed`:** recipe C without the console's
  origin on that server's list, or a proxy that rewrites `Host` in front of keiro-ops-http.
- **A 426 or 404 on `/pgmq/ws` or `/kiroku/ws/...`:** the proxy is not forwarding the upgrade
  (nginx needs `proxy_http_version 1.1` and the `Upgrade`/`Connection` headers).
- **keiro's health dot reads "busy":** keiro's inspection slots were all in use at that moment;
  it clears on the next probe.
