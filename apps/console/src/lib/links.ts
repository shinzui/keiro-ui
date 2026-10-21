import type { WorkflowStatusClass } from "@keiro-ui/client-keiro"
import type { AnyRouter } from "@tanstack/react-router"

/**
 * One typed builder per route in the MasterPlan's link map. Each result spreads into
 * `<Link {...links.x()}>` and is accepted by `navigate()`. Entity builders take positional
 * strings; positions and ids that are `bigint` on the wire are passed as decimal strings.
 */
export const links = {
  overview: () => ({ to: "/" as const }),
  aggregates: () => ({ to: "/aggregates" as const }),
  aggregateType: (type: string) => ({ to: "/aggregates/$type" as const, params: { type } }),
  aggregate: (type: string, id: string) => ({
    to: "/aggregates/$type/$id" as const,
    params: { type, id },
  }),
  workflows: (search?: { status_class?: WorkflowStatusClass[]; workflow_name?: string }) => ({
    to: "/workflows" as const,
    search,
  }),
  workflow: (name: string, id: string) => ({
    to: "/workflows/$name/$id" as const,
    params: { name, id },
  }),
  processManagers: () => ({ to: "/process-managers" as const }),
  processManager: (name: string) => ({ to: "/process-managers/$name" as const, params: { name } }),
  processManagerInstance: (name: string, correlation: string) => ({
    to: "/process-managers/$name/$correlation" as const,
    params: { name, correlation },
  }),
  timers: (search?: { manager?: string; correlation?: string; tab?: "pending" | "stuck" }) => ({
    to: "/timers" as const,
    search,
  }),
  /** The timers page with the `timer` inspector sheet open. */
  timer: (id: string) => ({ to: "/timers" as const, search: { sheet: `timer:${id}` } }),
  projections: () => ({ to: "/projections" as const }),
  projection: (group: string) => ({ to: "/projections/$group" as const, params: { group } }),
  shards: (search?: { subscription?: string }) => ({ to: "/shards" as const, search }),
  streams: (search?: { category?: string; prefix?: string }) => ({
    to: "/streams" as const,
    search,
  }),
  stream: (name: string) => ({ to: "/streams/$name" as const, params: { name } }),
  streamEvents: (name: string, search?: { from?: string; direction?: "forward" | "backward" }) => ({
    to: "/streams/$name" as const,
    params: { name },
    search,
  }),
  categories: () => ({ to: "/categories" as const }),
  category: (name: string) => ({ to: "/categories/$name" as const, params: { name } }),
  categoryEvents: (name: string, search?: { from?: string }) => ({
    to: "/categories/$name" as const,
    params: { name },
    search,
  }),
  allEvents: (search?: { from?: string; direction?: "forward" | "backward" }) => ({
    to: "/events" as const,
    search,
  }),
  event: (id: string) => ({ to: "/events/$id" as const, params: { id } }),
  subscriptions: () => ({ to: "/subscriptions" as const }),
  subscription: (name: string) => ({ to: "/subscriptions/$name" as const, params: { name } }),
  queues: () => ({ to: "/queues" as const }),
  queue: (
    name: string,
    search?: { tab?: "messages" | "archive" | "bindings"; from?: string; limit?: number },
  ) => ({
    to: "/queues/$name" as const,
    params: { name },
    search,
  }),
  queueMessage: (queue: string, id: string) => ({
    to: "/queues/$name/messages/$id" as const,
    params: { name: queue, id },
  }),
  archivedMessage: (queue: string, id: string) => ({
    to: "/queues/$name/archive/$id" as const,
    params: { name: queue, id },
  }),
  processors: () => ({ to: "/processors" as const }),
  processor: (id: string) => ({ to: "/processors/$id" as const, params: { id } }),
  settingsConnections: () => ({ to: "/settings/connections" as const }),
} as const

export type LinkTarget = ReturnType<(typeof links)[keyof typeof links]>

// The router binds itself here when it is created (router.tsx). Importing the router instead
// would make every module that builds links import the route tree, and through `__root.tsx`
// the feature registrations, which call back into modules still being initialized.
let boundRouter: AnyRouter | undefined

export function bindLinkRouter(router: AnyRouter): void {
  boundRouter = router
}

/** The internal href (no base path) of a link target, as stored in recents and pins. */
export function hrefOf(target: LinkTarget): string {
  if (!boundRouter) throw new Error("hrefOf called before the router was created")
  return boundRouter.buildLocation(target as never).href
}
