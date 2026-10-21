import { defineConfig, devices } from "@playwright/test"

// Specs live under e2e/<section>/ (screen plans) and e2e/production/ (packaging plan).
// The `smoke` project runs against a production build served by `vite preview`; every
// other project runs against the dev server, whose proxy reaches the local surfaces.
const devURL = "http://localhost:5173"
const previewURL = "http://127.0.0.1:4173"
// Screen suites run against the recorded fixtures: a second dev server in VITE_MOCK=1 mode.
const mockURL = "http://localhost:5174"

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: previewURL },
    },
    {
      name: "shell",
      testDir: "e2e/shell",
      use: { ...devices["Desktop Chrome"], baseURL: devURL },
    },
    {
      name: "screens",
      testMatch:
        /e2e\/(streams|queues|workflows|aggregates|process-managers|timers|projections|overview)\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: mockURL },
    },
  ],
  webServer: [
    {
      command: "bun run build && bunx vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: previewURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bunx vite --port 5173 --strictPort",
      url: devURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "VITE_MOCK=1 bunx vite --port 5174 --strictPort",
      url: mockURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
