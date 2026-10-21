import { registerNavigationEntries, type SectionId, type SidebarEntry } from "./navigation"

export interface Feature {
  id: string
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
  if (feature.navigation) registerNavigationEntries(feature.navigation)
}
