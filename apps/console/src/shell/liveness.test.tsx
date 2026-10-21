import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { LivenessProvider, refetchIntervalFor, useLiveness } from "./liveness"

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

test("refetchIntervalFor", () => {
  expect(refetchIntervalFor(false, 5000)).toBe(5000)
  expect(refetchIntervalFor(true, 5000)).toBe(false)
})

test("pausing stops a refetchIntervalFor query; resuming refetches once immediately", async () => {
  const queryClient = new QueryClient()
  const queryFn = vi.fn(async () => "data")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>{children}</LivenessProvider>
    </QueryClientProvider>
  )
  const { result } = renderHook(
    () => {
      const liveness = useLiveness()
      useQuery({
        queryKey: ["kiroku", "test"],
        queryFn,
        refetchInterval: refetchIntervalFor(liveness.paused, 1000),
      })
      return liveness
    },
    { wrapper },
  )

  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(queryFn).toHaveBeenCalledTimes(2)

  act(() => result.current.pause())
  expect(result.current.paused).toBe(true)
  expect(result.current.pausedSince).toBeInstanceOf(Date)
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(queryFn).toHaveBeenCalledTimes(2)

  act(() => result.current.resume())
  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3))
  expect(result.current.paused).toBe(false)
  expect(result.current.pausedSince).toBeNull()
})
