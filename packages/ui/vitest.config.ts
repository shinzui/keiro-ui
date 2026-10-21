import { defineProject } from "vitest/config"

export default defineProject({
  resolve: { tsconfigPaths: true },
  test: {
    name: "ui",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
})
