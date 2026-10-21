import { expect, jump, open, pins, scenario, test } from "../support/mock"

test("checkpoints with distance to the store head and live annotations", async ({ page }) => {
  await open(page, "/subscriptions")
  const table = page.getByRole("grid", { name: "Subscription checkpoints" })
  await expect(table.getByRole("row")).toHaveCount(4) // header + 3 derived rows
  await expect(table).toContainText("behind visible store head")
  await expect(table).toContainText("retrying")
  await expect(page.getByRole("region", { name: "Subscription metrics" })).toContainText(
    "positions behind head",
  )
})

test("dead letters page by cursor and link to their events", async ({ page }) => {
  await open(page, "/")
  const { subscription } = await pins(page, "kiroku")
  await jump(page, `subscription ${subscription}`)
  const table = page.getByRole("grid", { name: "Dead letters" })
  await expect(table.getByRole("row")).toHaveCount(11)
  await page.getByRole("button", { name: "Next" }).click()
  await expect(table.getByRole("row")).toHaveCount(4)
  await table.getByRole("link").first().click()
  await expect(page).toHaveURL(/\/events\//)
})

test("empty states from the recorded (empty) responses", async ({ page }) => {
  await open(page, "/")
  await scenario(page, { recorded: { kiroku: ["dead-letters"] } })
  const { subscription } = await pins(page, "kiroku")
  await jump(page, `subscription ${subscription}`)
  await expect(page.getByText("Nothing parked.")).toBeVisible()
})
