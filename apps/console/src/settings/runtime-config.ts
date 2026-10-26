import {
  normalizeEndpoint,
  runtimeConsoleConfigSchema,
  type RuntimeConsoleConfig,
} from "./connection-targets"

export async function fetchRuntimeConfig(
  base: string,
  origin: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<RuntimeConsoleConfig | undefined> {
  const url = new URL(`${base.replace(/\/?$/, "/")}console-config.json`, origin)
  if (url.origin !== new URL(origin).origin)
    throw new Error("Configuration must use the console origin")
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.redirected) throw new Error("Configuration redirects are not allowed")
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`Configuration request failed: HTTP ${response.status}`)
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""))
    throw new Error("Configuration must be JSON; check the static host's SPA fallback")
  const config = runtimeConsoleConfigSchema.parse(await response.json())
  for (const target of config.targets) {
    for (const value of Object.values(target.surfaces)) if (value) normalizeEndpoint(value, origin)
    for (const worker of target.workers ?? []) normalizeEndpoint(worker.shibuyaBaseUrl, origin)
  }
  return config
}
