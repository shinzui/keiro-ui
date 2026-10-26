import { defineConfig, devices } from "@playwright/test"

// The production smoke: the console built for /console/ and served by dev/caddy/Caddyfile
// (recipe A of docs/user/deployment.md). Tier 1 needs no backend; tier 2 runs when the local stack
// answers through the proxy. CONSOLE_PORT overrides the port (8080 by default).
const port = process.env.CONSOLE_PORT ?? "8080"
const externalURL = process.env.CONSOLE_EXTERNAL_URL
const target = new URL(externalURL ?? `http://127.0.0.1:${port}/console/`)
if (target.search || target.hash) throw new Error("CONSOLE_EXTERNAL_URL must be a deployment URL")
if (!target.pathname.endsWith("/")) target.pathname += "/"
if (externalURL && !process.env.CONSOLE_EXPECTED_REVISION)
  throw new Error("External production smoke requires CONSOLE_EXPECTED_REVISION")
const baseURL = target.href

export default defineConfig({
  testDir: "e2e/production",
  timeout: 30_000,
  workers: 2,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL },
  webServer: externalURL
    ? undefined
    : {
        // Its own build directory: the `smoke` project's root build in dist never replaces it.
        command: `VITE_BASE_PATH=/console/ bunx vite build --outDir dist-production --emptyOutDir && cd ../.. && CONSOLE_PORT=${port} CONSOLE_DIST=apps/console/dist-production caddy run --config dev/caddy/Caddyfile --adapter caddyfile`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
