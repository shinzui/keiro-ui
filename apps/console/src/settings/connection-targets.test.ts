import { describe, expect, test } from "vitest"

import {
  builtinTarget,
  loadLocalTargets,
  migrateV1,
  normalizeEndpoint,
  runtimeConsoleConfigSchema,
  selectConnection,
  TARGET_STORAGE_KEY,
} from "./connection-targets"

const target = {
  id: "prod-orders",
  label: "Orders",
  app: "orders",
  environment: "prod",
  surfaces: { keiro: "/inspection/prod/orders/keiro" },
}

test("optional namespaced surfaces normalize without the console asset base", () => {
  const config = runtimeConsoleConfigSchema.parse({
    version: 1,
    targets: [
      target,
      { ...target, id: "prod-billing", surfaces: { kiroku: "https://store.example/nested/" } },
    ],
  })
  expect(
    selectConnection(config.targets[0]!, "managed", undefined, "https://ops.example").endpoints,
  ).toEqual({ keiro: "https://ops.example/inspection/prod/orders/keiro" })
  expect(
    selectConnection(config.targets[1]!, "managed", undefined, "https://ops.example").endpoints,
  ).toEqual({ kiroku: "https://store.example/nested" })
})

describe("raw endpoint validation", () => {
  test.each([
    "//other/x",
    "/a/../b",
    "/a/%2e%2e/b",
    "/a/%252e%252e/b",
    "/a\\b",
    "https://h/a/./b",
    "https://user:secret@h/x",
    "/x?",
    "/x#",
    "ftp://h/x",
    "relative/path",
    "https://h/%5cfoo",
    "/bad%zz",
    " https://h",
  ])("rejects %s", (url) => expect(() => normalizeEndpoint(url, "https://ops.example")).toThrow())
  test("mixed content is visible while HTTP development remains valid", () => {
    expect(() => normalizeEndpoint("http://localhost:9093", "https://ops.example")).toThrow(
      /Mixed content/,
    )
    expect(normalizeEndpoint("http://localhost:9093/a/", "http://localhost:5173")).toBe(
      "http://localhost:9093/a",
    )
  })
})

test("catalog invariants reject ambiguous or dangling identity", () => {
  const config = (targets: unknown[], extra = {}) =>
    runtimeConsoleConfigSchema.safeParse({ version: 1, targets, ...extra }).success
  expect(config([target, target])).toBe(false)
  expect(config([target], { defaultTargetId: "absent" })).toBe(false)
  expect(config([{ ...target, id: "old opaque/id" }])).toBe(false)
  expect(config([{ ...target, surfaces: {} }])).toBe(false)
  const worker = { id: "jobs-1", label: "Jobs", shibuyaBaseUrl: "/workers/jobs-1" }
  expect(config([{ ...target, workers: [worker, worker] }])).toBe(false)
  expect(config([{ ...target, workers: [worker], surfaces: { shibuya: "/shibuya" } }])).toBe(false)
  expect(config([{ ...target, defaultWorkerId: "absent" }])).toBe(false)
})

test("v1 migration preserves opaque IDs, metadata and exact legacy endpoints without touching v1", () => {
  const old = {
    version: 1,
    activeId: " x /雪? ",
    profiles: [
      {
        id: " x /雪? ",
        name: "Legacy",
        mode: "same-origin",
        origins: { keiro: "", kiroku: "", pgmq: "", shibuya: "" },
        processManagerNames: ["fulfil"],
        deadLetterQueueSuffix: "-dead",
      },
    ],
  }
  localStorage.setItem("keiro-ui.connection-profiles.v1", JSON.stringify(old))
  const migrated = loadLocalTargets(localStorage)
  expect(migrated.activeId).toBe(old.activeId)
  expect(migrated.targets[0]).toMatchObject({
    id: old.activeId,
    label: "Legacy",
    app: "x /雪?",
    environment: "local",
    processManagerNames: ["fulfil"],
    deadLetterQueueSuffix: "-dead",
    surfaces: builtinTarget.surfaces,
  })
  expect(localStorage.getItem("keiro-ui.connection-profiles.v1")).toBe(JSON.stringify(old))
  expect(JSON.parse(localStorage.getItem(TARGET_STORAGE_KEY)!)).toEqual(migrated)
  const origins = {
    keiro: "http://k:9093/",
    kiroku: "https://events",
    pgmq: "http://q:9095",
    shibuya: "http://w:9090",
  }
  expect(
    migrateV1({ ...old, profiles: [{ ...old.profiles[0], mode: "separate", origins }] }).targets[0]
      ?.surfaces,
  ).toEqual(origins)
})

test("invalid v2 or v1 is retained and never partially migrated", () => {
  localStorage.setItem(TARGET_STORAGE_KEY, '{"version":2,"targets":[{}]}')
  expect(() => loadLocalTargets(localStorage)).toThrow()
  expect(localStorage.getItem(TARGET_STORAGE_KEY)).toBe('{"version":2,"targets":[{}]}')
  localStorage.removeItem(TARGET_STORAGE_KEY)
  localStorage.setItem("keiro-ui.connection-profiles.v1", '{"version":1,"profiles":[{}]}')
  expect(() => loadLocalTargets(localStorage)).toThrow()
  expect(localStorage.getItem(TARGET_STORAGE_KEY)).toBeNull()
})

test("session identity changes with endpoints/settings/workers but ignores cosmetic labels", () => {
  const key = (t = target, worker?: string) =>
    selectConnection(t, "managed", worker, "https://ops.example").sessionKey
  expect(key({ ...target, label: "Renamed" })).toBe(key())
  expect(key({ ...target, surfaces: { keiro: "/different" } })).not.toBe(key())
  expect(key(target, "jobs-1")).not.toBe(key(target, "jobs-2"))
})
