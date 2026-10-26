import { SurfaceAvailabilityContext } from "@keiro-ui/client-core"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react"

import { createQueryClient } from "@/query-client"

import { useSelectedConnection } from "./connection-context"
import { surfaces, type Surface } from "./connection-profiles"

export interface SessionToken {
  readonly active: boolean
  activate(): void
  retire(): void
  identity: {
    targetId: string
    app: string
    environment: string
    workerId?: string
    sessionKey: string
    endpoints: Partial<Record<Surface, string>>
  }
}
const SessionContext = createContext<SessionToken | null>(null)
export function useConnectionSession() {
  return useContext(SessionContext)
}

/** Key this provider by SelectedConnection.sessionKey. Submitted mutations retain their captured token. */
export function ConnectionSession({
  children,
  onSession,
}: {
  children: ReactNode
  onSession?: (client: QueryClient) => void
}) {
  const selected = useSelectedConnection()!
  const [queryClient] = useState(createQueryClient)
  const [token] = useState<SessionToken>(() => {
    let active = true
    return {
      get active() {
        return active
      },
      activate() {
        active = true
      },
      retire() {
        active = false
      },
      identity: Object.freeze({
        targetId: selected.target.id,
        app: selected.target.app,
        environment: selected.target.environment,
        workerId: selected.worker?.id,
        sessionKey: selected.sessionKey,
        endpoints: Object.freeze({ ...selected.endpoints }),
      }),
    }
  })
  useLayoutEffect(() => {
    token.activate()
    onSession?.(queryClient)
    return () => {
      token.retire()
      void queryClient.cancelQueries()
      queryClient.clear()
    }
  }, [token, queryClient, onSession])
  const availability = Object.fromEntries(
    surfaces.map((surface) => [surface, !!selected.endpoints[surface]]),
  )
  return (
    <SessionContext.Provider value={token}>
      <QueryClientProvider client={queryClient}>
        <SurfaceAvailabilityContext.Provider value={availability}>
          {children}
        </SurfaceAvailabilityContext.Provider>
      </QueryClientProvider>
    </SessionContext.Provider>
  )
}

const pageSurfaces: Record<string, Surface> = {
  workflows: "keiro",
  aggregates: "keiro",
  "process-managers": "keiro",
  timers: "keiro",
  projections: "keiro",
  shards: "keiro",
  streams: "kiroku",
  categories: "kiroku",
  events: "kiroku",
  subscriptions: "kiroku",
  queues: "pgmq",
  processors: "shibuya",
}
export function SurfacePageBoundary({ children }: { children: ReactNode }) {
  const selected = useSelectedConnection()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const surface = pageSurfaces[pathname.split("/").find(Boolean) ?? ""]
  if (selected && surface && !selected.endpoints[surface])
    return (
      <section className="p-8" role="status">
        <h1>{surface}</h1>
        <p>
          {surface === "shibuya" && selected.target.workers?.length
            ? "Select a worker. An unknown worker is unavailable; requests never fall back to another process."
            : "Not configured for this application"}
        </p>
      </section>
    )
  return children
}
