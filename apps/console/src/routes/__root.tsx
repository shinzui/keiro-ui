import { RouterProvider as AriaRouterProvider } from "@keiro-ui/ui/components/router-provider"
import { Toaster } from "@keiro-ui/ui/components/sonner"
import { type QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, useRouter } from "@tanstack/react-router"
import { lazy, Suspense } from "react"

import { registerAllFeatures } from "@/features"
import { SessionAuditStatus } from "@/features/actions/session-audit-sheet"
import { navigateToHref, publicHref } from "@/lib/href"
import { ClientsProvider } from "@/settings/clients"
import { ConnectionProfileProvider } from "@/settings/connection-profiles"
import { ConnectionSession } from "@/settings/connection-session"
import { TargetSelectionProvider, useTargetSelection } from "@/settings/target-selection"
import { LivenessProvider } from "@/shell/liveness"
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

export const Route = createRootRouteWithContext<{ onSession?: (client: QueryClient) => void }>()({
  head: () => ({ meta: [{ title: "keiro console" }] }),
  component: RootComponent,
})

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} />
}

function RootComponent() {
  const { onSession } = Route.useRouteContext()
  const router = useRouter()
  return (
    <>
      <ThemeProvider>
        {/* React Aria links (sidebar entries) navigate through TanStack Router. */}
        <AriaRouterProvider
          navigate={(href) => void navigateToHref(router, href)}
          useHref={(href) => publicHref(router, href)}
        >
          <TargetSelectionProvider>
            <SessionBoundary onSession={onSession}>
              <ConnectionProfileProvider>
                <ClientsProvider>
                  <LivenessProvider>
                    <StatusSlotProvider>
                      <HeadContent />
                      <SessionAuditStatus />
                      <Outlet />
                      <ThemedToaster />
                    </StatusSlotProvider>
                  </LivenessProvider>
                </ClientsProvider>
              </ConnectionProfileProvider>
            </SessionBoundary>
          </TargetSelectionProvider>
        </AriaRouterProvider>
      </ThemeProvider>
      <Suspense>
        <RouterDevtools />
      </Suspense>
    </>
  )
}

function SessionBoundary({
  children,
  onSession,
}: {
  children: React.ReactNode
  onSession?: (client: QueryClient) => void
}) {
  const selection = useTargetSelection()!
  return (
    <ConnectionSession key={selection.selected!.sessionKey} onSession={onSession}>
      {children}
    </ConnectionSession>
  )
}
