import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { render, waitFor } from "@testing-library/react"

import { bindLinkRouter } from "@/lib/links"
import { parseSearch, stringifySearch } from "@/lib/search"
import { createQueryClient } from "@/query-client"
import { routeTree } from "@/routeTree.gen"
import type { RuntimeConsoleConfig } from "@/settings/connection-targets"
import { RuntimeCatalogProvider } from "@/settings/runtime-config-provider"

// jsdom lacks the layout APIs the shell reads; inert stand-ins are enough for these tests.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * Renders the application's route tree at `url` (shell, providers, and clients included) with a
 * fresh router, memory history, and query client; pair it with `startMockServer()` from
 * `@keiro-ui/testing/node`. The router is bound for `hrefOf` like the app's own.
 */
export async function renderRoute(
  url: string,
  options?: { catalog?: RuntimeConsoleConfig; noSession?: boolean },
) {
  let queryClient: ReturnType<typeof createQueryClient> | undefined
  const router = createRouter({
    routeTree,
    context: {
      onSession: (client) => {
        queryClient = client
      },
    },
    history: createMemoryHistory({ initialEntries: [url] }),
    parseSearch,
    stringifySearch,
  })
  bindLinkRouter(router)
  await router.load()
  const view = render(
    <RuntimeCatalogProvider value={options?.catalog}>
      <RouterProvider router={router as never} />
    </RuntimeCatalogProvider>,
  )
  if (!options?.noSession)
    await waitFor(() => {
      if (!queryClient) throw new Error("Session not mounted")
    })
  return {
    ...view,
    router,
    get queryClient() {
      return queryClient!
    },
  }
}

/** The current location's search, as parsed by the router. */
export function currentSearch(r: { state: { location: { search: unknown } } }) {
  return r.state.location.search as Record<string, unknown>
}
