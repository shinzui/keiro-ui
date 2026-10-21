import { expect, open, test } from "../support/mock"

test("selecting a sharded subscription shows its bucket ownership", async ({ page }) => {
  await open(page, "/shards")
  await expect(page.getByRole("grid", { name: "Ownership" })).toHaveCount(0)
  await page
    .getByRole("grid", { name: "Sharded subscriptions" })
    .getByRole("row", { name: /jitsurei-order-reporting/ })
    .click()
  await expect(page).toHaveURL(/subscription=jitsurei-order-reporting/)
  await expect(page.getByRole("grid", { name: "Ownership" })).toContainText("worker-b")
  await expect(page.getByTestId("unowned")).toHaveText("1 unowned")
})
