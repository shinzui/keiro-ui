import { expect, test } from "./fixtures"

test("absent optional catalog is a real 404 before legacy development boot", async ({
  page,
  request,
}) => {
  expect((await request.get("/console-config.json")).status()).toBe(404)
  await page.goto("/")
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue("same-origin")
})

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

test("a local target changes the probed health URL and accepts base paths", async ({ page }) => {
  await page.goto("/settings/connections")
  await page.getByRole("button", { name: "New local target" }).click()
  const json = page.getByRole("textbox", { name: "Connections JSON" })
  await json.fill(
    JSON.stringify({
      id: "local-ports",
      label: "Local ports",
      app: "local",
      environment: "dev",
      surfaces: {
        kiroku: "http://127.0.0.1:9091/api",
        shibuya: "http://127.0.0.1:9090",
        pgmq: "http://127.0.0.1:9095",
        keiro: "http://127.0.0.1:9093",
      },
    }),
  )
  await page.getByRole("button", { name: "Save target", exact: true }).click()
  const probe = page.waitForRequest("http://127.0.0.1:9095/health/live")
  await page.getByRole("combobox", { name: "Application" }).selectOption("local-ports")
  await probe
  await expect(page.locator('[data-surface="pgmq"]')).toHaveAttribute(
    "data-url",
    "http://127.0.0.1:9095/health/live",
  )
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue("local-ports")
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
