import { startMockServer, type MockServer } from "@keiro-ui/testing/node"
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

import { TARGET_STORAGE_KEY, type RuntimeConsoleConfig } from "./connection-targets"

const catalog: RuntimeConsoleConfig = {
  version: 1,
  defaultTargetId: "orders",
  targets: [
    {
      id: "orders",
      label: "Orders",
      app: "orders",
      environment: "prod",
      surfaces: { keiro: "/inspection/orders/keiro" },
      workers: [
        { id: "one", label: "Worker one", shibuyaBaseUrl: "/inspection/orders/one/shibuya" },
        { id: "two", label: "Worker two", shibuyaBaseUrl: "/inspection/orders/two/shibuya" },
      ],
      defaultWorkerId: "one",
    },
    {
      id: "billing",
      label: "Billing",
      app: "billing",
      environment: "prod",
      surfaces: { keiro: "/inspection/billing/keiro" },
    },
  ],
}
let mock: MockServer
beforeAll(() => {
  mock = startMockServer()
})
afterEach(() => mock.reset())
afterAll(() => mock.close())

test("canonical entry, native anchors, settings redirect and Back/Forward retain target and worker", async () => {
  const { router } = await renderRoute("/workflows", { catalog })
  await screen.findByRole("grid", { name: "Workflow instances" })
  expect(currentSearch(router)).toMatchObject({ target: "orders", worker: "one" })
  const workflow = screen.getByRole("link", { name: "workflow-20261021202320830171000000" })
  expect(workflow.getAttribute("href")).toContain("target=orders")
  expect(workflow.getAttribute("href")).toContain("worker=one")
  await act(() =>
    router.navigate({ to: "/settings", search: { target: "orders", worker: "two" } } as never),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe("/settings/connections"))
  expect(currentSearch(router)).toMatchObject({ target: "orders", worker: "two" })
  fireEvent.change(screen.getByRole("combobox", { name: "Application" }), {
    target: { value: "billing" },
  })
  await waitFor(() => expect(router.state.location.pathname).toBe("/"))
  expect(currentSearch(router)).toEqual({ target: "billing" })
  await act(async () => {
    router.history.back()
  })
  await waitFor(() =>
    expect(currentSearch(router)).toMatchObject({ target: "orders", worker: "two" }),
  )
  await act(async () => {
    router.history.forward()
  })
  await waitFor(() => expect(currentSearch(router)).toEqual({ target: "billing" }))
})

test("another tab's preference cannot change an explicit target", async () => {
  const { router } = await renderRoute("/workflows?target=orders", { catalog })
  const stored = { version: 2, activeId: "billing", targets: [] }
  localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(stored))
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: TARGET_STORAGE_KEY })))
  expect(currentSearch(router).target).toBe("orders")
  cleanup()
  const next = await renderRoute("/workflows", { catalog })
  expect(currentSearch(next.router).target).toBe("billing")
})

test("unknown target and empty managed catalog make no inspection requests", async () => {
  const paths: string[] = []
  const listener = ({ request }: { request: Request }) => paths.push(request.url)
  mock.server.events.on("request:start", listener)
  await renderRoute("/workflows?target=absent", { catalog, noSession: true })
  expect(screen.getByRole("alert")).toHaveTextContent("Application unavailable")
  expect(paths).toEqual([])
  cleanup()
  await renderRoute("/", { catalog: { version: 1, targets: [] }, noSession: true })
  expect(screen.getByRole("alert")).toHaveTextContent("Select an application")
  expect(paths).toEqual([])
  mock.server.events.removeListener("request:start", listener)
})

test("invalid or missing worker leaves database surfaces usable but makes no processor requests", async () => {
  const { router } = await renderRoute("/processors?target=orders&worker=missing", { catalog })
  expect(await screen.findByText(/unknown worker is unavailable/)).toBeInTheDocument()
  expect(currentSearch(router).worker).toBe("missing")
  await act(() => router.navigate({ to: "/workflows" } as never))
  expect(await screen.findByRole("grid", { name: "Workflow instances" })).toBeInTheDocument()
  cleanup()
  const noDefault = structuredClone(catalog)
  delete noDefault.targets[0]!.defaultWorkerId
  await renderRoute("/processors?target=orders", { catalog: noDefault })
  expect(await screen.findByText(/Select a worker\. An unknown/)).toBeInTheDocument()
})

test("optional raw events and inspector sheets show configuration reasons without Kiroku requests", async () => {
  const paths: string[] = []
  const listener = ({ request }: { request: Request }) => paths.push(new URL(request.url).pathname)
  mock.server.events.on("request:start", listener)
  await renderRoute(
    "/aggregates/order/demo-20261021202320671316000000?target=orders&sheet=event:missing",
    { catalog },
  )
  expect(
    await screen.findByText("Raw events: Not configured for this application"),
  ).toBeInTheDocument()
  expect(await screen.findByRole("dialog")).toHaveTextContent("Not configured for this application")
  expect(paths.some((path) => path.includes("/kiroku"))).toBe(false)
  mock.server.events.removeListener("request:start", listener)
})

test("editing effective endpoints under one local ID retires its cache", async () => {
  const target = {
    id: "local-one",
    label: "Local",
    app: "app",
    environment: "dev",
    surfaces: { keiro: "/old/keiro" },
  }
  localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify({ version: 2, targets: [target] }))
  const view = await renderRoute("/workflows?target=local-one")
  await screen.findByRole("grid", { name: "Workflow instances" })
  const previous = view.queryClient
  localStorage.setItem(
    TARGET_STORAGE_KEY,
    JSON.stringify({ version: 2, targets: [{ ...target, surfaces: { keiro: "/new/keiro" } }] }),
  )
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: TARGET_STORAGE_KEY })))
  await waitFor(() => expect(view.queryClient).not.toBe(previous))
  expect(previous.getQueryCache().getAll()).toHaveLength(0)
})

test("scoped recent links clear the prior app's worker while keeping their own target", async () => {
  const { publicHref, navigateToHref } = await import("@/lib/href")
  const { router } = await renderRoute("/workflows?target=orders&worker=two", { catalog })
  expect(publicHref(router, "/workflows?target=billing")).toBe("/workflows?target=billing")
  expect(publicHref(router, "https://external.example/path?x=1")).toBe(
    "https://external.example/path?x=1",
  )
  await act(() => navigateToHref(router, "/workflows?target=billing"))
  expect(currentSearch(router)).toEqual({ target: "billing" })
})
