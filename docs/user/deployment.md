---
type: Guide
title: Deploying the keiro runtime console
description: Serve the static console bundle at any base path and make the four inspection surfaces reachable from it, on one origin behind a proxy, on a composing host, or on separate origins.
docId: DOC-3
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
the console's path. The first release is read-only: nothing in it writes to any server.

## Getting the bundle

From a release, unpack `keiro-ui-console-<version>.tar.gz`: it contains the bundle, `VERSION`,
`NOTICE.md`, the Paper Mono licence `OFL.txt`, and `deployment/Caddyfile.example` and
`deployment/nginx.conf.example`. From a checkout, build it with the base path the console will
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
create a profile in "Separate origins" mode with the four absolute origins, and use it. Each
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
