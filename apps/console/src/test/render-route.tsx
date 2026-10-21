import { createMemoryHistory, RouterProvider } from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { createQueryClient } from "@/query-client"
import { router } from "@/router"

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
 * Renders the application's router at `url` (shell, providers, and clients included) over a
 * fresh memory history and query client; pair it with `startMockServer()` from
 * `@keiro-ui/testing/node`. The app's singleton router is reused because `hrefOf` reads it.
 */
export function renderRoute(url: string) {
  const queryClient = createQueryClient()
  router.update({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { queryClient },
  })
  // The singleton still holds the previous test's matches; resolve the new location now.
  void router.load()
  const view = render(<RouterProvider router={router} />)
  return { ...view, router, queryClient }
}

/** The current location's search, as parsed by the router. */
export function currentSearch(r: typeof router) {
  return r.state.location.search as Record<string, unknown>
}
