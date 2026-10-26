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
    - model: "gpt-6-astra"
      harness: "codex-cli"
      at: 2026-10-26T16:35:34Z
      mode: "update"
      note: "Add Kubernetes delivery and rollout acceptance; tighten worker identity, gateway policy, legacy migration and connection-session guarantees."
    - model: "gpt-6.1-sol"
      harness: "codex-cli"
      at: 2026-10-26T18:23:38Z
      mode: "implement"
      note: "Implement runtime targets, isolated sessions, deployment fixtures and Kubernetes delivery."
  reviews:
    - model: "gpt-6-astra"
      harness: "codex-cli"
      at: 2026-10-26T16:33:35Z
      verdict: "changes-requested"
      note: "Review found missing Kubernetes topology, rollout and cluster validation; worker incarnation guarantees and legacy ID validation also need correction."
    - model: "gpt-6-astra"
      harness: "codex-cli"
      at: 2026-10-26T16:40:06Z
      verdict: "approved"
      note: "Post-update review: initial findings addressed; six verifiable milestones, Kubernetes rollout and release prerequisites, compatible IDs, and ADR-9 aligned. Cluster execution remains future work."
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
and owns its runtime resources. The deployment gateway enforces authentication and
authorization; the proxy chain forwards HTTP and WebSocket traffic without combining or
rewriting response bodies.

The production destination is a Kubernetes cluster. Deploy the static bundle and explicit
Caddy routes behind the cluster's existing authenticated HTTPS entry point. Browser URLs
stay on the public origin; only Caddy uses Kubernetes Service DNS names. This plan delivers
a container recipe, Kubernetes manifests, and a cluster verification runbook. It does not
install a cluster, select an identity provider, or migrate application workloads.

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


- [x] Milestone 1: Runtime catalog validation, strict local migration and normalized optional URLs implemented (2026-10-26); schema/loading regressions and exact-path dev/preview boot checks pass.
- [x] Milestone 2: URL-authoritative app/worker selection, selectors, history and native links implemented (2026-10-26); route and real-proxy tab/reload tests pass.
- [x] Milestone 3: Disposable connection caches, read cancellation, feed guards and optional-page/pane/sheet gates implemented (2026-10-26); delayed read/frame, endpoint-edit and repeated-switch regressions pass.
- [x] Milestone 4: Session-bound confirmations, attributed late completion, scoped recents/pins and command lifetimes implemented (2026-10-26); focused settings/action/history checks pass (69 tests).
- [x] Milestone 5: One bundle operates fixture apps through Caddy (2026-10-26); nine multi-app cases pass without skips, including HTTP/WebSocket/action routing, worker loss, identical IDs and a catalog-only third target. Examples and operating docs are packaged; the extracted archive builds and renders.
- [x] Milestone 6: Hardened Kubernetes recipe verified locally (2026-10-26); shared-schema and five-object manifest checks, negative invariant probes, container smoke, archive-context image build and extracted Kustomize render all pass. Cluster release checks remain explicitly separate.

All six repository milestones are complete. Final evidence: `bun run check` passes;
`bun run test` passes 617 tests (12 existing skips); `bun run test:e2e` passes 56;
`CONSOLE_PORT=18082 bun run test:e2e:production` passes six with four documented
external-stack skips; and `bun run test:e2e:multi-app` passes nine with no skips.
Caddy validation, Kubernetes rendering/invariant checks, the hardened local container smoke,
release packaging and an image built from the extracted archive all pass. The existing
IPv4 port 8080 was occupied; FRIC-6 records use of the supported override. No external
cluster or registry was changed, and no cluster rollout is claimed.

This is a standalone follow-on to the
existing console, not a new child of the completed build-out in
`docs/masterplans/2-build-the-keiro-runtime-console.md`.


## Surprises & Discoveries

Implementation (2026-10-26): The existing Nix static image and container proxy example also
needed the exact optional-catalog handler; otherwise their SPA fallback would turn the new
boot request into invalid HTML. Updated those existing hosts alongside the planned Vite and
single-application proxy paths. No dependency or upstream protocol changes were needed.

Implementation (2026-10-26): The official Caddy image carries a privileged executable file
capability. Dropping all container capabilities made the binary fail with “Operation not
permitted”; remove its file capability during the image build for unprivileged port 8080.
FRIC-5 in docs/friction-log/ records the occurrence; ADR-9 records the durable constraint.


Review (2026-10-26): `connectionProfileSchema` in
`apps/console/src/settings/connection-profiles.tsx` accepts any nonempty profile ID. Applying
the new managed-ID restriction to migration would reject previously valid imported profiles.
Preserve opaque local IDs and encode them as URL search values; restrict managed and newly
generated IDs without retroactively narrowing legacy storage.

Review (2026-10-26): The repository currently packages static assets and standalone proxy
examples, with no Kubernetes manifests or container recipe. The local production test cannot
prove a cluster's gateway, network policy, service selection, or configuration rollover.
Milestone 6 separates repository evidence from cluster release verification.


## Decision Log

Decision (2026-10-26): Keep the shipped Kubernetes base deliberately non-pullable using a
sentinel registry/image digest. A site overlay must supply the operator's published console
manifest digest; this repository task builds and tests locally and does not publish to an
external registry. The upstream Caddy base itself is pinned to the verified 2.11.7-alpine
registry digest. Local acceptance does not authorize or certify a cluster rollout.


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

Decision (2026-10-26): Use a Kubernetes Deployment for the stateless console/Caddy workload,
a ClusterIP Service for its internal address, and the existing cluster gateway for public TLS
and access policy. Keep explicit upstream routes and no Kubernetes API access in the console.
Gateway API integration is an optional overlay requiring an installed controller; do not
assume a particular controller, authentication extension, or cluster DNS suffix.

Decision (2026-10-26): Deliver catalog and Caddy configuration in an immutable, content-named
ConfigMap, a Kubernetes object holding non-secret files. Roll out configuration changes as
new pods using the same console image. Stage route additions before catalog publication,
because requests during a rolling update can reach different pod generations. Never reuse a
target ID or public inspection prefix for a different application/environment.

Decision (2026-10-26): A worker entry identifies one logical worker replica, not all workers
and not an immortal process. Route it to exactly that replica or report unavailable. An
existing StatefulSet can supply a stable replica name; ordinary load balancing, including a
headless Service selecting several workers, cannot. A restart may replace the process behind
the same identity; guaranteeing process-incarnation-bound commands requires upstream support
and is outside this plan.


## Outcomes & Retrospective


Completed 2026-10-26. One static bundle now selects managed application/environment targets
and individual logical workers through shareable URLs, migrates validated local profiles,
retains optional surfaces honestly, and replaces all connection state when identity/settings
change. Submitted actions retain their original endpoint and tab-wide audit attribution.
ADR-15 records these boundaries; ADR-9 records the delivered proxy/Kubernetes recipe and
unprivileged Caddy capability constraint. No upstream protocol or dependency pin changes
were needed for the console libraries.

The deterministic production suite proves two upstream applications with identical entity
IDs, real feed exchanges, preview/execute, late responses, worker control/availability and
explicit route denial. Its temporary catalog adds a third target with all 105 asset hashes
unchanged. The release archive includes every proxy/catalog/Kubernetes file, renders after
extraction and builds its image with the documented archive-context arguments. It contains
neither an enabled root catalog nor the fixture runner. The pinned Caddy runtime is 2.11.7;
the operator must publish their own console image and supply its manifest digest in a site
overlay. The checker rejects the example sentinel under `--release`.

Validation commands and totals are recorded in Progress. Negative checks reject a writable
container root, an invalid catalog version and a release overlay retaining the sentinel image.
`nginx -t` was not run because nginx is not installed; its variable proxy URI and map semantics
were checked against official documentation. The existing Nix Caddy generator's optional
catalog exception was syntax-parsed, while its new handler shape is exercised by the
Caddy/browser regressions. The Kubernetes runbook separately requires public TLS/gateway
policy tests, direct-access denial, worker identity checks, two-replica staged rollout,
rollback and termination behavior on an explicitly selected test cluster. These are release
prerequisites, not claims established by local rendering or containers.

FRIC-4 in docs/friction-log/ is resolved: smoke mounts use a checkout-local disposable directory
shared by Colima. FRIC-5 is resolved: remove the Caddy executable's inherited privileged file
capability before dropping all container capabilities. FRIC-6 is accepted: use the existing
configurable production-smoke port when another workload occupies 8080. No friction entries
for this plan remain logged.


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
console's asset base at build time; its plan-20 amendment permits configured browser-visible
surface prefixes and a Kubernetes routing deployment while preserving the legacy default.
These extensions are planned behavior until this plan is implemented.
[ADR-12](../adr/0012-poll-first-live-queries.md) keeps polling authoritative and feed frames as an accelerator within the same cache.
[ADR-13](../adr/0013-honest-gates.md) requires truthful capability and mutation gating, previews,
and server refusal messages. These rules remain in effect for every target.

Keiro composition is routing within an application, described by
`mori://shinzui/keiro/okf/adrs/concepts/ADR-57`; it does not provide discovery or aggregation
of separate applications. The source at `mori://shinzui/keiro`, project-relative path
`keiro-ops-http/src/Keiro/Ops/Http/Compose.hs` (artifact-level URI pending), accepts already
allocated applications under stable surface prefixes. No change to that composer is needed.

Kubernetes terminology used below: a Pod runs containers; a Deployment replaces interchangeable
Pods during updates; a Service gives selected Pods a stable internal address. A StatefulSet
assigns stable replica names. A NetworkPolicy restricts network traffic, not user permissions.
Kustomize renders a base set of manifests with deployment-specific overlays. No relevant
Kubernetes-specific ADR existed before this review; ADR-9 now records the selected boundary.

Official guidance checked for this revision includes
[ConfigMap update semantics](https://kubernetes.io/docs/concepts/configuration/configmap/),
[Kustomize generated configuration names](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/),
[individual StatefulSet pod Services](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#pod-name-label),
[Gateway API prerequisites](https://kubernetes.io/docs/concepts/services-networking/gateway/),
[NetworkPolicy enforcement](https://kubernetes.io/docs/concepts/services-networking/network-policies/),
and [probe behavior](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
These establish infrastructure semantics; the architecture and staged rollout below are this
plan's choices. Verify the actual cluster's supported APIs and controller before deployment.


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

Validate raw path spelling before URL parsing can normalize traversal away. On an HTTPS
console, reject absolute HTTP inspection endpoints with a visible mixed-content explanation;
HTTP remains usable on the HTTP development console. Keep runtime configuration requests on
the console origin and reject redirects, so an authentication redirect or unrelated JSON
document cannot become a connection catalog.

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

Preserve all previously valid nonempty local IDs, including spaces and Unicode, through the
v1 adapter and v2 roundtrip. Never derive proxy paths from them. Cover these cases in migration
tests, along with managed/local collisions and explicit links containing encoded local IDs.

Use the old profile name as the migrated label and `local` as the environment when the old
record has no such metadata. Use its trimmed ID as the app display identifier, falling back
to the profile name for a whitespace-only legacy ID; preserve the actual selection ID exactly. The built-in target keeps ID
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

When a target declares workers, a worker selector displays their labels and logical replica identity.
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
target ID, selected worker ID, normalized effective endpoints, process-manager names, and
dead-letter suffix. Changing connection-affecting settings under the same ID creates a new
session; previews and derived suggestions must not retain the old configuration. Cosmetic
label changes need not recreate connections. Keep the catalog, selectors, theme, and tab-wide audit outside
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
them. Reset typed confirmations and preview handles on target, worker, or connection-setting change.
Discard pending worker confirmations on observed connection loss; this does not guarantee
detection of an unobserved process restart behind a stable worker address.
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

For cookie-authenticated deployments, require the existing gateway's cross-site request
forgery protection for mutation requests and explicit Origin validation for WebSocket
handshakes. Browser same-origin routing does not supply either protection by itself. Reject
unauthorized API traffic with 401/403 rather than redirecting it to a login document; the
console's page entry may use the existing login flow. Strip untrusted identity/forwarding
headers and trust only the configured gateway. Disable shared caching for inspection
responses, errors, and the catalog; revalidate HTML and cache only hashed assets immutably.
Do not replay mutation POSTs in proxy retry policies. Document socket idle limits and graceful
shutdown; reconnect must re-read via HTTP under ADR-12. Access logs identify target routes and
status without logging credentials, mutation bodies, or sensitive query values.

Add `dev/multi-app/inspection-fixtures.ts` using Bun's built-in HTTP/WebSocket server for
deterministic, distinct upstream fixtures; reuse recorded payloads from `packages/testing`
and change only identifiers and labels needed to prove separation. Give the two applications
separate ports and request journals, delayed-response controls, different feed frames, and
mutation preview/execute recordings. Expose two independently controllable worker fixtures
with distinct identities, journals, and availability so worker-selection checks prove routing. Fixture mutation handlers must not operate real
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

Confirm ADR-9's plan-20 amendment against the delivered deployment and create a durable ADR
for target identity and session isolation, using the repository's profiled ADR workflow.
Preserve ADR-5's boundary.
Inspect `mori.dhall` with `mori show --full`, read `docs/adr/profile.dhall`, obtain a stable
handle with `okf id next`, and maintain the bundle log when timestamps change. Run strict
profile enforcement. Finish by recording acceptance evidence and promoting any additional
durable discoveries into the relevant ADRs.


### Milestone 6 — Kubernetes delivery and release verification


Create `docs/deployment/kubernetes/README.md` and
`docs/deployment/kubernetes/Dockerfile`. Create the base manifests at
`docs/deployment/kubernetes/base/kustomization.yaml`,
`docs/deployment/kubernetes/base/deployment.yaml`,
`docs/deployment/kubernetes/base/service.yaml`,
`docs/deployment/kubernetes/base/service-account.yaml`, and
`docs/deployment/kubernetes/base/network-policy.yaml`, with runtime files at
`docs/deployment/kubernetes/base/Caddyfile` and
`docs/deployment/kubernetes/base/console-config.json`. These are new deliverables.
Use the Milestone 5 route shapes and catalog schema. The Dockerfile copies an already built
`apps/console/dist/` bundle into a Caddy runtime image; configuration is mounted at runtime,
so adding applications changes neither JavaScript nor the image. Supply build/run commands,
choose a released upstream image verified against its registry and release tags, and pin the
production base and deployment images by digest. No version is prescribed by this review.
Package the recipe and manifests in the release archive with relative references that also
work from the extracted archive; document both checkout and archive build contexts.

The request path is browser → existing authenticated TLS gateway → console ClusterIP Service
→ Caddy → application ClusterIP Service. Route `/console/` and `/inspection/` to the console
Service without rewriting them at the gateway; Caddy alone removes inspection prefixes.
A browser never uses a cluster-internal hostname. Caddy upstreams use explicit
`<service>.<namespace>.svc` names and ports, not Pod IPs or a client-supplied host. Database
surfaces may use a Service selecting equivalent application replicas with the same database,
capabilities, origin policy, and mutation gates. The catalog uses public root-relative URLs.

Add `docs/deployment/kubernetes/worker-services.example.yaml` showing Services in the workers'
namespace selecting one existing StatefulSet pod each through
`statefulset.kubernetes.io/pod-name`. Keep this example outside the console base, because it
belongs to the application's deployment. Select zero or one ready replica; no ready replica
means unavailable, never failover to another worker. Do not use client-IP affinity or a shared
headless-Service hostname as an identity guarantee. Do not convert application Deployments
to StatefulSets for the console. Where individual workers cannot be addressed reliably,
omit their Shibuya endpoints and explain that limitation. A stable logical replica can restart:
refresh after observed feed loss or control failure, discard pending worker confirmation on
observed connection loss, and never claim to detect every process replacement. A server-side
incarnation precondition is required for a stronger guarantee.

Use Kustomize `configMapGenerator` with its content hash suffix enabled and immutable generated
objects. Put catalog and Caddyfile in one generated ConfigMap and mount its directory read-only
at `/etc/keiro-console`, separate from the assets. Changing the content changes the Pod template
reference and triggers a rollout. Do not rely on in-place environment variable or `subPath`
refresh, nor on a mounted file change automatically reloading Caddy. Preserve previous
ConfigMaps for rollback. The mandatory catalog mount must block startup when absent; the
Kubernetes config handler returns 503 on a missing file, never the legacy optional-catalog
404. Validate JSON against the shared schema and run `caddy validate` before deployment.
A malformed served catalog still yields the browser's explicit configuration error.

Run Caddy as a non-root user on port 8080 with a read-only root filesystem, dropped Linux
capabilities, no privilege escalation, and `RuntimeDefault` seccomp (the runtime's system-call
filter). Mount only its required writable directories as temporary volumes, disable its admin
listener and automatic TLS on this internal listener, and log to stdout/stderr. Give the Pod
explicit CPU/memory requests and limits, a dedicated ServiceAccount with
`automountServiceAccountToken: false`, and no Kubernetes API roles. Use two interchangeable
console replicas with a rolling strategy of zero unavailable and one extra Pod; provide
resource values as tunable starting points rather than universal sizing guarantees.

Add local liveness and readiness endpoints outside the SPA fallback. Liveness checks the
server only; readiness checks local assets and required configuration, not all upstreams.
An unavailable application must not remove the whole console from service. Implement the
local checks in the container startup/probe scripts if the static server cannot express them;
no application backend is needed. Verify termination handling and allow a finite grace period
for active requests; sockets can reconnect and mutations with lost responses remain unknown.
Do not have the public gateway expose probe or admin paths.

The base exposes only a ClusterIP Service. Add
`docs/deployment/kubernetes/gateway/httproute.example.yaml` as an optional attachment to an
existing HTTPS Gateway, with placeholders for hostname, parent namespace/name, and listener.
It routes only the two public prefixes. Explain the required installed Gateway API resources,
controller support for WebSockets, and listener permission for cross-namespace attachment.
An existing Ingress can supply the same contract without assuming controller-specific rewrite
annotations. Neither HTTPRoute nor Ingress alone establishes user authorization: before public
exposure, bind the deployment's existing authentication, per-target authorization, mutation
protection, and WebSocket Origin policy, then verify denial through the actual public origin.
Keep example routes unattached by default. TLS/auth secrets stay in infrastructure Secret
management, never ConfigMaps, image layers, or browser profiles.

NetworkPolicy examples restrict console ingress to the actual gateway pods and egress to
cluster DNS and configured application inspection ports, using namespace and pod selectors
together. Document adaptation for the cluster's DNS/networking implementation. Add a separate
application-side example allowing inspection traffic only from console pods; it must preserve
other application traffic and must not be included blindly in the console base. Policies need
a network plugin that enforces them; they cannot distinguish users or HTTP paths. Verify that
direct application access cannot bypass the intended gateway boundary, accounting for any
other ingress routes and broadly permissive existing policies.

Add `scripts/check-kubernetes-deployment.ts` to render the base with `kubectl kustomize`,
validate the catalog using the shared schema, and assert the critical manifest invariants:
mandatory hashed configuration reference, private Service, no API token, probes, resource
bounds, and container security settings. Add `scripts/smoke-kubernetes-container.sh` to build
and start the image locally using Docker or a documented compatible runtime, mount the
example configuration, and check `/console/`, a deep link, catalog content type/no-store,
missing-config failure, probes, and clean shutdown. The scripts must fail on violations and
clean up only their own resources. Reuse Milestone 5 for upstream HTTP/WebSocket/action proof;
do not build a second unrelated fixture protocol.

Repository acceptance requires both scripts to pass and the release archive to contain the
complete recipe. Record unavailable tooling as outstanding acceptance, not a silent skip.
The README must also provide the cluster release procedure described below, including
configuration-only rollout and rollback. Running it requires an explicitly selected test
cluster, deployed application Services, and the existing gateway policy. This plan update
neither assumes cluster credentials nor authorizes changing a production cluster.


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

After Milestone 6, from the repository root with `kubectl` and a container runtime installed,
run the repository checks below. Rendering is local and does not apply resources. The checker
must pass the rendered files to catalog and invariant validation, not merely print YAML.

```bash
kubectl kustomize docs/deployment/kubernetes/base > /tmp/keiro-ui-kubernetes.yaml
bun scripts/check-kubernetes-deployment.ts
VITE_BASE_PATH=/console/ bun run build
sh scripts/smoke-kubernetes-container.sh
```

For an actual deployment, first make a site overlay outside the shipped example base and set
its image digest, namespace, service names, network selectors, catalog, and gateway policy.
The runbook must show these commands with the selected context and overlay; the following
variables are deliberate required inputs, not credentials or assumed production defaults.
A server dry-run checks API/admission acceptance; it does not prove traffic or policy behavior.

```bash
: "${KEIRO_KUBE_CONTEXT:?Set the intended test-cluster context}"
: "${KEIRO_KUBE_NAMESPACE:?Set the console namespace}"
: "${KEIRO_KUBE_OVERLAY:?Set the configured site overlay directory}"
kubectl --context "$KEIRO_KUBE_CONTEXT" apply --dry-run=server -k "$KEIRO_KUBE_OVERLAY"
kubectl --context "$KEIRO_KUBE_CONTEXT" diff -k "$KEIRO_KUBE_OVERLAY"
```

Only in an authorized deployment session, apply that reviewed overlay and wait for readiness:

```bash
kubectl --context "$KEIRO_KUBE_CONTEXT" apply -k "$KEIRO_KUBE_OVERLAY"
kubectl --context "$KEIRO_KUBE_CONTEXT" -n "$KEIRO_KUBE_NAMESPACE" rollout status deployment/keiro-console --timeout=180s
```

Expect all intended replicas ready, then exercise the public HTTPS URL using the cluster
acceptance scenarios below. An empty `kubectl diff` exits 0; expected changes exit 1 and need
inspection, while errors must be resolved. Record cluster/controller versions and the image
and configuration revisions with the evidence. Do not infer cluster readiness from rendering.

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
mocked browser response alone does not satisfy production acceptance. Repository completion
requires the local proxy suite plus Milestone 6 rendering and container checks. It does not
require changing an external cluster and must not be reported as a verified cluster rollout.

Before the real Kubernetes release, repeat HTTP reads, WebSocket exchange/reconnect, and safe
fixture preview/execute through the public TLS gateway. Unauthorized identities must fail on
both HTTP and WebSocket routes; control/handshake requests from disallowed origins must fail; direct
inspection-service access from an untrusted test pod must fail. No cookies, tokens, or body
payloads may appear in collected logs. Validate both the configured public paths and unknown
paths, with no SPA fallback for APIs.

Use two console replicas to verify a configuration-only rollout and its rollback without
changing the console image or asset hashes. An unavailable app must leave the console and
other apps usable. Test a selected worker becoming unavailable, then returning under its
logical identity: no request may be routed to another worker. Test rolling console termination
with an open feed and an outstanding fixture mutation; reconnection re-reads, and no layer
replays the POST. Check HTTP and socket idle behavior against the actual gateway's limits.
These cluster checks are release prerequisites, recorded separately from repository acceptance.


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

For Kubernetes configuration changes, retain the old image and generated ConfigMaps until the
rollback window ends. Use staged rollouts: first add routes to every console replica while
serving the old catalog; wait for rollout completion; then publish a catalog referring to the
new routes. For removal, remove catalog entries first, then retire routes after the documented
compatibility window. Open tabs can retain old catalogs indefinitely, so retired paths must
return an explicit error forever rather than route to another application. Reversing an
addition removes the catalog entry before removing its route. Restore a prior site overlay
and configuration references to roll back; `kubectl rollout undo` alone does not restore
separate gateway, Service, or NetworkPolicy edits. Never prune configuration still referenced
by a retained ReplicaSet. Existing sockets may close during rollout; polling restores reads,
but an uncertain mutation needs inspection of its original target, never automatic retry.


## Interfaces and Dependencies


Define and validate the following wire configuration in
`apps/console/src/settings/connection-targets.ts`. Use existing `Surface` names; endpoints
are base URLs, not origins. Managed target IDs, worker IDs, and newly generated local IDs
match `[A-Za-z0-9][A-Za-z0-9._-]*`. Previously valid local target IDs remain opaque nonempty
strings through import, migration, and v2 storage; do not trim or rename them. Reject duplicate
IDs. Encode IDs as search values with the router, never by concatenating raw URL text.
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
  sessionKey: string // IDs + normalized endpoints + connection-affecting settings
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


Revision (2026-10-26): Reviewed the original plan against the working tree and official
Kubernetes guidance. Added a sixth milestone for Kubernetes delivery, staged configuration
rollouts and cluster release verification; clarified worker replica versus process identity,
gateway access controls, and migration/session invariants. ADR-9 records the deployment
decision. This revision changes the plan and architecture documentation only; no implementation
or cluster deployment has been performed.
