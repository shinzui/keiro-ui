import { createContext, useContext } from "react"

import type { SelectedConnection } from "./connection-targets"

export const SelectedConnectionContext = createContext<SelectedConnection | null>(null)
export function useSelectedConnection() {
  return useContext(SelectedConnectionContext)
}
