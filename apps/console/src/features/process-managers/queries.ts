import { useSurfaceQuery } from "@keiro-ui/client-core"
import { keiroKeys, type ProcessManagerListCursor, useKeiroClient } from "@keiro-ui/client-keiro"

import { useConnectionProfiles } from "@/settings/connection-profiles"
import { useRecent } from "@/shell/recent"

// Every process-manager read of the section goes through this file. The `pm` command word is
// hook-gated like `aggregate`.

export const DEFAULT_LIMIT = 50
export const DEFAULT_TIMER_LIMIT = 20

export function useInstancePage(name: string, params: { after?: string; limit?: number }) {
  const keiro = useKeiroClient()
  const limit = params.limit ?? DEFAULT_LIMIT
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.processManagers.list(name, { limit, after: params.after }),
    queryFn: ({ signal }) =>
      keiro.processManagers.list(
        { name, limit, after: params.after as ProcessManagerListCursor | undefined },
        signal,
      ),
  })
}

/** The instance view, or `null` when keiro has no instance for this correlation. */
export function useInstance(name: string, correlation: string, timerLimit: number | undefined) {
  const keiro = useKeiroClient()
  return useSurfaceQuery({
    surface: "keiro",
    queryKey: keiroKeys.processManagers.show(name, correlation),
    queryFn: ({ signal }) =>
      keiro.processManagers.show({ name, correlation, timer_limit: timerLimit }, signal),
  })
}

const PM_PATH = /^\/process-managers\/([^/?#]+)/

/**
 * Manager names to offer: the active profile's configured list, then names seen in recents.
 * keiro has no read listing mounted process managers, so nothing is ever discovered or guessed.
 */
export function useKnownManagerNames(): { configured: string[]; recent: string[] } {
  const { active } = useConnectionProfiles()
  const visits = useRecent()
  const configured = [
    ...new Set((active.processManagerNames ?? []).map((n) => n.trim()).filter(Boolean)),
  ]
  const recent = [
    ...new Set(
      visits.flatMap((visit) => {
        const match = PM_PATH.exec(visit.href)
        return match ? [decodeURIComponent(match[1]!)] : []
      }),
    ),
  ].filter((name) => !configured.includes(name))
  return { configured, recent }
}
