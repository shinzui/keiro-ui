import type { HttpResponse } from "msw"

import { rawResponse } from "./fixtures"

// SYNTHETIC, not recorded from any host. keiro's demo host Jitsurei is hand-written, so the
// recorded catalogues never match the recorded `hospital-capacity` topology. The "joined"
// scenario answers the two catalogue reads as a host running that service's generated
// catalogues would: each aggregate mounted under its stream category, and one process manager
// built with the process's saga category. Its instance lists are empty pages.

/** `/aggregate/types` for the five `hospital-capacity` aggregates, named by category. */
export const joinedAggregateTypes = ["capacity", "hospital", "reservation", "supply", "surge"].map(
  (category) => ({
    category,
    name: category,
    snapshot_policy: "never",
    snapshots_configured: false,
  }),
)

/** `/pm/types` with one manager whose category is the `HospitalSurge` process's saga category. */
export const joinedProcessManagerTypes = [
  {
    category: "hospitalSurge",
    name: "hospital-surge",
    snapshot_policy: "never",
    snapshots_configured: false,
    timers_configured: true,
  },
]

const json = (value: unknown) => rawResponse(JSON.stringify(value), 200)

/** The joined scenario's answer for a keiro request, or undefined to fall through to fixtures. */
export function joinedResponse(url: URL): HttpResponse<string> | undefined {
  const path = url.pathname.replace(/^.*\/keiro(?=\/)/, "")
  const name = url.searchParams.get("name")
  if (path === "/aggregate/types") return json({ items: joinedAggregateTypes })
  if (path === "/pm/types") return json({ items: joinedProcessManagerTypes })
  if (path === "/aggregate/list" && joinedAggregateTypes.some((type) => type.name === name))
    return json({ category: name, items: [], name, skipped: 0 })
  if (path === "/pm/list" && joinedProcessManagerTypes.some((type) => type.name === name))
    return json({ items: [], skipped: 0 })
  return undefined
}
