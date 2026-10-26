---
id: 20
slug: connect-one-console-to-multiple-application-deployments
title: "Connect one console to multiple application deployments"
kind: exec-plan
created_at: 2026-10-26T02:31:13Z
intention: "intention_01m5v0syjvemm980170eeqdykq"
provenance:
  created_by:
    model: "gpt-6.1-sol"
    harness: "codex-cli"
    at: 2026-10-26T02:31:13Z
  revisions:
    - model: "gpt-6.1-sol"
      harness: "codex-cli"
      at: 2026-10-26T02:36:24Z
      mode: "other"
      note: "Create the five-milestone implementation plan and link the requested Mina intention."
---

# Connect one console to multiple application deployments

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture


Deploy keiro-ui once and use it to inspect and operate multiple Keiro applications across
environments. Operators select an application deployment, see its configured inspection
surfaces, and share a URL that opens the same deployment in another browser. Adding an
application changes a runtime configuration file and proxy routes; it does not rebuild or
duplicate the console bundle.

The primary deployment has one public origin, such as `https://ops.example`. A reverse proxy
(a server that forwards a request to a configured upstream server) serves the console at
`/console/`, its application catalog at `/console/console-config.json`, and inspection endpoints
under `/inspection/<environment>/<app>/<surface>/`. Each application keeps its existing APIs
and owns its runtime resources. The proxy handles authentication and authorization and
forwards HTTP and WebSocket traffic without combining or rewriting response bodies.

Demonstrate completion with one production console bundle, two inspection fixture servers
containing the same entity IDs but different data, and a proxy. Switching applications must
switch HTTP reads, live feeds, and operator actions together. Reloading a deep link and opening
different deployments in two tabs must preserve the intended targets.

This plan includes runtime configuration, target and worker selection, isolation, backward
compatibility, deployment examples, and acceptance tests. A fleet dashboard, cross-application
search, merged workflow lists, dynamic cluster discovery, a new authentication service, and
changes to upstream inspection protocols are outside its scope. The console polls only its
selected target; listing configured targets does not poll the whole fleet.


## Progress


- [ ] Milestone 1: Runtime catalog and migrated local profiles resolve explicit, optional surface base URLs without changing legacy deployments.
- [ ] Milestone 2: URLs, application and worker selectors, history, and shared links select the same target independently in each tab.
- [ ] Milestone 3: Reads, caches, feeds, and unavailable-surface behavior remain isolated when targets or endpoints change.
- [ ] Milestone 4: Confirmations, commands, recent items, pins, and audit entries preserve the originating application and worker.
- [ ] Milestone 5: One production bundle operates two applications through a real proxy, with packaged examples, documentation, and regression evidence.

Planning is complete; implementation has not started. This is a standalone follow-on to the
existing console, not a new child of the completed build-out in
`docs/masterplans/2-build-the-keiro-runtime-console.md`.


## Surprises & Discoveries


(None yet.)


## Decision Log


Decision (2026-10-25): Keep a static console, a deployment-owned JSON catalog, and explicit
proxy routes. Do not introduce a console backend that combines upstream responses. This
preserves ADR-5 and lets infrastructure control upstream reachability and access.

Decision (2026-10-25): Represent selection in the existing route tree with `target` and
`worker` search parameters, for example
`/console/workflows?target=prod-orders`. Search parameters preserve existing entity paths and
let the shared shell retain deployment identity across navigation without relocating every
screen. An explicitly unknown target never falls back to another application.

Decision (2026-10-25): Isolate the existing surface query keys by giving each active connection
session a fresh QueryClient, the object that owns fetched data and mutation state. A session
changes when target ID, effective endpoints, or selected worker changes. Dispose the previous
session rather than retaining a cache per visited application. This keeps existing feed writes,
cache scans, and surface invalidation prefixes consistent and bounds memory usage. A future
fleet view would require its own explicit cache scope.

Decision (2026-10-25): Model Shibuya workers explicitly within an application target. Its
processor state and control are local to one running process. Never imply that a randomly
load-balanced worker endpoint represents all replicas. Static worker entries are sufficient
for this plan; automated worker discovery is deferred.

Decision (2026-10-25): Managed catalog entries cannot be edited, removed, or overwritten by
browser profiles. Retain local profiles for development, with versioned migration and explicit
target identity. The catalog is connection configuration, not an authorization decision.

Decision (2026-10-25): Reset pending previews and confirmations on a selection change, and
capture the originating session for actions already submitted. Changing the selected app
does not cancel a mutation already accepted by its server or move that action to another app.


## Outcomes & Retrospective


(To be filled during and after implementation.)


## Context and Orientation


The repository is a Bun workspace. `apps/console` is the React browser application;
`packages/client-core` supplies HTTP, WebSocket, polling, and query-key helpers; the four
`packages/client-*` surface packages expose typed clients. A surface is one project's
inspection API: Keiro runtime operations, Kiroku event-store inspection, PGMQ queue inspection,
or Shibuya processor inspection. An application deployment, called a target below, identifies
one application in one environment and the endpoints used to inspect it. It is not a tenant,
database schema, or worker replica.

`apps/console/src/settings/connection-profiles.tsx` already stores selectable browser profiles
under `keiro-ui.connection-profiles.v1`. Same-origin profiles use the page origin plus fixed
surface prefixes. Separate profiles require four absolute origins and reject paths.
`apps/console/src/settings/clients.tsx` recreates the four clients when the selected URLs
change. `apps/console/src/settings/connections-page.tsx` provides editing and JSON import/export.
It currently has no deployment-owned catalog, optional endpoints, or worker inventory.

The lower-level clients already preserve a base URL's path:
`packages/client-core/src/http.ts` appends the resource path and converts the URL scheme for
WebSockets. Do not confuse a base URL, which can include a path, with an Origin header,
which contains scheme, host, and port only. Upstream origin policies must continue to receive
the console's public origin, never an inspection base path.

`apps/console/src/router.tsx` creates a singleton QueryClient and places it in router context;
`apps/console/src/routes/__root.tsx` provides it above the connection providers. Surface keys
in `packages/client-core/src/query-keys.ts` begin with just the surface, such as
`["keiro", "workflows", ...]`. Switching clients therefore reuses resource caches from the
previous deployment. `packages/client-core/src/live.ts` writes feed frames into that cache,
invalidates surface prefixes, and closes feeds on unmount. The timer sheet and workflow
journal sheet scan the current QueryClient. A fresh QueryClient around each session isolates
all of these existing access paths together. There are currently no data-loading route
functions using router context; the root component consumes that context's query client.

`apps/console/src/shell/search.ts` validates common search parameters. The link entry points
are `apps/console/src/lib/links.ts` and `apps/console/src/lib/href.ts`, alongside direct router
links and `navigate` calls in feature routes. `apps/console/src/shell/local-store.ts` listens
to localStorage changes from other tabs, so the current active-profile setting must stop
being authoritative for an already selected tab. `apps/console/src/shell/recent.ts` stores
recent and pinned entity URLs without explicit deployment attribution.

`apps/console/src/features/actions/mutation-flow.tsx` implements Keiro preview and confirmation.
`apps/console/src/features/processors/control-status.tsx` separately implements processor
pause/resume. Both record to `apps/console/src/features/actions/session-audit.ts`, whose entries
currently have no target identity. Registered palette commands and URL-driven right sheets
must also follow the connection-session lifetime.

`docs/user/application-integration.md` explains that Shibuya reads a worker process's in-memory
Master, while the other surfaces inspect database-backed state. An app may have separate job
and subscription worker processes and several replicas of each. This plan does not claim
that proxying one of those processes yields a fleet-wide processor view.

`apps/console/vite.config.ts` sets the bundle base path from `VITE_BASE_PATH`, and the router
uses `import.meta.env.BASE_URL`. `dev/caddy/Caddyfile` and the files in `docs/deployment/`
serve one console and four fixed surface routes. `scripts/release-pack.sh` packages the
bundle and deployment examples. `apps/console/playwright.production.config.ts` already runs
a built bundle at `/console/` through Caddy; its existing backend-dependent tests can skip
when no stack is running. New multi-application fixture acceptance must be deterministic and
must not depend on that optional stack.

Relevant accepted decisions were read during planning.
[ADR-1](../adr/0001-inspection-endpoints-live-in-the-owning-project.md) assigns inspection
semantics to the owning projects. [ADR-5](../adr/0005-no-backend-for-frontend.md) permits routing
but rejects a backend that reshapes or combines their APIs.
[ADR-9](../adr/0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md) fixes the
console's asset base at build time and currently assumes fixed browser-visible surface
prefixes; implementation must amend that assumption for explicitly configured target URLs
while preserving the legacy default. [ADR-12](../adr/0012-poll-first-live-queries.md) keeps
polling authoritative and feed frames as an accelerator within the same cache.
[ADR-13](../adr/0013-honest-gates.md) requires truthful capability and mutation gating, previews,
and server refusal messages. These rules remain in effect for every target.

Keiro composition is routing within an application, described by
`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`; it does not provide discovery or aggregation
of separate applications. The source at `mori://shinzui/keiro`, project-relative path
`keiro-ops-http/src/Keiro/Ops/Http/Compose.hs` (artifact-level URI pending), accepts already
allocated applications under stable surface prefixes. No change to that composer is needed.


## Plan of Work


### Milestone 1 — Runtime catalog and compatible connection targets


Create `apps/console/src/settings/connection-targets.ts` for schemas, migration, URL validation,
and normalization, and `apps/console/src/settings/runtime-config.ts` for fetching configuration.
Use the interfaces in the final section of this plan. Managed configuration uses an explicit
version and default target. It permits optional surface endpoints and an optional named worker
inventory. Endpoint strings are either absolute HTTP(S) base URLs or root-relative paths;
reject protocol-relative URLs, embedded credentials, query strings, fragments, backslashes,
and encoded or literal traversal segments. Keep proxy routing tied to explicit configured
targets. Catalog data is never interpreted as a generic server-side URL to proxy.

Fetch `console-config.json` relative to `import.meta.env.BASE_URL`, not the current entity URL,
before mounting any inspection consumers in `apps/console/src/main.tsx`. Send `Accept:
application/json`, use a five-second timeout and `cache: "no-store"`, and show a loading state
until resolution. HTTP 404 means no managed catalog and preserves the existing built-in and
browser-local profiles. An empty or malformed 200 response, HTML from an SPA fallback,
unsupported version, network failure, timeout, 401, or 403 shows a configuration error with
Retry; it must not silently connect to the built-in target. The proxy examples must give this
exact JSON path its own handler before the SPA fallback, returning a real 404 if absent.
An empty valid managed target list shows configuration instructions and local settings, not
an automatic connection to fixed surface prefixes.

Apply that exact-path handling to the existing `dev/caddy/Caddyfile`, both existing
single-application examples in `docs/deployment/`, and the Vite development and preview
servers in `apps/console/vite.config.ts` as well as the new multi-app examples. A Vite plugin
can handle this file before fallback using the public-directory file when present and a real
404 otherwise. Test development, preview, and production boot with the file absent. Document
that other static hosts must configure this exception when upgrading; treating every HTML
response as an absent catalog would conceal a misrouted or malformed configured deployment.

Migrate browser profiles to `keiro-ui.connection-targets.v2` only after successful validation.
Read v2 first; otherwise convert v1 same-origin profiles to their existing four paths and
separate profiles to their four exact origins, preserving IDs, labels, process-manager names,
and dead-letter suffix. Leave the v1 value untouched for rollback. Maintain v1 JSON import
as an adapter, export local targets as v2, and exclude managed configuration from local export.
Do not persist managed targets into browser storage. Catalog and local IDs must be globally
unique in the effective target set; collisions produce a visible configuration error, never
silent overrides. Managed targets are visibly read-only in Settings → Connections.

Use the old profile name as the migrated label, its ID as the app identifier, and `local` as
the environment when the old record has no such metadata. The built-in target keeps ID
`same-origin`, label `Same origin`, and its exact four existing endpoints. Validate the whole
stored v2 document before choosing a last-used target; never discard an invalid stored record
and silently select a different application.

Make the base-URL and WebSocket helpers accept normalized endpoints without prepending the
console asset path. Add tests in `apps/console/src/settings/connection-targets.test.ts` and
`apps/console/src/settings/runtime-config.test.ts`, retaining the existing profile and base-path
regressions through the compatibility adapter. Acceptance is that a fetched catalog resolves
Orders and Billing to different namespaced paths, a two-surface app stays a two-surface app,
and existing saved profiles still resolve to the exact endpoints they used before.

### Milestone 2 — Deployment identity in URLs and selectors


Create `apps/console/src/settings/target-selection.tsx` for selecting a validated target and
worker from the URL. Extend the shared search schema and the shell route to retain `target`
and `worker` across navigation. Use the installed router's search middleware after verifying
its API through Mori. Update `apps/console/src/lib/links.ts`, `apps/console/src/lib/href.ts`,
the settings redirect, and direct navigation paths so both actual navigation and rendered
anchor hrefs preserve identity. External links must remain external. Query parameters used
for entity filters, cursors, sheets, and tabs must keep their existing meaning.

An explicit `target` parameter is authoritative. An unknown ID renders an unavailable-target
screen with a selector and settings access, makes no inspection requests, and never changes
to a default. A URL without a target chooses a valid local last-used ID, then the configured
default, then the legacy same-origin target only when no managed catalog exists. If none
applies, ask the operator to select from the catalog in the page. Canonicalize an inferred
selection with a history replace before mounting inspection consumers. Changing a saved
last-used ID in another tab affects future target-less entry only, not a tab's explicit URL.

The application selector replaces the status-bar profile switcher and groups entries by
environment, displaying both application and environment. A user-initiated application change
navigates to Overview with the new target, clears the old worker, sheet, entity filters, and
cursors, and pushes a history entry. This avoids reopening an identically named entity in a
different app by accident. Back and Forward restore the prior URL's complete selection.

When a target declares workers, a worker selector displays their labels and process identity.
An explicit invalid worker makes processor inspection unavailable without falling back to a
different process; database surfaces can continue. Without an explicit worker, use the
declared default, or the sole worker when there is only one. Multiple workers without a
default require a selection before processor requests or controls. Canonicalize inferred
workers in the URL. Switching worker navigates to the processor list with that worker and
clears entity and sheet state. A target's direct Shibuya endpoint remains supported for
legacy profiles and apps that deliberately expose just one process.

Acceptance in `apps/console/src/settings/target-selection.test.tsx` and router integration
tests covers reloads, explicit unknown IDs, two-tab storage events, Back/Forward, settings
redirects, and native anchor opening. A link copied from a workflow or processor page must
contain enough selection information to reach the same managed application and worker in a
fresh browser with the same catalog. A local target absent from that browser instead shows
the unavailable-target state.

### Milestone 3 — Isolated connection sessions and optional surfaces


Introduce `apps/console/src/settings/connection-session.tsx`. Once target selection is valid,
mount one keyed session containing a fresh QueryClient, available surface clients, liveness,
feature command registrations, status slots, sheets, and page content. Its identity includes
target ID, selected worker ID, and normalized effective endpoint configuration. Changing a
local profile's endpoint under the same ID creates a new session. Cosmetic label changes
need not recreate connections. Keep the catalog, selectors, theme, and tab-wide audit outside
the disposable session.

Move ownership of the query provider out of the singleton setup in
`apps/console/src/routes/__root.tsx` and `apps/console/src/router.tsx`. Remove the obsolete query
client from router context instead of leaving a second unused cache there. Adjust
`apps/console/src/test/render-route.tsx` to exercise the real session provider; tests needing
cache inspection must access the active session's QueryClient. Leave surface key factories
unchanged because all queries, feeds, cache scans, invalidations, and mutation state for a
connection live inside that connection's isolated cache.

On disposal, invalidate the session's active token, unmount consumers, cancel outstanding
read queries, close sockets and reconnect timers, and clear the retired query cache. Guard
asynchronous callbacks with the originating session token where they can otherwise publish
UI state after disposal. Delayed HTTP responses, feed frames queued before close, and queued
reconnects may never reach the next session's cache or status indicators. Do not promise that
aborting a browser request cancels server execution of an already submitted mutation.

Update `apps/console/src/settings/clients.tsx` and its compatibility hooks for optional URLs.
Never invent a fallback endpoint for an omitted surface. Expose surface availability and a
clear configuration reason to health widgets, feature queries, feed hooks, and actions.
Disable the corresponding requests and show “Not configured for this application” on pages
requiring that surface. Keep dependent pages partially useful: an aggregate can show its
folded state when Kiroku is absent, explaining why the raw-event pane is unavailable. Overview
cards for configured surfaces continue to work. Distinguish omitted endpoints from configured
but unreachable endpoints and server-side missing capabilities. A worker needing selection
is a distinct “Select a worker” state.

Add an early browser integration check before broad feature adaptation: route one workflow
list read and its Keiro feed through an Orders namespaced endpoint, switch to Billing with
the same workflow ID, then deliver an old Orders response and frame. Billing must contain
only Billing data and only Billing's connection may reconnect. Expand this to timer and
journal cache scans, queue reads, and active-session invalidation. Keep polling authoritative
as required by ADR-12. Acceptance includes repeated A→B→A switches without accumulating
background polls, clients, or WebSocket reconnects.

### Milestone 4 — Safe actions, scoped navigation history, and audit attribution


Update `apps/console/src/features/actions/mutation-flow.tsx` and
`apps/console/src/features/processors/control-status.tsx` so dialogs visibly state app,
environment, and worker where applicable. Capture the session identity and original client
when starting an operation. Verify the session is still active before submitting execution;
retiring a session closes all pending dialogs and prevents delayed previews from reopening
them. Reset typed confirmations and preview handles on target, worker, or endpoint change.
Keep existing server gates, preview semantics, and refusal rendering intact.

An operation submitted before a switch remains bound to its original endpoint and audit
identity. Its eventual completion may update that original audit entry but cannot invalidate
the new app's cache or display an unqualified success toast in the new app. Surface a
target-labelled completion through the tab-wide audit; do not retry mutations automatically
or describe navigation as rollback. Retain the existing unknown-outcome behavior and record
the original target even when the response arrives after its session was disposed.

Extend `apps/console/src/features/actions/session-audit.ts` and its sheet with target ID, app,
environment, worker ID when present, and an immutable endpoint/session identity captured at
submission. The audit remains tab-local memory. It can show all actions in that tab because
each is attributed; it must not imply a durable server audit.

Version recent and pinned storage in `apps/console/src/shell/recent.ts`. New entries include
explicit target and worker identity as appropriate and canonical URLs. Show recent items for
the selected app in its sidebar; palette results that cross targets must label their app and
environment. Deduplicate by target, worker, entity kind, and href rather than bare entity ID.
Keep old v1 entries intact for rollback, but do not assign unscoped history to whichever app
happens to be active. Exclude those entries from automatic operational links and explain in
Settings that they can be recreated by revisiting and pinning within a selected app.

Ensure palette action registrations, process-manager suggestions based on prior visits, and
right-sheet state retire with the old session. Acceptance uses the same timer, queue, and
processor IDs in two apps: preview on A then switch to B submits no execution; submitting on
A then switching while the response is delayed records A; switching workers clears pause
confirmation and cannot send it to the new process. Recent and pinned links must reopen
their original targets and settings links must retain selection.

### Milestone 5 — Proxy proof, release packaging, and operating documentation


Add `docs/deployment/console-config.example.json`,
`docs/deployment/Caddyfile.multi-app.example`, and
`docs/deployment/nginx.multi-app.conf.example`. Show one console and explicit Orders/Billing
surface mappings, one app with a missing optional surface, and two named worker endpoints.
Route `/inspection/prod/orders/keiro/*` to a standalone surface with the full external prefix
stripped, or preserve `/keiro/*` when forwarding to an already composed application host;
document both shapes without double stripping. Route worker endpoints to a particular
process. Unknown inspection prefixes must return 404, never the SPA document or a default
application. Match the config file before the SPA fallback and disable caching for it;
hashed assets retain their existing caching behavior.

Preserve WebSocket upgrades, encoded entity identifiers, query strings, methods, and request
bodies. Forward the browser Origin unchanged and configure each owner for the public HTTPS
console origin; preserving Host alone is insufficient when TLS terminates upstream. Document
Shibuya's existing requirement to allow-list the console's origin even for same-origin control
POSTs. Keep authentication and per-app access policy at the deployment gateway and protect
both HTTP requests and WebSocket handshakes. Catalog visibility and disabled UI controls
are not access enforcement; direct unauthorised calls must be denied by the deployment's
gateway. Production credentials stay outside the catalog and browser storage. Do not add a
generic URL-forwarding endpoint, a new login flow, or a new access-control implementation.

Add `dev/multi-app/inspection-fixtures.ts` using Bun's built-in HTTP/WebSocket server for
deterministic, distinct upstream fixtures; reuse recorded payloads from `packages/testing`
and change only identifiers and labels needed to prove separation. Give the two applications
separate ports and request journals, delayed-response controls, different feed frames, and
mutation preview/execute recordings. Fixture mutation handlers must not operate real
databases. Add `dev/multi-app/Caddyfile` and a catalog fixture. Create
`apps/console/playwright.multi-app.config.ts`, a `test:e2e:multi-app` script in both relevant
package manifests, and `apps/console/e2e/multi-app/multi-app.spec.ts`. This suite must start
its own fixtures and Caddy, build once for `/console/` into `dist-multi-app`, and fail if
fixtures or the proxy do not start. Exclude this directory from the generic Playwright
project selection so the suite always runs through its intended config.

Prove HTTP reads, at least one actual WebSocket exchange, and a preview/execute pair through
the real proxy for both applications. Browser route interception alone is insufficient for
this milestone. Include a fixture-only denial route showing that a forbidden app's HTTP and
WebSocket access are refused rather than redirected to another upstream. Clearly describe
that this is a routing regression, not a test of every deployment's authentication provider.
Validate the nginx example with `nginx -t` when nginx is installed; Caddy is the required
executable proxy for this suite and must pass `caddy validate`.

Extend `scripts/release-pack.sh` to include the new examples without installing a live catalog
of fake apps into the released console by default. Update `README.md`,
`docs/user/deployment.md`, `docs/user/application-integration.md`, and
`docs/user/console-reference.md` with configuration loading/failure behavior, local migration,
shareable URLs, optional endpoints, worker limits, access policy, and rollback. Config changes
take effect on page reload; live catalog watching is outside scope. Demonstrate that editing
the served catalog adds a target without changing any hashed console assets.

Amend ADR-9's browser-prefix assumption and create a durable ADR for target identity and
session isolation, using the repository's profiled ADR workflow. Preserve ADR-5's boundary.
Inspect `mori.dhall` with `mori show --full`, read `docs/adr/profile.dhall`, obtain a stable
handle with `okf id next`, and maintain the bundle log when timestamps change. Run strict
profile enforcement. Finish by recording acceptance evidence and promoting any additional
durable discoveries into the relevant ADRs.


## Concrete Steps


Run commands from the repository root. Use the existing Nix development shell when Bun,
Node, Caddy, or the test tools are not on PATH. Do not traverse `/nix/store` or the filesystem
root. Locate dependency source and documentation through Mori before relying on unfamiliar
APIs. No dependency upgrades or changes to upstream repositories are required by this plan.
If implementation establishes a need for changed dependency bounds, verify releases against
the authoritative package registry and upstream tags before choosing them.

```bash
nix develop
bun install
mori registry list
mori registry search tanstack
mori registry show TanStack/router --full
mori registry docs TanStack/router
```

Router discovery during planning found the `retainSearchParams` documentation and source at
`mori://TanStack/router`, project-relative paths
`router/docs/router/api/router/retainSearchParamsFunction.md` and
`router/packages/router-core/src/searchMiddleware.ts` (artifact-level URIs pending).
The middleware retains named search keys and respects explicit
removal. Use the current corpus source to confirm behavior and the repository's installed
version when implementing; do not copy a different version's semantics without tests.

Run focused tests after each milestone; create the named tests as part of that milestone.

```bash
bun run test apps/console/src/settings/connection-targets.test.ts apps/console/src/settings/runtime-config.test.ts
bun run test apps/console/src/settings/target-selection.test.tsx
bun run test apps/console/src/settings/connection-session.test.tsx
bun run test apps/console/src/features/actions apps/console/src/features/processors/control-status.test.tsx apps/console/src/shell/recent.test.ts
```

The session tests must include late response/feed delivery and same-ID entities across targets;
the action tests must exercise switching while previews and executions are in progress. Add
route integration assertions alongside the existing feature tests when adapting optional
surfaces. Keep the command list synchronized if a test file is named differently.

After implementing the multi-app fixtures and test configuration, run the required integrated
checks. `bun run check` covers type checking, lint, and formatting. `bun run test` runs Vitest;
do not substitute the unrelated `bun test` runner. The new Playwright script must report
passing multi-application cases with no backend-dependent skips.

```bash
bun run check
bun run test
bun run test:e2e
bun run test:e2e:production
caddy validate --config dev/multi-app/Caddyfile --adapter caddyfile
bun run test:e2e:multi-app
VITE_BASE_PATH=/console/ bun run release:pack
git diff --check
```

The existing production suite can still report its documented optional-stack skips. Those
skips do not satisfy the new multi-app acceptance. Inspect the release archive to confirm it
contains the new deployment examples and no deployment credentials or enabled fake catalog.

For a manual demonstration after building, start the fixture runner and proxy in separate
terminals. The fixture runner must document its ports in `dev/multi-app/README.md`; use
19193 for Orders and 19293 for Billing, and 18080 for the console proxy, with overrides so
the suite can fail clearly on collisions.

```bash
bun dev/multi-app/inspection-fixtures.ts
```

```bash
VITE_BASE_PATH=/console/ bun run build
CONSOLE_DIST=apps/console/dist caddy run --config dev/multi-app/Caddyfile --adapter caddyfile
```

Open `http://localhost:18080/console/workflows?target=prod-orders`. Copy a workflow link into
a fresh browser, switch to Billing, and compare requests and labels. Open a processor page
using each configured worker and verify the worker identity and URL. Remove one optional
surface from the served catalog, reload, and observe its configured-unavailable state while
the remaining screens continue to operate. Add a target by editing configuration and proxy
routes and reloading; do not invoke another console build.

For ADR updates, inspect and type-check the local descriptor, allocate new IDs without guessing,
update the bundle log using `okf log add` according to its CLI help, and validate:

```bash
mori show --full
dhall type --file docs/adr/profile.dhall
okf id list docs/adr --profile docs/adr/profile.dhall
okf id next docs/adr --profile docs/adr/profile.dhall ADR
okf validate docs/adr --strict --profile docs/adr/profile.dhall --profile-enforce --log-enforce
```


## Validation and Acceptance


The first externally visible result is two named application deployments in one console.
Their request paths differ by deployment prefix even when entity names and IDs are identical.
A third target appears after changing configuration and reloading, with the console asset
hashes unchanged. Namespaced base paths work for all four clients, including WebSocket URLs;
the console asset base never leaks into inspection paths.

Selection acceptance covers a target-bearing deep link, browser reload, native Open Link in
New Tab, two tabs using different targets, Back/Forward, and a fresh browser with the managed
catalog. An invalid target yields no inspection requests and offers explicit recovery. A
worker-specific processor link always selects that worker. Another tab's saved preference
cannot change an already selected target.

Isolation acceptance uses delayed responses and feed frames from Orders after switching to
Billing. Billing never displays Orders data, revives an Orders sheet, or receives Orders
invalidations. After repeated switches there is only one active session's polling and feed
connections. Editing a local target's URLs with the same ID also retires its previous cache.
Missing endpoints send zero requests for that surface and display a configuration reason;
configured but unreachable endpoints still display connectivity failure.

Action acceptance proves that switching away invalidates an unexecuted preview and a worker
control confirmation. No POST may be sent to the new app using an old confirmation. An
already submitted action completes only against its original upstream and records that app
and worker in the audit, even when its result arrives after switching. Existing disabled gates,
typed confirmations, server refusals, and unknown-outcome locking continue to pass their tests.

Production acceptance runs the real Caddy proxy and built bundle against two deterministic
fixture servers without skipping cases. HTTP request journals and WebSocket exchanges prove
the correct upstream and path rewriting; preview/execute journals prove correct action
routing. Unknown and forbidden targets never fall through to another app or the SPA. The
runtime JSON path answers JSON or a real error independently of deep-link fallback. Existing
legacy same-origin and separate-origin scenarios, including `/console/` asset paths, remain
covered by the existing suites.

Record concise commands, passing test totals, and material limitations in Progress and
Outcomes after implementation. A written example alone, a skipped live-stack test, or a
mocked browser response alone does not satisfy production acceptance. No rollout to external
infrastructure is required to complete this repository change.


## Idempotence and Recovery


This work changes static configuration and browser state; it performs no database migration.
The fixtures use isolated ports and disposable process memory. Their POST handlers record
requests without contacting real applications. Repeating tests or builds must close previous
fixtures and proxy processes cleanly; keep `dist-multi-app` separate from the existing build
directories to avoid concurrent suite interference.

Local-profile migration validates before writing v2 and keeps v1 untouched. If a stored v2
payload is malformed, show a recoverable settings error with export/reset guidance; do not
silently overwrite it with a different deployment. A retry of catalog loading replaces no
working connection until validation succeeds. A bad managed catalog displays its error,
rather than failing over to a different app. Operators can restore a known catalog and
reload. Do not delete users' storage to make tests pass; seed and restore test storage within
test fixtures.

Deploy the target-aware bundle and namespaced proxy routes together, preserving old fixed
prefixes where legacy clients need them. Rollback restores the previous bundle and proxy
configuration; the untouched v1 profile storage remains readable by the old UI. URLs carrying
target selection require the new UI to preserve their guarantee, so document that old bundles
do not understand those links. Do not route old target-bearing links to a different app as
a compatibility shortcut. An in-flight mutation is never rolled back by reverting UI assets
or changing selection; consult its original target's state if the outcome is unknown.


## Interfaces and Dependencies


Define and validate the following wire configuration in
`apps/console/src/settings/connection-targets.ts`. Use existing `Surface` names; endpoints
are base URLs, not origins. IDs are nonempty stable strings matching
`[A-Za-z0-9][A-Za-z0-9._-]*`; preserve legacy IDs through migration and reject duplicates.
`defaultTargetId` and `defaultWorkerId`, when provided, must reference existing entries.
Labels, app, and environment must be nonempty trimmed strings. At least one surface or
worker endpoint must exist. A nonempty `workers` list and `surfaces.shibuya` are mutually
exclusive, avoiding ambiguous processor routing. Each worker ID is unique within its target.

```typescript
interface RuntimeConsoleConfig {
  version: 1
  defaultTargetId?: string
  targets: ConnectionTarget[]
}

interface ConnectionTarget {
  id: string
  label: string
  app: string
  environment: string
  surfaces: Partial<Record<Surface, string>>
  workers?: WorkerTarget[]
  defaultWorkerId?: string
  processManagerNames?: string[]
  deadLetterQueueSuffix?: string
}

interface WorkerTarget {
  id: string
  label: string
  shibuyaBaseUrl: string
}

interface SelectedConnection {
  target: ConnectionTarget
  worker?: WorkerTarget
  source: "managed" | "local" | "builtin"
  endpoints: Partial<Record<Surface, string>> // normalized effective absolute URLs
  sessionKey: string // target ID + worker ID + normalized endpoint configuration
}
```

Keep source metadata outside the deployed JSON's target shape. The catalog describes service
connections only; it contains no passwords, bearer tokens, arbitrary request headers, or
permissions presented as authoritative. Root-relative endpoints resolve against the page's
origin, never against an entity route. Absolute URLs keep their paths. Store a canonical
trailing-slash normalization so appending resource paths does not double separators.

A minimal deployed example is:

```json
{
  "version": 1,
  "defaultTargetId": "prod-orders",
  "targets": [
    {
      "id": "prod-orders",
      "label": "Orders",
      "app": "orders",
      "environment": "prod",
      "surfaces": {
        "keiro": "/inspection/prod/orders/keiro",
        "kiroku": "/inspection/prod/orders/kiroku",
        "pgmq": "/inspection/prod/orders/pgmq"
      },
      "workers": [
        {
          "id": "jobs-1",
          "label": "Job worker 1",
          "shibuyaBaseUrl": "/inspection/prod/orders/workers/jobs-1/shibuya"
        },
        {
          "id": "subscriptions-1",
          "label": "Subscription worker 1",
          "shibuyaBaseUrl": "/inspection/prod/orders/workers/subscriptions-1/shibuya"
        }
      ],
      "defaultWorkerId": "jobs-1"
    },
    {
      "id": "prod-billing",
      "label": "Billing",
      "app": "billing",
      "environment": "prod",
      "surfaces": {
        "keiro": "/inspection/prod/billing/keiro",
        "kiroku": "/inspection/prod/billing/kiroku"
      }
    }
  ]
}
```

Retain the existing Bun, React, Zod, TanStack Query, TanStack Router, Vitest, Playwright, and
Caddy dependencies. No dependency pin changes are planned. Locate their source with Mori
when an API needs investigation. Cross-repository references in comments, docs, plans, or
commit messages must use canonical Mori URIs, with a project URI plus project-relative path
and an artifact-level-URI-pending note where necessary. Do not use a bare sibling-repository
path. Keep implementation commits on the current branch unless the user requests otherwise,
use Conventional Commits, and include both trailers:

```text
ExecPlan: docs/plans/20-connect-one-console-to-multiple-application-deployments.md
Intention: intention_01m5v0syjvemm980170eeqdykq
```
