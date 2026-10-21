import { expect, gotoShell, openPalette, test } from "./fixtures"

test("the About sheet opens from the palette, survives reload, and closes on Escape", async ({
  page,
}) => {
  await gotoShell(page, "/streams")
  await openPalette(page)
  await page.keyboard.type("About this console")
  await page.keyboard.press("Enter")

  const sheet = page.getByRole("dialog").filter({ hasText: "About this console" })
  await expect(sheet).toBeVisible()
  await expect(page).toHaveURL(/[?&]sheet=about%3Aconsole/)
  await expect(sheet.getByText("http://localhost:5173/kiroku")).toBeVisible()

  await page.reload()
  await expect(page.getByRole("dialog").filter({ hasText: "About this console" })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page).not.toHaveURL(/sheet=/)
})

test("navigating to another section closes the sheet", async ({ page }) => {
  await page.goto("/streams?sheet=about%3Aconsole")
  await expect(page.getByRole("dialog").filter({ hasText: "About this console" })).toBeVisible()
  await page.goBack().catch(() => {})
  await gotoShell(page, "/queues")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("an unregistered sheet kind explains itself", async ({ page }) => {
  await page.goto("/streams?sheet=nonsense%3Ax")
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByText("No inspector registered for nonsense.")).toBeVisible()
  await sheet.getByRole("button", { name: "Close", exact: true }).first().click()
  await expect(page).not.toHaveURL(/sheet=/)
})
