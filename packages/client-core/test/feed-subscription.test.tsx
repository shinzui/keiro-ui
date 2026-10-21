// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { WebSocket as WsClient } from "ws"

import { LivenessProvider, useFeedSubscription, useLiveness } from "../src/live"
import { testDialect } from "./dialect"
import { scriptedServer } from "./scripted-server"

const cleanups: (() => unknown)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup()
})

test("applies frames, invalidates on overflow, and closes while paused", async () => {
  const server = await scriptedServer((socket) => {
    socket.on("message", (data) => {
      if (String(data).includes("subscribe")) {
        socket.send('{"type":"snapshot","queue":"orders","metrics":{},"push":true}')
        socket.send('{"type":"error","code":"overflow","message":"dropped","queue":null}')
      }
    })
  })
  cleanups.push(server.close)
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const applyToCache = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>{children}</LivenessProvider>
    </QueryClientProvider>
  )
  const { result } = renderHook(
    () => ({
      liveness: useLiveness(),
      feed: useFeedSubscription({
        url: server.url,
        dialect: testDialect,
        subscriptions: [{ queue: "orders" }],
        applyToCache,
        invalidate: ["pgmq", "queue", "orders"],
        // jsdom's Event is not undici's, so the node `ws` client stands in for the browser's.
        WebSocket: WsClient as unknown as typeof WebSocket,
      }),
    }),
    { wrapper },
  )
  await vi.waitFor(() =>
    expect(applyToCache).toHaveBeenCalledWith(
      queryClient,
      expect.objectContaining({ type: "snapshot" }),
      "snapshot",
    ),
  )
  await vi.waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pgmq", "queue", "orders"] }),
  )
  expect(result.current.feed.status).toBe("open")

  act(() => result.current.liveness.pause())
  await vi.waitFor(() => expect(result.current.feed.status).toBe("closed"))
})
