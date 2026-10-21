import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { ConnectionProfileProvider, useSurfaceBaseUrl } from "./connection-profiles"

afterEach(() => vi.unstubAllEnvs())

test("a sub-path deployment leaves the surfaces at their absolute prefixes", () => {
  vi.stubEnv("BASE_URL", "/console/")
  window.history.replaceState(null, "", "/console/workflows")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConnectionProfileProvider>{children}</ConnectionProfileProvider>
  )
  const { result } = renderHook(() => useSurfaceBaseUrl("kiroku"), { wrapper })
  expect(import.meta.env.BASE_URL).toBe("/console/")
  expect(new URL(result.current).pathname).toBe("/kiroku")
})
