import { createContext, type ReactNode, useContext } from "react"

import type { KeiroClient } from "./client"

const KeiroClientContext = createContext<KeiroClient | null>(null)

/** Provides the keiro client; the application builds it from the active connection profile. */
export function KeiroClientProvider({
  client,
  children,
}: {
  client: KeiroClient
  children: ReactNode
}) {
  return <KeiroClientContext.Provider value={client}>{children}</KeiroClientContext.Provider>
}

export function useKeiroClient(): KeiroClient {
  const client = useContext(KeiroClientContext)
  if (!client) throw new Error("useKeiroClient requires <KeiroClientProvider>")
  return client
}
