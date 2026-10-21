import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { bindLinkRouter } from "@/lib/links"
import { parseSearch, stringifySearch } from "@/lib/search"
import { createQueryClient } from "@/query-client"
import { routeTree } from "@/routeTree.gen"

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
export async function renderRoute(url: string) {
  const queryClient = createQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [url] }),
    parseSearch,
    stringifySearch,
  })
  bindLinkRouter(router)
  await router.load()
  const view = render(<RouterProvider router={router as never} />)
  return { ...view, router, queryClient }
}

/** The current location's search, as parsed by the router. */
export function currentSearch(r: { state: { location: { search: unknown } } }) {
  return r.state.location.search as Record<string, unknown>
}
