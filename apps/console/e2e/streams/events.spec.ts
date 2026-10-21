import { expect, feedScript, jump, open, pins, test } from "../support/mock"

test("the $all log shows the newest events and follows the store live", async ({ page }) => {
  await open(page, "/")
  await feedScript(page, "kiroku", { append: 2, intervalMs: 50 })
  await jump(page, "Go to Streams & Subscriptions › All events")
  const table = page.getByRole("grid", { name: "All events" })
  await expect(page.getByText("Following live")).toBeVisible()
  await expect(table.getByRole("row").nth(1)).toContainText("ConsoleMockEvent")
  await expect(table.locator("[data-highlight]")).toHaveCount(2)
})

test("an overflow shows the server's message and recovers the dropped events", async ({ page }) => {
  await open(page, "/")
  await feedScript(page, "kiroku", { append: 3, overflowAfter: 1, dropped: 2, intervalMs: 50 })
  await jump(page, "Go to Streams & Subscriptions › All events")
  await expect(page.getByText("Events were dropped — reloading")).toBeVisible()
  await expect(page.getByText(/undelivered batch/)).toBeVisible()
  // 3 pushed + 2 dropped, all held once.
  await expect(
    page.getByRole("grid", { name: "All events" }).locator("[data-highlight]"),
  ).toHaveCount(5)
})

test("event page: causation link and an unresolved causation", async ({ page }) => {
  await open(page, "/")
  const kiroku = await pins(page, "kiroku")
  await jump(page, `event ${kiroku.event_with_causation}`)
  await expect(page.getByRole("link", { name: new RegExp(kiroku.event_cause!) })).toBeVisible()
  await page.goto(`/events/${kiroku.event_causation_unresolved}`)
  await expect(page.getByText("not an event in this store")).toBeVisible()
  await expect(
    page.getByText("correlation filtering is not available on this surface"),
  ).toHaveCount(0)
})
