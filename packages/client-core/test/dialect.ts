import type { Dialect } from "../src/feed"

/** A pgmq-shaped dialect for the core's tests (the real descriptors live in the clients). */
export const testDialect: Dialect<{ queue: string }> = {
  name: "test",
  subscribe: ({ queue }) => ({ type: "subscribe", queue }),
  unsubscribe: ({ queue }) => ({ type: "unsubscribe", queue }),
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
    extra: ["terminal"],
  },
  overflowCodes: ["overflow"],
  isResync: () => false,
}
