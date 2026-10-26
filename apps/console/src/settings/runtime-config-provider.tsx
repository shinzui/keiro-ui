import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import type { RuntimeConsoleConfig } from "./connection-targets"
import { fetchRuntimeConfig } from "./runtime-config"

const ConfigContext = createContext<RuntimeConsoleConfig | undefined>(undefined)
export const RuntimeCatalogProvider = ConfigContext.Provider
export function useRuntimeCatalog() {
  return useContext(ConfigContext)
}

export function RuntimeConfigLoader({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    config?: RuntimeConsoleConfig
    error?: string
    ready?: boolean
  }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetchRuntimeConfig(import.meta.env.BASE_URL, window.location.origin).then(
      (config) => {
        if (active) setState({ ready: true, config })
      },
      (error: unknown) => {
        if (active) setState({ error: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])
  if (state.error)
    return (
      <main className="p-8" role="alert">
        <h1>Console configuration error</h1>
        <p>{state.error}</p>
        <button
          onClick={() => {
            setState({})
            setAttempt((n) => n + 1)
          }}
        >
          Retry
        </button>
      </main>
    )
  if (!state.ready)
    return (
      <main className="p-8" role="status">
        Loading console configuration…
      </main>
    )
  return <RuntimeCatalogProvider value={state.config}>{children}</RuntimeCatalogProvider>
}
