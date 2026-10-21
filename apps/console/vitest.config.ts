import { defineProject } from "vitest/config"

export default defineProject({
  resolve: { tsconfigPaths: true },
  define: { __APP_VERSION__: JSON.stringify("0.0.0-test"), __GIT_COMMIT__: JSON.stringify("test") },
  test: {
    name: "console",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
