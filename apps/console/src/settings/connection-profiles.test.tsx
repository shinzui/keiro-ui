import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, test } from "vitest"

import {
  type ConnectionProfile,
  ConnectionProfileProvider,
  connectionProfileSchema,
  profileStore,
  sameOriginProfile,
  surfaceBaseUrl,
  useConnectionProfiles,
  useSurfaceBaseUrl,
  useWebSocketUrl,
  webSocketUrl,
} from "./connection-profiles"

const separate: ConnectionProfile = {
  id: "local",
  name: "Local ports",
  mode: "separate",
  origins: {
    kiroku: "http://127.0.0.1:9091",
    shibuya: "http://127.0.0.1:9090",
    pgmq: "http://127.0.0.1:9092",
    keiro: "https://keiro.example:9443/",
  },
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ConnectionProfileProvider>{children}</ConnectionProfileProvider>
)

beforeEach(() => {
  profileStore.set({ version: 1, activeId: "same-origin", profiles: [] })
})

test("the same-origin profile resolves each surface under its prefix", () => {
  expect(surfaceBaseUrl(sameOriginProfile, "kiroku", "http://localhost:5173")).toBe(
    "http://localhost:5173/kiroku",
  )
  expect(surfaceBaseUrl(sameOriginProfile, "keiro", "https://ops.example/")).toBe(
    "https://ops.example/keiro",
  )
  const { result } = renderHook(() => useSurfaceBaseUrl("pgmq"), { wrapper })
  expect(result.current).toBe(`${window.location.origin}/pgmq`)
})

test("a separate profile returns the origin unchanged", () => {
  expect(surfaceBaseUrl(separate, "pgmq", "http://localhost:5173")).toBe("http://127.0.0.1:9092")
  expect(surfaceBaseUrl(separate, "keiro", "http://localhost:5173")).toBe(
    "https://keiro.example:9443",
  )
})

test("WebSocket URLs swap the scheme and append the path", () => {
  expect(webSocketUrl("http://localhost:5173/kiroku", "/ws/events")).toBe(
    "ws://localhost:5173/kiroku/ws/events",
  )
  expect(webSocketUrl("https://keiro.example:9443", "ws")).toBe("wss://keiro.example:9443/ws")
  const { result } = renderHook(() => useWebSocketUrl("pgmq", "/ws"), { wrapper })
  expect(result.current).toBe(`${window.location.origin.replace("http", "ws")}/pgmq/ws`)
})

const withKiroku = (kiroku: string) => ({ ...separate, origins: { ...separate.origins, kiroku } })

describe("connectionProfileSchema", () => {
  test.each([
    ["http://127.0.0.1:9091/api", "Origin must not contain a path"],
    ["http://127.0.0.1:9091?x=1", "Origin must not contain a query"],
    ["http://127.0.0.1:9091#top", "Origin must not contain a fragment"],
    ["ftp://127.0.0.1", "Origin must use http or https"],
    ["127.0.0.1:9091", "Origin must be an absolute URL such as http://127.0.0.1:9092"],
    ["not a url", "Origin must be an absolute URL such as http://127.0.0.1:9092"],
  ])("rejects %s", (origin, message) => {
    const result = connectionProfileSchema.safeParse(withKiroku(origin))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(message)
    expect(result.error?.issues[0]?.path).toEqual(["origins", "kiroku"])
  })

  test("accepts an origin with a port and an optional trailing slash", () => {
    expect(connectionProfileSchema.safeParse(withKiroku("http://127.0.0.1:9092")).success).toBe(
      true,
    )
    expect(connectionProfileSchema.safeParse(withKiroku("http://127.0.0.1:9092/")).success).toBe(
      true,
    )
  })

  test("same-origin profiles do not validate origins", () => {
    expect(connectionProfileSchema.safeParse({ ...sameOriginProfile, id: "x" }).success).toBe(true)
  })
})

test("profiles persist under keiro-ui.connection-profiles.v1 and round-trip", () => {
  const { result } = renderHook(() => useConnectionProfiles(), { wrapper })
  act(() => result.current.upsert(separate))
  act(() => result.current.setActive("local"))
  expect(result.current.active.id).toBe("local")
  expect(result.current.profiles.map((p) => p.id)).toEqual(["same-origin", "local"])

  const stored = JSON.parse(window.localStorage.getItem("keiro-ui.connection-profiles.v1")!)
  expect(stored).toMatchObject({ version: 1, activeId: "local" })
  expect(stored.profiles).toHaveLength(1)

  const exported = result.current.exportJson()
  act(() => result.current.remove("local"))
  expect(result.current.active.id).toBe("same-origin")
  act(() => {
    expect(result.current.importJson(exported)).toEqual({ imported: 1 })
  })
  expect(result.current.profiles.map((p) => p.id)).toEqual(["same-origin", "local"])
})

test("the built-in profile can be neither removed nor stored", () => {
  const { result } = renderHook(() => useConnectionProfiles(), { wrapper })
  act(() => result.current.remove("same-origin"))
  act(() => result.current.upsert({ ...sameOriginProfile, name: "renamed" }))
  expect(result.current.profiles).toEqual([sameOriginProfile])
})
