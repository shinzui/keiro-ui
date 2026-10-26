import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

import {
  normalizeEndpoint,
  runtimeConsoleConfigSchema,
} from "../apps/console/src/settings/connection-targets"

const base =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "docs/deployment/kubernetes/base"
const rendered = execFileSync("kubectl", ["kustomize", base], { encoding: "utf8" })
const resources = rendered.split(/^---\s*$/m).map((yaml) => Bun.YAML.parse(yaml) as any)
const get = (kind: string) => {
  const matching = resources.filter((r) => r.kind === kind)
  assert.equal(matching.length, 1, `exactly one ${kind}`)
  return matching[0]
}
const config = get("ConfigMap")
assert.match(config.metadata.name, /^keiro-console-config-[a-z0-9]{8,}$/)
assert.equal(config.immutable, true, "configuration must be immutable")
const catalog = runtimeConsoleConfigSchema.parse(JSON.parse(config.data["console-config.json"]))
for (const target of catalog.targets) {
  for (const url of [
    ...Object.values(target.surfaces),
    ...(target.workers ?? []).map((w) => w.shibuyaBaseUrl),
  ]) {
    assert.ok(
      url?.startsWith("/") && !url.startsWith("//"),
      "browser URLs must remain on public origin",
    )
    normalizeEndpoint(url!, "https://ops.example")
  }
}
const deployment = get("Deployment")
assert.equal(deployment.spec.replicas, 2)
assert.equal(deployment.spec.strategy.rollingUpdate.maxUnavailable, 0)
assert.equal(deployment.spec.strategy.rollingUpdate.maxSurge, 1)
const pod = deployment.spec.template.spec
assert.equal(pod.automountServiceAccountToken, false)
assert.equal(pod.serviceAccountName, get("ServiceAccount").metadata.name)
assert.equal(get("ServiceAccount").automountServiceAccountToken, false)
assert.equal(pod.securityContext.runAsNonRoot, true)
assert.ok(pod.securityContext.runAsUser > 0)
assert.equal(pod.securityContext.seccompProfile.type, "RuntimeDefault")
assert.ok(pod.terminationGracePeriodSeconds >= 10 && pod.terminationGracePeriodSeconds <= 120)
assert.equal(pod.containers.length, 1)
const container = pod.containers[0]
assert.match(container.image, /@sha256:[a-f0-9]{64}$/)
if (process.argv.includes("--release"))
  assert.ok(
    !container.image.includes("registry.invalid") && !/@sha256:0{64}$/.test(container.image),
    "Release overlay must supply its published console image digest",
  )
assert.equal(container.securityContext.readOnlyRootFilesystem, true)
assert.equal(container.securityContext.allowPrivilegeEscalation, false)
assert.deepEqual(container.securityContext.capabilities.drop, ["ALL"])
for (const field of ["requests", "limits"])
  for (const resource of ["cpu", "memory"])
    assert.ok(container.resources[field][resource], `${field}.${resource} required`)
assert.equal(container.livenessProbe.httpGet.path, "/livez")
assert.equal(container.readinessProbe.httpGet.path, "/readyz")
const volume = pod.volumes.find((v: any) => v.configMap)
assert.equal(
  volume.configMap.name,
  config.metadata.name,
  "Pod template must reference hashed configuration",
)
assert.equal(volume.configMap.optional, false)
const mount = container.volumeMounts.find((m: any) => m.name === volume.name)
assert.equal(mount.mountPath, "/etc/keiro-console")
assert.equal(mount.readOnly, true)
assert.equal(mount.subPath, undefined, "mount the configuration directory")
for (const writable of ["/data", "/config", "/tmp"]) {
  const m = container.volumeMounts.find((m: any) => m.mountPath === writable)
  assert.ok(
    m && pod.volumes.some((v: any) => v.name === m.name && v.emptyDir?.sizeLimit),
    `bounded writable ${writable}`,
  )
}
const service = get("Service")
assert.equal(service.spec.type, "ClusterIP")
assert.equal(service.spec.externalIPs, undefined)
assert.ok(service.spec.ports.every((p: any) => p.nodePort === undefined))
assert.deepEqual(service.spec.selector, deployment.spec.selector.matchLabels)
assert.deepEqual(deployment.spec.template.metadata.labels, service.spec.selector)
assert.ok(
  !resources.some((r) =>
    ["Role", "ClusterRole", "RoleBinding", "ClusterRoleBinding"].includes(r.kind),
  ),
)
const policy = get("NetworkPolicy")
assert.deepEqual(policy.spec.podSelector.matchLabels, service.spec.selector)
assert.deepEqual(policy.spec.policyTypes, ["Ingress", "Egress"])
assert.ok(policy.spec.ingress.length && policy.spec.egress.length)
const caddy = config.data.Caddyfile
for (const required of [
  "admin off",
  "auto_https off",
  "grace_period",
  "Required catalog missing",
  "503",
  "/livez",
  "/readyz",
  "no-store",
  "lb_retries 0",
  "request>headers delete",
  "request>uri delete",
  ".applications.svc:",
])
  assert.ok(caddy.includes(required), `Caddy: ${required}`)
// Validate the rendered Caddyfile, including site overlays, rather than a stale source copy.
const tmp = await import("node:fs/promises")
const directory = await tmp.mkdtemp("/tmp/keiro-console-caddy-")
try {
  const path = `${directory}/Caddyfile`
  await tmp.writeFile(path, caddy)
  execFileSync("caddy", ["validate", "--config", path, "--adapter", "caddyfile"], { stdio: "pipe" })
} finally {
  await tmp.rm(directory, { recursive: true })
}
assert.match(
  readFileSync("docs/deployment/kubernetes/Dockerfile", "utf8"),
  /FROM caddy:[^\s]+@sha256:[a-f0-9]{64}/,
)
console.log(
  `Kubernetes checks passed: ${resources.length} rendered objects; ${catalog.targets.length} targets; ${config.metadata.name}. Site image/gateway/network settings still require an overlay.`,
)
