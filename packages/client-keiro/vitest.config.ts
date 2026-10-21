import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "client-keiro",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
})
