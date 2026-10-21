import { expect, test } from "./fixtures"

test("four health dots probe the same-origin URLs", async ({ page }) => {
  await page.goto("/")
  const dots = page.locator("[data-surface]")
  await expect(dots).toHaveCount(4)
  await expect(page.locator('[data-surface="kiroku"]')).toHaveAttribute(
    "data-url",
    "http://localhost:5173/kiroku/health/live",
  )
  await expect(page.locator('[data-surface="keiro"]')).toHaveAttribute(
    "data-url",
    "http://localhost:5173/keiro/health",
  )
})

test("a separate profile changes the probed health URL", async ({ page }) => {
  await page.goto("/settings/connections")
  await page.getByRole("button", { name: "New profile" }).click()
  const form = page.getByRole("form", { name: "Connection profile" })
  await form.getByLabel("Name", { exact: true }).fill("Local ports")
  await form.getByLabel("kiroku origin").fill("http://127.0.0.1:9091/api")
  await form.getByRole("button", { name: "Save" }).click()
  await expect(form.getByText("Origin must not contain a path")).toBeVisible()

  await form.getByLabel("kiroku origin").fill("http://127.0.0.1:9091")
  await form.getByLabel("shibuya origin").fill("http://127.0.0.1:9090")
  await form.getByLabel("pgmq origin").fill("http://127.0.0.1:9095")
  await form.getByLabel("keiro origin").fill("http://127.0.0.1:9093")
  await form.getByRole("button", { name: "Save" }).click()
  await expect(form).toHaveCount(0)

  const probe = page.waitForRequest("http://127.0.0.1:9095/health/live")
  await page
    .getByRole("listitem")
    .filter({ hasText: "Local ports" })
    .getByRole("button", { name: "Use this profile" })
    .click()
  await probe
  await expect(page.locator('[data-surface="pgmq"]')).toHaveAttribute(
    "data-url",
    "http://127.0.0.1:9095/health/live",
  )
  await expect(page.getByRole("button", { name: "Connection profile: Local ports" })).toBeVisible()
})

test("pause and resume flip the bottom bar label", async ({ page }) => {
  await page.goto("/")
  const toggle = page.getByRole("button", { name: "Pause live updates" })
  await expect(toggle).toContainText("Live")
  await toggle.click()
  const resume = page.getByRole("button", { name: "Resume live updates" })
  await expect(resume).toContainText(/Paused 00:0\d/)
  await resume.click()
  await expect(page.getByRole("button", { name: "Pause live updates" })).toContainText("Live")
})
