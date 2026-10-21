import { createRouter } from "@tanstack/react-router"

import { createQueryClient } from "./query-client"
import { routeTree } from "./routeTree.gen"

export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
