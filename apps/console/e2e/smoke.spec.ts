import { expect, test } from "@playwright/test"

test.use({ colorScheme: "dark" })

test("the production build renders the shell in Paper Mono, light by default", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible()

  // Light is the default even when the browser prefers dark.
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)

  const paperMonoLoaded = await page.evaluate(async () => {
    await document.fonts.ready
    await document.fonts.load('400 16px "Paper Mono"')
    // check() is also true when no face matches, so confirm the vendored face itself loaded.
    const faceLoaded = [...document.fonts].some(
      (face) => face.family.replaceAll('"', "") === "Paper Mono" && face.status === "loaded",
    )
    return faceLoaded && document.fonts.check('400 16px "Paper Mono"')
  })
  expect(paperMonoLoaded).toBe(true)
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Paper Mono/)
})
