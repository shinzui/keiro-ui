import { expect, gotoShell, openPalette, test } from "./fixtures"

test("⌘K navigates to a page by its title", async ({ page }) => {
  await gotoShell(page, "/")
  await openPalette(page)
  await page.keyboard.type("subs")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/subscriptions\?target=same-origin$/)
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("a typed entity identifier jumps, and the visit appears under Recent", async ({ page }) => {
  await gotoShell(page, "/")
  await openPalette(page)
  await page.keyboard.type("workflow billing/inv-7")
  await expect(page.getByRole("menuitem", { name: "Open workflow billing / inv-7" })).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/workflows\/billing\/inv-7\?target=same-origin$/)

  // The Workflows section sidebar lists the visit under Recent.
  await expect(page.getByRole("link", { name: "billing / inv-7" })).toBeVisible()

  await gotoShell(page, "/streams")
  await openPalette(page)
  await expect(page.getByRole("menuitem", { name: /billing \/ inv-7/ })).toBeVisible()
})

test("the theme action cycles light → dark → system", async ({ page }) => {
  await gotoShell(page, "/")
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await openPalette(page)
  await page.keyboard.type("Toggle theme")
  await page.keyboard.press("Enter")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  await openPalette(page)
  await page.keyboard.type("Toggle theme")
  await page.keyboard.press("Enter")
  // `system` follows the (light) emulated preference.
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
})
