import { defineConfig, devices } from "@playwright/test"

// The live-stack integration gate (MasterPlan): runs e2e/live.spec.ts against a running
// `bun run dev` on localhost:5173 (localhost, so the Origin matches keiro-ops-http's
// allow-list) with the EP-9 stack up. It never starts a server: start `bun run dev` first.
export default defineConfig({
  testDir: "e2e",
  testMatch: "live.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5173" },
})
