import { expect, test as base } from "@playwright/test"

/** Fails a test on any console error or uncaught page error. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text())
      })
      page.on("pageerror", (error) => errors.push(error.message))
      await use(errors)
      expect(errors, "console errors").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
