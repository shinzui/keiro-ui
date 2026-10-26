import { expect, test } from "./fixtures"

const placeholderPaths = [
  "/",
  "/aggregates",
  "/aggregates/order",
  "/aggregates/order/ord-1",
  "/workflows",
  "/workflows/billing/inv-7",
  "/process-managers",
  "/process-managers/fulfilment",
  "/process-managers/fulfilment/c-1",
  "/timers",
  "/projections",
  "/projections/read-models",
  "/shards",
  "/streams",
  "/streams/order-1",
  "/categories",
  "/categories/order",
  "/events",
  "/events/0b0c2b8e-0000-4000-8000-000000000000",
  "/subscriptions",
  "/subscriptions/orders",
  "/queues",
  "/queues/jobs",
  "/queues/jobs/messages/42",
  "/queues/jobs/archive/42",
  "/processors",
  "/processors/jobs-worker",
  "/settings/connections",
]

test.describe.configure({ mode: "parallel" })

test("every placeholder route renders a page header", async ({ page }) => {
  // Health probes fail with nothing running on the surface ports; those 502s are expected.
  for (const path of placeholderPaths) {
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  }
})

test("/settings redirects to /settings/connections", async ({ page }) => {
  await page.goto("/settings")
  await expect(page).toHaveURL(/\/settings\/connections\?target=same-origin$/)
})

test("the rail highlights the section and switches sidebar entries", async ({ page }) => {
  await page.goto("/")
  const rail = page.getByRole("navigation", { name: "Sections" })
  await expect(rail.getByRole("link")).toHaveCount(8)
  await rail.getByRole("link", { name: "Streams & Subscriptions" }).click()
  await expect(page).toHaveURL(/\/streams\?target=same-origin$/)
  await expect(rail.getByRole("link", { name: "Streams & Subscriptions" })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await page.getByRole("link", { name: "Subscriptions", exact: true }).click()
  await expect(page).toHaveURL(/\/subscriptions\?target=same-origin$/)
  await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeVisible()
})

test("the sidebar collapse persists across reload", async ({ page }) => {
  await page.goto("/streams")
  const sidebar = page.locator('[data-slot="sidebar"]').first()
  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await page.getByRole("button", { name: "Toggle sidebar" }).click()
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")
  await page.reload()
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")
})

test("light theme by default even when the browser prefers dark", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" })
  const page = await context.newPage()
  await page.goto("http://localhost:5173/")
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible()
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await context.close()
})
