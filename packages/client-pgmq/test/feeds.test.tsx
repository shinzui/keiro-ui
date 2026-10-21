import { feedScript, type MockServer, pins, startMockServer } from "@keiro-ui/testing/node"
import { renderHook, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"

import { pgmqKeys, usePgmqQueueMetrics, usePgmqQueueMetricsFeed } from "../src"
import { makeWrapper } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("pushed metrics land in usePgmqQueueMetrics' entry; an overflow re-reads it", async () => {
  feedScript("pgmq", { append: 2, overflowAfter: 2, intervalMs: 10 })
  const queue = pins("pgmq").queue!
  const { wrapper, queryClient } = makeWrapper()
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const { result } = renderHook(
    () => ({ feed: usePgmqQueueMetricsFeed(queue), metrics: usePgmqQueueMetrics(queue) }),
    { wrapper },
  )
  await waitFor(() => expect(result.current.feed.source).toBeDefined(), { timeout: 3000 })
  expect(result.current.feed.push).toBe(true)
  expect(result.current.metrics.data?.total_messages).toBe(9007199254740994n)
  await waitFor(
    () => expect(invalidate).toHaveBeenCalledWith({ queryKey: pgmqKeys.queueMetrics(queue) }),
    { timeout: 3000 },
  )
})
