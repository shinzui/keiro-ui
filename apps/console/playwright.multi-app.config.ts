import { mkdtempSync, copyFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig, devices } from "@playwright/test"
if (!process.env.MULTI_APP_CONFIG_DIR) {
  process.env.MULTI_APP_CONFIG_DIR = mkdtempSync(join(tmpdir(), "keiro-ui-multi-app-"))
  process.env.MULTI_APP_OWNS_CONFIG = "1"
}
copyFileSync(
  fileURLToPath(new URL("../../dev/multi-app/console-config.json", import.meta.url)),
  join(process.env.MULTI_APP_CONFIG_DIR, "console-config.json"),
)
const port = process.env.MULTI_APP_PORT ?? "18080"
export default defineConfig({
  globalTeardown: "./e2e/multi-app/teardown.ts",
  testDir: "e2e/multi-app",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}/console/`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "cd ../.. && bun dev/multi-app/inspection-fixtures.ts",
      url: `http://127.0.0.1:${process.env.ORDERS_PORT ?? 19193}/__ready`,
      reuseExistingServer: false,
    },
    {
      command:
        "VITE_BASE_PATH=/console/ bunx vite build --outDir dist-multi-app --emptyOutDir && cd ../.. && CONSOLE_DIST=apps/console/dist-multi-app caddy run --config dev/multi-app/Caddyfile --adapter caddyfile",
      url: `http://127.0.0.1:${port}/console/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
