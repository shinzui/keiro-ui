import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "client-core",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
})
