import { LivenessProvider } from "@keiro-ui/client-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createPgmqClient, PgmqClientProvider } from "../src"

export const baseUrl = "http://localhost/pgmq"

export function makeWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const client = createPgmqClient({ baseUrl })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>
        <PgmqClientProvider client={client}>{children}</PgmqClientProvider>
      </LivenessProvider>
    </QueryClientProvider>
  )
  return { wrapper, queryClient, client }
}
