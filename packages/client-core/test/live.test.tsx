// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { ApiError } from "../src/errors"
import {
  adaptiveInterval,
  LivenessProvider,
  surfacePollDefaults,
  surfaceRetry,
  useLiveness,
  useSurfaceQuery,
} from "../src/live"

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>{children}</LivenessProvider>
    </QueryClientProvider>
  )
}

describe("adaptiveInterval", () => {
  test("the base while fetches are fast, the clamp after slow ones", () => {
    expect(adaptiveInterval(surfacePollDefaults.kiroku, 500)).toBe(5000)
    expect(adaptiveInterval(5000, 3000)).toBe(30_000)
    expect(adaptiveInterval(5000, 7000)).toBe(60_000)
    expect(adaptiveInterval(5000, 1500)).toBe(15_000)
  })
})

test("surfaceRetry never retries a 4xx and stops after two attempts", () => {
  const notFound = new ApiError({
    surface: "pgmq",
    status: 404,
    code: "queue_not_found",
    message: "",
    raw: null,
  })
  const unavailable = new ApiError({
    surface: "pgmq",
    status: 503,
    code: "inspection_busy",
    message: "",
    raw: null,
  })
  expect(surfaceRetry(0, notFound)).toBe(false)
  expect(surfaceRetry(0, unavailable)).toBe(true)
  expect(surfaceRetry(2, unavailable)).toBe(false)
})

describe("useSurfaceQuery", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test("polls, stops while paused, and refetches exactly once on resume", async () => {
    const queryClient = new QueryClient()
    const queryFn = vi.fn(async () => "ok")
    const { result } = renderHook(
      () => ({
        liveness: useLiveness(),
        query: useSurfaceQuery({ surface: "kiroku", queryKey: ["kiroku", "t"], queryFn, poll: 10 }),
      }),
      { wrapper: wrapper(queryClient) },
    )
    await act(() => vi.advanceTimersByTimeAsync(55))
    expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(3)

    act(() => result.current.liveness.pause())
    await act(() => vi.advanceTimersByTimeAsync(5))
    const atPause = queryFn.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(queryFn.mock.calls.length).toBe(atPause)

    act(() => result.current.liveness.resume())
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(queryFn.mock.calls.length).toBe(atPause + 1)
  })

  test("a slow fetch stretches the next interval to the clamp", async () => {
    const queryClient = new QueryClient()
    const queryFn = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("slow"), 3000)),
    )
    renderHook(() => useSurfaceQuery({ surface: "pgmq", queryKey: ["pgmq", "slow"], queryFn }), {
      wrapper: wrapper(queryClient),
    })
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(queryFn).toHaveBeenCalledTimes(1)
    // The default pgmq interval is 5 s, but after a 3 s fetch the next poll waits 30 s.
    await act(() => vi.advanceTimersByTimeAsync(29_000))
    expect(queryFn).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(1_100))
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})

test("refreshAll invalidates every surface prefix", async () => {
  const queryClient = new QueryClient()
  const spy = vi.spyOn(queryClient, "invalidateQueries")
  const { result } = renderHook(() => useLiveness(), { wrapper: wrapper(queryClient) })
  await act(() => result.current.refreshAll())
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(4))
  expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ["kiroku"],
    ["pgmq"],
    ["shibuya"],
    ["keiro"],
  ])
})
