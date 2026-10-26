import { createContext, useContext } from "react"

import type { Surface } from "./surface"

/** Optional surfaces are disabled at the shared query/feed boundary. Absent provider preserves library defaults. */
export const SurfaceAvailabilityContext = createContext<Partial<Record<Surface, boolean>> | null>(
  null,
)
export function useSurfaceAvailable(surface: Surface): boolean {
  return useContext(SurfaceAvailabilityContext)?.[surface] !== false
}
