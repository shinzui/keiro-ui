import type { AnyHandler } from "msw"
import { setupServer, type SetupServer } from "msw/node"

import { closeFeeds, feedHandlers } from "./feeds"
import { handlers } from "./handlers"
import { resetScenario } from "./scenario"

export interface MockServer {
  server: SetupServer
  /** Prepends runtime handlers (they win over the fixtures). */
  use(...extra: AnyHandler[]): void
  /** Drops runtime handlers, scenario overrides, scripted feeds, and the kiroku log's appends. */
  reset(): void
  close(): void
}

/**
 * Serves every fixture at its real path under any origin (`http://localhost/kiroku/...` in
 * vitest), plus the scripted WebSocket feeds. Call `reset()` in `afterEach`.
 */
export function startMockServer(): MockServer {
  const server = setupServer(...handlers, ...feedHandlers)
  server.listen({ onUnhandledFrame: "warn" })
  return {
    server,
    use: (...extra) => server.use(...extra),
    reset: () => {
      closeFeeds()
      server.resetHandlers()
      resetScenario()
    },
    close: () => {
      closeFeeds()
      server.close()
    },
  }
}

export { feedScript, kirokuLog, pins, useScenario } from "./scenario"
