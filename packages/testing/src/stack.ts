import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The local stack's ports (dev/README.md), read the way `just stack-up` reads them: a value in
 * the environment wins, then `dev/.env`, then the default below. Move a port by setting it in
 * `dev/.env`; every consumer (the Vite proxy, the live suites, the smoke scripts, the
 * production smoke's Caddy) follows. Node only: it reads the file synchronously.
 */
export const stackPortDefaults = {
  shibuya: { env: "STACK_SHIBUYA_PORT", port: 9090 },
  kiroku: { env: "STACK_KIROKU_PORT", port: 9091 },
  pgmq: { env: "STACK_PGMQ_PORT", port: 9095 },
  keiro: { env: "STACK_KEIRO_PORT", port: 9093 },
  /** The mori profile's daemon (`just stack-up mori`). */
  moriMetrics: { env: "STACK_MORI_METRICS_PORT", port: 9191 },
} as const

export type StackService = keyof typeof stackPortDefaults

// A path, not a URL object: under a jsdom test environment the global URL is not Node's, and
// readFileSync rejects it.
const envFile = join(dirname(fileURLToPath(import.meta.url)), "../../../dev/.env")

/** `dev/.env` as key/value pairs; empty when the file is missing (a checkout without a stack). */
export function readStackEnv(): Record<string, string> {
  let text: string
  try {
    text = readFileSync(envFile, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw error
  }
  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) env[match[1]!] = match[2]!.replace(/^"(.*)"$/, "$1")
  }
  return env
}

/** One service's port: the environment, then `dev/.env`, then the default. */
export function stackPort(service: StackService, file = readStackEnv()): number {
  const { env, port } = stackPortDefaults[service]
  const raw = process.env[env] || file[env]
  if (raw === undefined || raw === "") return port
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0 || value > 65535)
    throw new Error(`${env}=${raw} is not a TCP port (dev/.env)`)
  return value
}

/** Every service's port, reading `dev/.env` once. */
export function stackPorts(): Record<StackService, number> {
  const file = readStackEnv()
  return Object.fromEntries(
    Object.keys(stackPortDefaults).map((service) => [
      service,
      stackPort(service as StackService, file),
    ]),
  ) as Record<StackService, number>
}

/** `http://127.0.0.1:<port>` for one service. */
export function stackOrigin(service: StackService): string {
  return `http://127.0.0.1:${stackPort(service)}`
}
