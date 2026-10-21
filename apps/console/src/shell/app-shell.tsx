import { Sidebar, SidebarInset, SidebarProvider } from "@keiro-ui/ui/components/sidebar"
import { Outlet } from "@tanstack/react-router"
import { useSyncExternalStore } from "react"

import { createLocalStore } from "./local-store"
import { Rail } from "./rail"
import { SectionSidebar } from "./section-sidebar"
import { StatusBar } from "./status-bar"

// The shadcn sidebar's cookie persistence is not used: the console is a static bundle with
// no server to read cookies.
export const sidebarStore = createLocalStore<{ open: boolean }>(
  "keiro-ui.sidebar.v1",
  { open: true },
  (raw) =>
    typeof raw === "object" && raw !== null && typeof (raw as { open?: unknown }).open === "boolean"
      ? { open: (raw as { open: boolean }).open }
      : undefined,
)

export function AppShell() {
  const { open } = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.get)
  return (
    <SidebarProvider
      open={open}
      onOpenChange={(next) => sidebarStore.set({ open: next })}
      className="min-h-svh"
    >
      <Rail />
      {/* The sidebar container is fixed; shift it right of the 48 px rail. */}
      <Sidebar collapsible="icon" className="md:left-12!">
        <SectionSidebar />
      </Sidebar>
      <SidebarInset className="h-svh min-w-0">
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
        <StatusBar />
      </SidebarInset>
    </SidebarProvider>
  )
}
