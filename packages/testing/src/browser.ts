import { setupWorker } from "msw/browser"

import { feedHandlers } from "./feeds"
import { handlers } from "./handlers"

/**
 * Starts the MSW service worker for the console's `VITE_MOCK=1` mode and Playwright: every
 * surface request under `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` is answered from the
 * recorded fixtures; everything else goes to the network. The worker script is
 * apps/console/public/mockServiceWorker.js (`bunx msw init apps/console/public`).
 */
export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers, ...feedHandlers)
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  })
}
