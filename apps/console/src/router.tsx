import { createRouter } from "@tanstack/react-router"

import { bindLinkRouter } from "./lib/links"
import { parseSearch, stringifySearch } from "./lib/search"
import { createQueryClient } from "./query-client"
import { routeTree } from "./routeTree.gen"

export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Set once at build time through VITE_BASE_PATH; the surfaces stay at absolute prefixes.
  basepath: import.meta.env.BASE_URL,
  parseSearch,
  stringifySearch,
  defaultPreload: "intent",
  scrollRestoration: true,
})
bindLinkRouter(router)

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
