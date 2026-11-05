import { fixtureText } from "@keiro-ui/testing"
import { type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { delay, http, HttpResponse } from "msw"
import { afterAll, afterEach, beforeAll, expect, test } from "vitest"

import { currentSearch, renderRoute } from "@/test/render-route"

let mock: MockServer
const reads: URL[] = []
beforeAll(() => {
  mock = startMockServer()
  mock.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith("/projection/consumers")) reads.push(url)
  })
})
afterEach(() => {
  mock.reset()
  reads.length = 0
})
afterAll(() => mock.close())
const panel = () => screen.getByRole("region", { name: "Declared consumers" })
const orderBody = () => JSON.parse(fixtureText("keiro/category-consumers-order.json"))
const refusal = (code: string, status = 400) =>
  HttpResponse.json(
    {
      error: {
        code,
        message: "original server explanation",
        details: { arguments: ["projection", "consumers", "--category", "order"] },
      },
    },
    { status },
  )

test("recorded declarations show bindings, coverage and deployment-preserving links", async () => {
  await renderRoute("/categories/order")
  const region = panel()
  const group = await within(region).findByRole("link", {
    name: "jitsurei-order-reporting",
  })
  expect(group).toHaveAttribute("href", "/projections/jitsurei-order-reporting?target=same-origin")
  expect(
    within(region).getByRole("link", { name: "jitsurei-order-audit-subscription" }),
  ).toHaveAttribute("href", "/subscriptions/jitsurei-order-audit-subscription?target=same-origin")
  expect(region).toHaveTextContent("Projection catalog metadata: available")
  expect(region).toHaveTextContent("Durable subscriber metadata: unavailable")
  expect(region).toHaveTextContent("Coverage is partial")
  expect(region).toHaveTextContent("Delivery: inline")
  expect(region).toHaveTextContent("category: order")
  expect(
    within(region).getByRole("list", { name: "Matching bindings for jitsurei-order-reporting" })
      .children,
  ).toHaveLength(2)
  expect(screen.getByRole("grid", { name: "Events in category order" })).toBeVisible()
  const before = reads.length
  fireEvent.click(within(region).getByRole("button", { name: "Refresh consumers" }))
  await waitFor(() => expect(reads.length).toBe(before + 1))
  expect(reads.at(-1)?.searchParams.has("after")).toBe(false)
})

test("empty partial metadata preserves coverage and changing categories drops old declarations", async () => {
  const { router } = await renderRoute("/categories/order")
  await within(panel()).findByRole("link", { name: "jitsurei-order-reporting" })
  await act(() => router.navigate({ to: "/categories/$name", params: { name: "creditLimit" } }))
  await within(panel()).findByText("No matching consumers in the reported metadata")
  expect(panel()).toHaveTextContent("Durable subscriber metadata: unavailable")
  expect(panel()).not.toHaveTextContent("jitsurei-order-reporting")
  expect(screen.getByRole("grid", { name: "Events in category creditLimit" })).toBeVisible()
})

test.each([
  "invalid_request",
  "unsupported_command",
  "inspection_timeout",
  "inspection_result_too_large",
])("%s remains honest and events keep working", async (code) => {
  mock.use(
    http.get("*/keiro/projection/consumers", () =>
      refusal(
        code,
        code === "inspection_result_too_large" ? 413 : code === "inspection_timeout" ? 504 : 400,
      ),
    ),
  )
  await renderRoute("/categories/order")
  const unavailable = ["invalid_request", "unsupported_command"].includes(code)
  await waitFor(
    () =>
      expect(panel()).toHaveTextContent(
        unavailable
          ? "Consumer discovery is unavailable on this host"
          : `${code}: original server explanation`,
      ),
    { timeout: 5000 },
  )
  if (code === "inspection_result_too_large")
    expect(panel()).toHaveTextContent("The server refused the result size")
  expect(panel()).not.toHaveTextContent("No matching consumers")
  expect(screen.getByRole("grid", { name: "Events in category order" })).toBeVisible()
  expect(within(panel()).getByRole("button", { name: "Retry consumers" })).toBeVisible()
})

test("Keiro is optional and categories list never reads discovery", async () => {
  await renderRoute("/categories/order?target=store", {
    catalog: {
      version: 1,
      defaultTargetId: "store",
      targets: [
        {
          id: "store",
          label: "Store",
          app: "store",
          environment: "dev",
          surfaces: { kiroku: "/kiroku" },
        },
      ],
    },
  })
  expect(panel()).toHaveTextContent("Keiro inspection is not configured")
  expect(reads).toEqual([])
})

test("independent consumer pages display every kind and source, and manual refresh returns to page one", async () => {
  const body = orderBody()
  body.coverage = { projection_catalog: true, durable_subscribers: true }
  body.items = ["durable_subscriber", "process_manager", "projection_group"].map((kind, i) => ({
    kind,
    name: `declared-${i}`,
    group_id: i === 2 ? "unregistered-group" : null,
    bindings: [
      {
        projection_id: null,
        handler_name: null,
        subscription_id: "opaque-id",
        subscription_name: "subscription-name",
        delivery: "subscription",
        source: [
          { kind: "all" },
          { kind: "namespace", namespace: "order:area" },
          { kind: "category", category: "order" },
        ][i],
      },
    ],
  }))
  mock.use(
    http.get("*/keiro/projection/consumers", ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.has("after")
          ? { ...body, items: [{ ...body.items[0], name: "second-page" }] }
          : { ...body, next_cursor: "opaque-page-two" },
      ),
    ),
  )
  const { router } = await renderRoute("/categories/order?from=123&limit=10")
  await within(panel()).findByText("declared-0")
  expect(panel()).toHaveTextContent("Durable subscriber metadata: available")
  expect(panel()).toHaveTextContent("all categories")
  expect(panel()).toHaveTextContent("namespace: order:area")
  expect(panel()).toHaveTextContent("Projection: not reported")
  expect(within(panel()).getByRole("link", { name: "unregistered-group" })).toHaveAttribute(
    "href",
    "/projections/unregistered-group?target=same-origin",
  )
  expect(within(panel()).queryByRole("link", { name: "declared-1" })).toBeNull()
  fireEvent.click(within(panel()).getByRole("button", { name: "Next" }))
  await within(panel()).findByText("second-page")
  expect(reads.at(-1)?.searchParams.get("after")).toBe("opaque-page-two")
  expect(currentSearch(router)).toMatchObject({ from: "123", limit: "10" })
  fireEvent.click(within(panel()).getByRole("button", { name: "Previous" }))
  await within(panel()).findByText("declared-0")
  fireEvent.click(within(panel()).getByRole("button", { name: "Next" }))
  await within(panel()).findByText("second-page")
  await waitFor(() =>
    expect(within(panel()).getByRole("button", { name: "Refresh consumers" })).toBeEnabled(),
  )
  fireEvent.click(within(panel()).getByRole("button", { name: "Refresh consumers" }))
  await within(panel()).findByText("declared-0")
  expect(currentSearch(router).from).toBe("123")
})

test.each([false, true])(
  "invalid consumer cursors restart only consumer paging; page-one failure=%s",
  async (failFirst) => {
    let expired = false
    mock.use(
      http.get("*/keiro/projection/consumers", ({ request }) => {
        if (new URL(request.url).searchParams.has("after")) {
          expired = true
          return refusal("invalid_cursor")
        }
        return expired && failFirst
          ? refusal("invalid_cursor")
          : HttpResponse.json({ ...orderBody(), next_cursor: expired ? undefined : "expired" })
      }),
    )
    const { router } = await renderRoute("/categories/order?from=321")
    await within(panel()).findByRole("link", { name: "jitsurei-order-reporting" })
    fireEvent.click(within(panel()).getByRole("button", { name: "Next" }))
    await within(panel()).findByText(
      "The consumer inventory changed or the cursor expired; restarted from page one.",
    )
    if (failFirst)
      await waitFor(() =>
        expect(panel()).toHaveTextContent("invalid_cursor: original server explanation"),
      )
    else
      await waitFor(() =>
        expect(within(panel()).getByRole("button", { name: "Next" })).toBeDisabled(),
      )
    expect(reads).toHaveLength(3)
    expect(currentSearch(router).from).toBe("321")
  },
)

test("late results from a previous category never render as current", async () => {
  mock.use(
    http.get("*/keiro/projection/consumers", async ({ request }) => {
      if (new URL(request.url).searchParams.get("category") === "order") {
        await delay(150)
        return HttpResponse.json(orderBody())
      }
      return HttpResponse.json(
        JSON.parse(fixtureText("keiro/category-consumers-credit-limit.json")),
      )
    }),
  )
  const { router } = await renderRoute("/categories/order")
  await act(() => router.navigate({ to: "/categories/$name", params: { name: "creditLimit" } }))
  await within(panel()).findByText("No matching consumers in the reported metadata")
  await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
  expect(panel()).not.toHaveTextContent("jitsurei-order-reporting")
})

test("event paging and following leave discovery and its cursor alone", async () => {
  mock.use(
    http.get("*/kiroku/categories/order/events", ({ request }) =>
      HttpResponse.json({
        items: [],
        ...(new URL(request.url).searchParams.get("from") !== "0" ? {} : { next_cursor: 123 }),
      }),
    ),
  )
  const { router } = await renderRoute("/categories/order")
  await within(panel()).findByRole("link", { name: "jitsurei-order-reporting" })
  const count = reads.length
  const pagers = screen.getAllByRole("navigation", { name: "Pages" })
  fireEvent.click(within(pagers[1]!).getByRole("button", { name: "Next" }))
  await waitFor(() => expect(currentSearch(router).from).toBe("123"))
  fireEvent.click(await screen.findByRole("button", { name: "Follow live" }))
  expect(reads).toHaveLength(count)
  expect(panel()).toHaveTextContent("jitsurei-order-reporting")
})

test("zero metadata coverage remains explicit", async () => {
  mock.use(
    http.get("*/keiro/projection/consumers", () =>
      HttpResponse.json({
        ...orderBody(),
        items: [],
        coverage: { projection_catalog: false, durable_subscribers: false },
      }),
    ),
  )
  await renderRoute("/categories/order")
  await within(panel()).findByText("No matching consumers in the reported metadata")
  expect(panel()).toHaveTextContent("Projection catalog metadata: unavailable")
  expect(panel()).toHaveTextContent("Durable subscriber metadata: unavailable")
})
