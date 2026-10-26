import { expect, test, vi } from "vitest"

import { fetchRuntimeConfig } from "./runtime-config"
const config = { version: 1, targets: [] }
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })

test("fetches the exact origin/base path with a timeout, no cache and no redirects", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(config))
  expect(await fetchRuntimeConfig("/console/", "https://ops.example", fetcher)).toEqual(config)
  expect(String(fetcher.mock.calls[0]![0])).toBe("https://ops.example/console/console-config.json")
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: expect.any(AbortSignal),
  })
})

test("404 alone permits legacy boot", async () => {
  expect(
    await fetchRuntimeConfig(
      "/",
      "https://ops.example",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    ),
  ).toBeUndefined()
})

test.each([
  new Response("<html>SPA</html>", { headers: { "content-type": "text/html" } }),
  json({ version: 2, targets: [] }),
  new Response("", { headers: { "content-type": "application/json" } }),
  json({}, 401),
  json({}, 403),
  json({}, 500),
])("fails closed for malformed or unauthorized config %#", async (response) => {
  await expect(
    fetchRuntimeConfig("/console/", "https://ops.example", vi.fn().mockResolvedValue(response)),
  ).rejects.toThrow()
})

test("network errors, redirects, cross-origin configuration and timeouts fail closed", async () => {
  await expect(
    fetchRuntimeConfig("/", "https://ops.example", vi.fn().mockRejectedValue(new Error("offline"))),
  ).rejects.toThrow("offline")
  const redirect = json(config)
  Object.defineProperty(redirect, "redirected", { value: true })
  await expect(
    fetchRuntimeConfig("/", "https://ops.example", vi.fn().mockResolvedValue(redirect)),
  ).rejects.toThrow(/redirects/)
  await expect(fetchRuntimeConfig("https://other/", "https://ops.example")).rejects.toThrow(
    /origin/,
  )
  const waitForAbort: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) =>
      init!.signal!.addEventListener("abort", () => reject(new Error("timeout"))),
    )
  await expect(fetchRuntimeConfig("/", "https://ops.example", waitForAbort, 5)).rejects.toThrow(
    "timeout",
  )
})
