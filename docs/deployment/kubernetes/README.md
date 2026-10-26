# Kubernetes console deployment

This recipe serves one static `/console/` bundle and explicit inspection routes behind your
existing authenticated HTTPS gateway. It installs no identity provider, application workloads,
Gateway API controller, or cluster. The browser uses public paths; only Caddy resolves
`<service>.<namespace>.svc` addresses. Read [the deployment guide](../../user/deployment.md)
in a checkout for the gateway policy contract.

```text
browser -> authenticated TLS gateway -> keiro-console ClusterIP:8080
                                      -> Caddy -> application ClusterIP Services
```

The base is an example requiring a site overlay. Its deliberately non-pullable
`registry.invalid` image and all-zero digest are a sentinel, not a published console image.
Build and publish your console image through your release pipeline, then use its registry
manifest digest. Never deploy the sentinel or a mutable tag. The base runtime is the official
Caddy `2.11.7-alpine`, pinned by registry digest in the Dockerfile. On 2026-10-26 it was verified
against [the upstream release](https://github.com/caddyserver/caddy/releases/tag/v2.11.7) and
[the official image registry](https://hub.docker.com/_/caddy). It removes the upstream binary's
`cap_net_bind_service` file capability: port 8080 needs none, and the inherited executable
otherwise fails under `capabilities.drop: [ALL]`.

Build from the checkout root:

```sh
VITE_BASE_PATH=/console/ bun run build
bun scripts/check-kubernetes-deployment.ts
sh scripts/smoke-kubernetes-container.sh
docker build -f docs/deployment/kubernetes/Dockerfile -t keiro-console:review .
```

Bun, Caddy, kubectl (including Kustomize), Docker and curl must be available. A Docker-compatible
runtime can be selected with `CONTAINER_RUNTIME`; it must support the Docker CLI flags used
by the smoke script. Start your local runtime first, for example `colima start`. The smoke
script creates temporary files under the checkout's ignored `.dev/` directory, which is also
shared by Colima, and deletes only its own containers, image tag and temporary directory.
It fails on unavailable tooling. It verifies non-root operation with a read-only root,
capability drop, asset and deep-link serving, catalog headers, local probes, refusal to start
without the catalog, and graceful SIGTERM shutdown. It does not prove gateway or cluster policy.

From an extracted `keiro-ui-console-<version>` release archive, the same Dockerfile works with
these build-context overrides (no Bun installation or rebuild is needed):

```sh
docker build -f deployment/kubernetes/Dockerfile \
  --build-arg CONSOLE_ASSETS=. --build-arg CONSOLE_RECIPE=deployment/kubernetes \
  -t keiro-console:review .
kubectl kustomize deployment/kubernetes/base > rendered.yaml
```

For a local manual container, mount the configuration separately from assets:

```sh
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --user 10001:10001 --tmpfs /data:uid=10001 --tmpfs /config:uid=10001 --tmpfs /tmp:uid=10001 \
  --mount "type=bind,src=$PWD/docs/deployment/kubernetes/base,dst=/etc/keiro-console,readonly" \
  -p 127.0.0.1:18081:8080 keiro-console:review
```

The startup script requires index.html, Caddyfile and a nonempty catalog and validates Caddy
before replacing itself with the server process. `/livez` checks only the server. `/readyz`
checks local assets and both required configuration files. It deliberately does not probe all
applications; an unavailable app must not evict the console. Missing catalog requests return
503, never the legacy optional-catalog 404. Malformed catalog JSON yields the browser's
configuration error. Validate JSON with the shared schema and the rendering checker before
release. In the checkout, `bun scripts/check-kubernetes-deployment.ts <overlay-directory> --release`
renders the supplied overlay and validates that rendered catalog and Caddyfile.

Create your site overlay outside this example base. Set its namespace and image digest,
replace `Caddyfile` and `console-config.json` together through `configMapGenerator` with
`behavior: replace`, and retain hashing and `immutable: true`. Reference the base under
`resources`, and set `images` with `name: registry.invalid/keiro-console`, your `newName`, and
its published `digest: sha256:...`. Replace gateway namespace/pod selectors, DNS selectors,
application selectors and upstream ports in the NetworkPolicy. CPU/memory requests of
100m/64Mi and limits of 1 CPU/256Mi are starting values to tune with observed workloads.
Caddy runtime logging filters request headers and URI; request access logs are disabled. The dedicated ServiceAccount has no token or API permissions. Configuration is mandatory,
mounted as a directory read-only, and a changed content hash updates the Pod template.
Two replicas roll with zero unavailable and one surge Pod. Writable data/config/tmp volumes
are bounded temporary storage. Neither the admin listener nor automatic TLS is enabled.

The public gateway must forward `/console/` and `/inspection/` to the console Service without
rewriting those paths. Caddy alone strips inspection prefixes. Expose neither `/livez`,
`/readyz` nor admin ports publicly. An existing Gateway API HTTPRoute can supply these two
PathPrefix rules if your cluster already has the CRDs and a controller; this recipe assumes
no controller-specific authentication extension. Configure that gateway's policy separately.

Protect HTTP requests and WebSocket handshakes with authentication and per-app authorization.
Return 401/403 for API failures rather than login redirects. For cookie authentication, enforce
the gateway's CSRF protection on mutation requests and Origin validation on socket handshakes.
Strip untrusted identity and forwarding headers at the gateway; trust only that gateway.
Caddy preserves the browser Origin: configure each upstream's allow-list for the **public
HTTPS console origin**, including Shibuya's same-origin control POST policy. Do not replace
Origin with Service DNS or a base path. Disable shared caching for inspection data, errors
and catalog; only hashed assets are immutable. Do not replay mutation POSTs on errors.

The example NetworkPolicy allows console ingress only from the selected gateway pods and
egress only to DNS and selected application pods/ports. Your CNI must enforce policies. These
are network restrictions, not user authorization or path filters; policies are additive, and
an existing allow-all policy can reopen access. Application namespaces need their own ingress
policies allowing the console and required application peers and denying untrusted pods.
Audit other ingress routes and direct Service exposure for gateway bypass. No example can
choose those selectors safely for your cluster.

`worker-services.example.yaml` belongs to the application's namespace. Each Service selects
exactly one existing StatefulSet pod through `statefulset.kubernetes.io/pod-name`. Verify
EndpointSlices show zero or one ready endpoint. Zero means unavailable. A shared headless
Service, session affinity or a Service selecting several workers cannot guarantee identity.
Do not convert application Deployments just for this console; omit Shibuya endpoints when
individual workers cannot be addressed. A stable logical replica may restart. The UI discards
pending confirmation on observed feed loss or control/read failure; an unobserved replacement
cannot be detected without an upstream incarnation precondition. Database surfaces may select
equivalent replicas only when database, capabilities, origin policy and mutation gates agree.

Before any cluster write, explicitly select a test cluster and reviewed site overlay:

```sh
: "${KEIRO_KUBE_CONTEXT:?Set the intended test-cluster context}"
: "${KEIRO_KUBE_NAMESPACE:?Set the console namespace}"
: "${KEIRO_KUBE_OVERLAY:?Set the configured site overlay directory}"
kubectl --context "$KEIRO_KUBE_CONTEXT" version
kubectl --context "$KEIRO_KUBE_CONTEXT" apply --dry-run=server -k "$KEIRO_KUBE_OVERLAY"
kubectl --context "$KEIRO_KUBE_CONTEXT" diff -k "$KEIRO_KUBE_OVERLAY"
```

A diff exit status of 1 means changes to review, 0 means none; other failures need resolution.
Record cluster/controller versions, image manifest digest, generated ConfigMap name and asset
hashes. A server dry-run proves API/admission acceptance only. After deployment is authorized:

```sh
kubectl --context "$KEIRO_KUBE_CONTEXT" apply -k "$KEIRO_KUBE_OVERLAY"
kubectl --context "$KEIRO_KUBE_CONTEXT" -n "$KEIRO_KUBE_NAMESPACE" \
  rollout status deployment/keiro-console --timeout=180s
kubectl --context "$KEIRO_KUBE_CONTEXT" -n "$KEIRO_KUBE_NAMESPACE" \
  get pods,service,configmaps
```

Verify two ready replicas, then repeat the local multi-app suite's HTTP reads, real WebSocket
exchange/reconnect and safe fixture preview/execute through the public TLS URL. Inspect route
journals and statuses without collecting credentials, cookies, tokens, query values or bodies.
Unauthorized identities must fail on HTTP and WebSocket paths; disallowed origins must fail
control and handshakes. An untrusted test pod must fail direct inspection-Service access.
Unknown paths must return API errors, never SPA HTML. Test an unreachable app without losing
the console or other apps. Make a selected worker unavailable: no request may reach a different
worker. Restore its logical identity and refresh. Record observations, not just rendered YAML.

For configuration-only additions, first deploy new routes with the old catalog; wait for all
replicas to finish. Then publish the catalog referencing the routes. Requests can reach mixed
pod generations during a rollout. For removal, withdraw catalog entries first, retain routes
for the documented compatibility window, then return an explicit error at retired paths
forever. Open tabs can retain old catalogs indefinitely. Never reuse a target ID or public
inspection prefix for another app or environment. Config changes require a browser reload.

Prove the two-stage rollout and its rollback while keeping the image and asset hashes fixed.
Keep previous immutable ConfigMaps and ReplicaSets until rollback expires; never prune a
ConfigMap referenced by a retained ReplicaSet. Restore the previous site overlay's image and
configuration references and apply it to roll back. `kubectl rollout undo` alone cannot restore
separate gateway, Service or NetworkPolicy changes. Reverse additions by withdrawing the
catalog entry before its route. Verify old target-bearing links fail explicitly if retired.

Finally terminate a console pod during an open feed and a safe outstanding fixture mutation.
Caddy gets a five-second grace period within the Pod's 30 seconds. Socket reconnection must
re-read via HTTP; no layer may replay the POST. A lost mutation response is an unknown outcome
on its original app, never a retry or rollback caused by navigation. Verify idle timeouts and
shutdown against your real gateway limits. These cluster checks are release prerequisites;
local rendering and container tests do not certify a cluster rollout.

References: [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/),
[Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/),
[NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/),
[StatefulSet pod identity](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#pod-name-label),
[Caddy shutdown](https://caddyserver.com/docs/caddyfile/options#grace-period).
