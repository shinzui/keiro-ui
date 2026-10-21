import { LivenessProvider } from "@keiro-ui/client-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createShibuyaClient, ShibuyaClientProvider } from "../src"

export const baseUrl = "http://localhost/shibuya"

export function makeWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const client = createShibuyaClient({ baseUrl })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>
        <ShibuyaClientProvider client={client}>{children}</ShibuyaClientProvider>
      </LivenessProvider>
    </QueryClientProvider>
  )
  return { wrapper, queryClient, client }
}
