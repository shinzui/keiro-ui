import {
  feedScript,
  kirokuLog,
  type MockServer,
  pins,
  startMockServer,
} from "@keiro-ui/testing/node"
import { renderHook, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"

import { useKirokuEventTail, useKirokuMetrics, useKirokuMetricsFeed } from "../src"
import { makeWrapper } from "./support"

let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("the event tail recovers events dropped by an overflow from the poll path", async () => {
  feedScript("kiroku", { append: 4, overflowAfter: 2, dropped: 3, intervalMs: 10 })
  const head = kirokuLog.head()
  const onOverflow = vi.fn()
  const { wrapper } = makeWrapper()
  const { result } = renderHook(() => useKirokuEventTail({ fromPosition: head, onOverflow }), {
    wrapper,
  })

  // 4 pushed + 3 dropped = 7 appended after the head; each must be held exactly once.
  await waitFor(() => expect(result.current.events).toHaveLength(7), { timeout: 3000 })
  const positions = result.current.events.map((e) => e.globalPosition)
  expect(positions).toEqual([1n, 2n, 3n, 4n, 5n, 6n, 7n].map((n) => head + n))
  expect(onOverflow).toHaveBeenCalledWith(
    expect.objectContaining({ code: "event_stream_overflowed" }),
  )
  expect(result.current.status).toBe("live")
})

test("a category tail holds only that category", async () => {
  feedScript("kiroku", { append: 2, intervalMs: 10 })
  const category = pins("kiroku").category!
  const head = kirokuLog.head()
  const { wrapper } = makeWrapper()
  const { result } = renderHook(() => useKirokuEventTail({ fromPosition: head, category }), {
    wrapper,
  })
  await waitFor(() => expect(result.current.events).toHaveLength(2), { timeout: 3000 })
  expect(
    result.current.events.every((e) => e.original_stream_name?.startsWith(`${category}-`)),
  ).toBe(true)
})

test("a second metrics snapshot replaces the first in useKirokuMetrics' cache entry", async () => {
  feedScript("kiroku", { intervalMs: 20 })
  const { wrapper, queryClient } = makeWrapper()
  const setData = vi.spyOn(queryClient, "setQueryData")
  const { result } = renderHook(
    () => ({ feed: useKirokuMetricsFeed(), metrics: useKirokuMetrics() }),
    { wrapper },
  )
  await waitFor(
    () =>
      expect(
        setData.mock.calls.filter(([key]) => JSON.stringify(key) === '["kiroku","metrics"]').length,
      ).toBeGreaterThanOrEqual(2),
    {
      timeout: 3000,
    },
  )
  expect(result.current.feed.status).toBe("open")
  expect(typeof result.current.metrics.data?.store.global_position).toBe("bigint")
})
