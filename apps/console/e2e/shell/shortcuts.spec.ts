import { expect, gotoShell, openPalette, test } from "./fixtures"

test("[ collapses the sidebar, ? opens help, g s goes to Streams", async ({ page }) => {
  await gotoShell(page, "/")
  const sidebar = page.locator('[data-slot="sidebar"]').first()
  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await page.keyboard.press("[")
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")

  await page.keyboard.press("?")
  const help = page.getByRole("dialog").filter({ hasText: "Keyboard shortcuts" })
  await expect(help).toBeVisible()
  await expect(help.getByText("Go to Streams")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(help).toHaveCount(0)

  await page.keyboard.press("g")
  await page.keyboard.press("s")
  await expect(page).toHaveURL(/\/streams$/)
})

test("shortcuts do not fire while typing in the palette", async ({ page }) => {
  await gotoShell(page, "/")
  const sidebar = page.locator('[data-slot="sidebar"]').first()
  await openPalette(page)
  const input = page.getByRole("searchbox")
  await page.keyboard.type("[g s?")
  await expect(input).toHaveValue("[g s?")
  await expect(sidebar).toHaveAttribute("data-state", "expanded")
  await expect(page).toHaveURL(/\/$/)
})
