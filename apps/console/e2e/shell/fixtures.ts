import { expect, type Page, test as base } from "@playwright/test"

/** Fails a test on any console error or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on("console", (message) => {
        // Health probes against surfaces that are not running (or, with a separate-origins
        // profile, that send no CORS headers) fail at the network level; the browser logs those
        // as console errors, which are expected here.
        const text = message.text()
        const probeFailure =
          text.startsWith("Failed to load resource") ||
          /^WebSocket connection to 'ws:\/\/localhost:5173\/(keiro|kiroku|pgmq|shibuya)\//.test(
            text,
          ) ||
          text.includes("has been blocked by CORS policy")
        if (message.type() === "error" && !probeFailure) {
          errors.push(text)
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
