import { setupWorker } from "msw/browser"

import { closeFeeds, feedHandlers } from "./feeds"
import { handlers } from "./handlers"
import { feedScript, kirokuLog, pins, resetScenario, useScenario } from "./scenario"

/**
 * The scenario API, reachable from Playwright through `page.evaluate` in mock mode:
 * `window.__keiroUiMock.useScenario({...})`, `.feedScript(...)`, `.pins(surface)`, `.reset()`.
 */
export interface MockControls {
  useScenario: typeof useScenario
  feedScript: typeof feedScript
  pins: typeof pins
  kirokuLog: typeof kirokuLog
  reset(): void
}

declare global {
  interface Window {
    __keiroUiMock?: MockControls
  }
}

/**
 * Starts the MSW service worker for the console's `VITE_MOCK=1` mode and Playwright: every
 * surface request under `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` is answered from the
 * recorded fixtures; everything else goes to the network. The worker script is
 * apps/console/public/mockServiceWorker.js (`bunx msw init apps/console/public`).
 */
export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers, ...feedHandlers)
  window.__keiroUiMock = {
    useScenario,
    feedScript,
    pins,
    kirokuLog,
    reset: () => {
      closeFeeds()
      resetScenario()
    },
  }
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  })
}
