import { expect, type Page, test as base } from "@playwright/test"

/** Fails a test on any console error or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on("console", (message) => {
        // With nothing running on the surface ports the health probes fail at the network
        // level; the browser logs those as console errors, which are expected here.
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
          errors.push(message.text())
        }
      })
      page.on("pageerror", (error) => errors.push(error.message))
      await use(errors)
      expect(errors, "console errors").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Navigates and waits until the shell (and its keyboard listeners) has rendered. */
export async function gotoShell(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open command palette" })).toBeVisible()
}

export async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k")
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible()
  await expect(page.getByRole("searchbox")).toBeFocused()
}
