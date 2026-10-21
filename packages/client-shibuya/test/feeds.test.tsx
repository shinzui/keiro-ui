import { feedScript, type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { renderHook, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"

import { shibuyaKeys, useShibuyaProcessors, useShibuyaProcessorsFeed } from "../src"
import { makeWrapper } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("snapshot, updates, overflow re-read, and a failed terminal", async () => {
  feedScript("shibuya", { append: 2, overflowAfter: 1, intervalMs: 10, terminal: "failed" })
  const { wrapper, queryClient } = makeWrapper()
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const { result } = renderHook(
    () => ({ feed: useShibuyaProcessorsFeed(), processors: useShibuyaProcessors() }),
    { wrapper },
  )
  await waitFor(() => expect(result.current.feed.terminal.detailed).toBeDefined(), {
    timeout: 3000,
  })
  expect(result.current.feed.terminal.detailed).toEqual({
    status: "failed",
    error: "handler raised an exception",
    messageId: null,
  })
  expect(result.current.processors.data?.detailed?.state.status).toBe("failed")
  expect(Object.keys(result.current.feed.receivedAt).length).toBeGreaterThan(0)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: shibuyaKeys.processors() })
})
