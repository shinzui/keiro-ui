import { Sidebar, SidebarInset, SidebarProvider } from "@keiro-ui/ui/components/sidebar"
import { Outlet } from "@tanstack/react-router"
import { useSyncExternalStore } from "react"

import { SurfacePageBoundary } from "@/settings/connection-session"

import { AboutSheet } from "./about-sheet"
import { CommandPalette } from "./command-palette"
import { createLocalStore } from "./local-store"
import { Rail } from "./rail"
import { registerSheet, RightSheetOutlet } from "./right-sheet"
import { SectionSidebar } from "./section-sidebar"
import { ShellCommands } from "./shell-commands"
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts"
import { StatusBar } from "./status-bar"
import { ConnectionSwitcher, HealthDots, LivenessToggle, PaletteHint } from "./status-widgets"

registerSheet("about", AboutSheet)

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

function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

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
          <SurfacePageBoundary>
            <Outlet />
          </SurfacePageBoundary>
        </div>
        <StatusBar
          connection={<ConnectionSwitcher />}
          health={<HealthDots />}
          liveness={<LivenessToggle />}
          paletteHint={<PaletteHint />}
        />
      </SidebarInset>
      <RightSheetOutlet />
      <CommandPalette />
      <ShortcutsDialog />
      <GlobalShortcuts />
      <ShellCommands />
    </SidebarProvider>
  )
}
