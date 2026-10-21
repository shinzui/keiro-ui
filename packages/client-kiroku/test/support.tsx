import { LivenessProvider } from "@keiro-ui/client-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createKirokuClient, KirokuClientProvider } from "../src"

export const baseUrl = "http://localhost/kiroku"

export function makeWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const client = createKirokuClient({ baseUrl })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>
        <KirokuClientProvider client={client}>{children}</KirokuClientProvider>
      </LivenessProvider>
    </QueryClientProvider>
  )
  return { wrapper, queryClient, client }
}
