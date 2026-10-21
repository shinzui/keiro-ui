import { useSurfaceQuery } from "@keiro-ui/client-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { LivenessProvider } from "./liveness"
import { LivenessToggle } from "./status-widgets"

// MasterPlan early check 2: the bottom bar's toggle stops a real useSurfaceQuery poll and
// resume refetches immediately.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function Poller({ queryFn }: { queryFn: () => Promise<string> }) {
  useSurfaceQuery({ surface: "kiroku", queryKey: ["kiroku", "integration"], queryFn, poll: 20 })
  return null
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <LivenessProvider>{children}</LivenessProvider>
    </QueryClientProvider>
  )
}

test("the bottom bar toggle pauses and resumes a useSurfaceQuery poll", async () => {
  const queryFn = vi.fn(async () => "ok")
  render(
    <Providers>
      <Poller queryFn={queryFn} />
      <LivenessToggle />
    </Providers>,
  )
  await act(() => vi.advanceTimersByTimeAsync(70))
  expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(3)

  fireEvent.click(screen.getByRole("button", { name: "Pause live updates" }))
  await act(() => vi.advanceTimersByTimeAsync(5))
  const atPause = queryFn.mock.calls.length
  await act(() => vi.advanceTimersByTimeAsync(100))
  expect(queryFn.mock.calls.length).toBe(atPause)
  expect(screen.getByRole("button", { name: "Resume live updates" })).toHaveTextContent(
    /Paused 00:00/,
  )

  fireEvent.click(screen.getByRole("button", { name: "Resume live updates" }))
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(queryFn.mock.calls.length).toBe(atPause + 1)
})
