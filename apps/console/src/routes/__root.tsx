import { RouterProvider as AriaRouterProvider } from "@keiro-ui/ui/components/router-provider"
import { Toaster } from "@keiro-ui/ui/components/sonner"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, useRouter } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import { registerAllFeatures } from "@/features"
import { navigateToHref, publicHref } from "@/lib/href"
import { StatusSlotProvider } from "@/shell/status-slots"
import { ThemeProvider, useTheme } from "@/shell/theme"

registerAllFeatures()

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : () => null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: "keiro console" }] }),
  component: RootComponent,
})

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} />
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const router = useRouter()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* React Aria links (sidebar entries) navigate through TanStack Router. */}
        <AriaRouterProvider
          navigate={(href) => void navigateToHref(router, href)}
          useHref={(href) => publicHref(router, href)}
        >
          <StatusSlotProvider>
            <HeadContent />
            <Outlet />
            <ThemedToaster />
          </StatusSlotProvider>
        </AriaRouterProvider>
      </ThemeProvider>
      <Suspense>
        <RouterDevtools />
      </Suspense>
    </QueryClientProvider>
  )
}
