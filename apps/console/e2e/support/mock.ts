import { expect, type Page, test as base } from "@playwright/test"

type Surface = "kiroku" | "pgmq" | "shibuya" | "keiro"

/** Fails on console errors (except network probe noise) like the shell fixture. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on("console", (message) => {
        const text = message.text()
        if (
          message.type() === "error" &&
          !text.startsWith("Failed to load resource") &&
          !text.includes("blocked by CORS policy")
        )
          errors.push(text)
      })
      page.on("pageerror", (error) => errors.push(error.message))
      await use(errors)
      expect(errors, "console errors").toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** Opens a path in mock mode and waits for the shell and the mock worker. */
export async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.waitForFunction(() => window.__keiroUiMock !== undefined)
}

export function pins(page: Page, surface: Surface): Promise<Record<string, string>> {
  return page.evaluate((s) => window.__keiroUiMock!.pins(s), surface)
}

export function feedScript(page: Page, surface: Surface, options: Record<string, unknown>) {
  return page.evaluate(([s, o]) => window.__keiroUiMock!.feedScript(s, o), [
    surface,
    options,
  ] as const)
}

export function scenario(
  page: Page,
  value: {
    fail?: Partial<Record<Surface, string[]>>
    recorded?: Partial<Record<Surface, string[]>>
  },
) {
  return page.evaluate((v) => window.__keiroUiMock!.useScenario(v), value)
}

/** Client-side navigation through the palette, keeping the page's mock state. */
export async function jump(page: Page, text: string) {
  await page.keyboard.press("ControlOrMeta+k")
  await expect(page.getByRole("searchbox")).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press("Enter")
}
