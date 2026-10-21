import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : () => null

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "keiro runtime console" }] }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />
      <Suspense>
        <RouterDevtools />
      </Suspense>
    </>
  )
}
