import type { ComponentType } from "react"

import { type Command, registerCommands } from "./commands"
import { registerNavigationEntries, type SectionId, type SidebarEntry } from "./navigation"
import { registerSheet, type SheetProps } from "./right-sheet"

export interface Feature {
  id: string
  /** Sheet kinds and their inspectors; each receives `{ entityRef, close }`. */
  sheets?: Record<string, ComponentType<SheetProps>>
  /** Static or preset palette commands (parsed jumps are owned by `jumpParsers`). */
  commands?: Command[]
  /** Preset sidebar entries per section. */
  navigation?: Partial<Record<SectionId, SidebarEntry[]>>
}

const registered = new Set<string>()

/**
 * The one entry point through which a screen plan contributes to the shell. Each screen
 * plan adds one `register<Section>Feature()` call to `apps/console/src/features/index.ts`.
 */
export function registerFeature(feature: Feature): void {
  if (registered.has(feature.id)) return
  registered.add(feature.id)
  for (const [kind, component] of Object.entries(feature.sheets ?? {})) {
    registerSheet(kind, component)
  }
  if (feature.commands?.length) registerCommands(feature.commands)
  if (feature.navigation) registerNavigationEntries(feature.navigation)
}
