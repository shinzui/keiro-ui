import { LivenessProvider } from "@keiro-ui/client-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createKeiroClient, KeiroClientProvider } from "../src"

export const baseUrl = "http://localhost/keiro"

export function makeWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const client = createKeiroClient({ baseUrl })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>
        <KeiroClientProvider client={client}>{children}</KeiroClientProvider>
      </LivenessProvider>
    </QueryClientProvider>
  )
  return { wrapper, queryClient, client }
}

/** An in-memory fetch that records request lines and answers with a fixed body. */
export function recordingFetch(status = 200, body = '{"generation":0,"items":[]}') {
  const requests: {
    method: string
    url: string
    body: string | null
    contentType: string | null
  }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push({
      method: request.method,
      url: request.url.replace("http://keiro.test", ""),
      body: init?.body ? String(init.body) : null,
      contentType: request.headers.get("content-type"),
    })
    return new Response(body, { status, headers: { "content-type": "application/json" } })
  }
  return { fetch: fetchImpl, requests }
}
