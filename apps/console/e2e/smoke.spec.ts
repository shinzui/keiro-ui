import { expect, test } from "@playwright/test"

test.use({ colorScheme: "dark" })

test("placeholder page renders in Paper Mono, light by default, with theme toggle and sheet", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "keiro runtime console" })).toBeVisible()

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

  await page.getByRole("button", { name: "Use dark theme" }).click()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)

  await page.getByRole("button", { name: "Open inspector" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible()
})
