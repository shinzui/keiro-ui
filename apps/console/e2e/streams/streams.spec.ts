import { expect, jump, open, pins, test } from "../support/mock"

test("streams list pages by cursor and filters by category", async ({ page }) => {
  await open(page, "/streams")
  const table = page.getByRole("grid", { name: "Streams" })
  await expect(table.getByRole("row")).toHaveCount(11) // header + 10 recorded
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page).toHaveURL(/from=/)
  await expect(table.getByRole("row").nth(1)).toBeVisible()
  await page.getByRole("button", { name: "Previous" }).click()
  await expect(page).not.toHaveURL(/from=/)

  const { category } = await pins(page, "kiroku")
  await page.getByLabel("Category").fill(category!)
  await page.getByRole("button", { name: "Filter" }).click()
  await expect(page).toHaveURL(new RegExp(`category=${category}`))
  await expect(table.getByRole("row").nth(1)).toContainText(category!)
})

test("a stream's events open the event sheet, which survives reload", async ({ page }) => {
  await open(page, "/")
  const { stream } = await pins(page, "kiroku")
  await jump(page, `stream ${stream}`)
  await expect(page.getByRole("heading", { level: 1, name: stream })).toBeVisible()
  const events = page.getByRole("grid", { name: `Events in ${stream}` })
  await expect(events.getByRole("row").nth(1)).toContainText("OrderPlaced")
  await events.getByRole("row").nth(1).click()
  await expect(page).toHaveURL(/sheet=event%3A/)
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByText("Payload")).toBeVisible()
  await page.reload()
  await expect(page.getByRole("dialog").getByText("Payload")).toBeVisible()
})

test("the direction toggle reads newest first", async ({ page }) => {
  await open(page, "/")
  const { stream } = await pins(page, "kiroku")
  await jump(page, `stream ${stream}`)
  await page.getByRole("radio", { name: "Newest first" }).click()
  await expect(page).toHaveURL(/direction=backward/)
  const events = page.getByRole("grid", { name: `Events in ${stream}` })
  await expect(events.getByRole("row").nth(1)).not.toContainText("OrderPlaced")
})

test("categories list and a category's events", async ({ page }) => {
  await open(page, "/categories")
  const { category } = await pins(page, "kiroku")
  await page.getByRole("link", { name: category, exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: `Category ${category}` })).toBeVisible()
  await expect(
    page
      .getByRole("grid", { name: `Events in category ${category}` })
      .getByRole("row")
      .nth(1),
  ).toBeVisible()
})
