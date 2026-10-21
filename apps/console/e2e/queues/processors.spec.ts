import { expect, feedScript, jump, open, pins, test } from "../support/mock"

test("a stopped terminal frame moves the processor under Terminal", async ({ page }) => {
  await open(page, "/")
  const { processor } = await pins(page, "shibuya")
  await feedScript(page, "shibuya", { append: 1, intervalMs: 50, terminal: "stopped" })
  await jump(page, "Go to Queues & Processors › Processors")
  const terminal = page.getByRole("region", { name: "Terminal" })
  await expect(terminal.getByRole("row", { name: new RegExp(processor!) })).toContainText("stopped")
  await expect(page.getByTestId("readiness")).toContainText("3 healthy")
})

test("the oldest in-flight age keeps counting between frames", async ({ page }) => {
  await open(page, "/processors")
  const { processor } = await pins(page, "shibuya")
  const age = page.getByTestId(`oldest-${processor}`)
  await expect(age).not.toHaveText("—")
  const parse = async () => Number.parseFloat((await age.textContent()) ?? "")
  const before = await parse()
  await expect.poll(parse, { timeout: 5000 }).toBeGreaterThan(before)
})

test("the palette jumps to a processor whose Control card reads disabled", async ({ page }) => {
  await open(page, "/")
  const { processor } = await pins(page, "shibuya")
  await jump(page, `processor ${processor}`)
  await expect(page).toHaveURL(`/processors/${processor}`)
  await expect(page.getByRole("region", { name: "Control" })).toContainText("Control enabled: no")
  await expect(
    page.getByRole("region", { name: "Control" }).getByRole("button", { name: "Pause" }),
  ).toBeDisabled()
  await expect(page.getByTestId("latency-histogram").locator('[data-bar="bucket"]')).toHaveCount(18)
  await expect(page.getByText("estimated from histogram buckets")).toBeVisible()
})

test("a processor without detail and an unknown processor", async ({ page }) => {
  await open(page, "/processors/idle")
  await expect(page.getByText("latency detail not enabled on this host")).toBeVisible()
  await page.goto("/processors/does-not-exist")
  await expect(page.getByText("Processor not found").first()).toBeVisible()
})
