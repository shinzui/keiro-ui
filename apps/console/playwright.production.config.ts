import { defineConfig, devices } from "@playwright/test"

// The production smoke: the console built for /console/ and served by dev/caddy/Caddyfile
// (recipe A of docs/deployment.md). Tier 1 needs no backend; tier 2 runs when the local stack
// answers through the proxy. CONSOLE_PORT overrides the port (8080 by default).
const port = process.env.CONSOLE_PORT ?? "8080"
const baseURL = `http://127.0.0.1:${port}/console/`

export default defineConfig({
  testDir: "e2e/production",
  timeout: 30_000,
  workers: 2,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL },
  webServer: {
    // Its own build directory: the `smoke` project's root build in dist never replaces it.
    command: `VITE_BASE_PATH=/console/ bunx vite build --outDir dist-production --emptyOutDir && cd ../.. && CONSOLE_PORT=${port} CONSOLE_DIST=apps/console/dist-production caddy run --config dev/caddy/Caddyfile --adapter caddyfile`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
