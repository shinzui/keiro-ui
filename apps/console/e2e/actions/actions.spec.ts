import { expect, open, pins, scenario, test } from "../support/mock"

// Scenario state lives in the page, so each test sets it after the first load and then
// navigates client-side (a reload would clear it).

test("disabled gates render disabled controls with the server reason", async ({ page }) => {
  await open(page, "/processors/detailed")
  const control = page.getByRole("region", { name: "Control" })
  await expect(control.getByRole("button", { name: "Pause" })).toBeDisabled()
  await expect(control.getByTestId("control-reason")).toHaveText(
    "Control operations are disabled on the server (enableControl = False)",
  )
  await page.getByRole("link", { name: "Process Managers & Timers" }).first().click()
  await page.getByRole("link", { name: "Timers", exact: true }).first().click()
  await expect(page.getByTestId("gate-reason")).toContainText(
    "Mutations are disabled on this keiro host (start keiro-ops-http with --enable-mutations)",
  )
  const rowMenus = page.getByRole("button", {
    name: /Actions for timer .* \(Mutations are disabled/,
  })
  await expect(rowMenus.first()).toBeDisabled()
})

test("timer requeue: preview (would requeue), typed confirmation, executed (transitioned)", async ({
  page,
}) => {
  await open(page, "/")
  const { timer_id } = await pins(page, "keiro")
  await scenario(page, { mutations: { keiro: "enabled" } })
  await page.getByRole("link", { name: "Process Managers & Timers" }).first().click()
  await page.getByRole("link", { name: "Timers", exact: true }).first().click()
  const row = page.getByRole("button", { name: `Actions for timer ${timer_id}` })
  await expect(row).toBeEnabled({ timeout: 35_000 })
  await row.click()
  await page.getByRole("menuitem", { name: "Requeue…" }).click()
  const flow = page.getByTestId("mutation-flow")
  await expect(flow.getByTestId("preview-headline")).toHaveText("would requeue")
  await expect(flow).toContainText("equivalent CLI command")
  const execute = page.getByRole("button", { name: "Execute" })
  await expect(execute).toBeDisabled()
  await flow.getByRole("textbox", { name: "Confirmation" }).fill(timer_id!)
  await execute.click()
  await expect(flow.getByTestId("result-headline")).toHaveText("transitioned")
  await page.getByRole("button", { name: "Close" }).last().click()
  await expect(page.getByRole("button", { name: "1 action this session" })).toBeVisible()
})

test("a not_found preview never offers Execute", async ({ page }) => {
  await open(page, "/")
  const { timer_id } = await pins(page, "keiro")
  await scenario(page, { mutations: { keiro: "enabled", timerDisposition: "not_found" } })
  await page.getByRole("link", { name: "Process Managers & Timers" }).first().click()
  await page.getByRole("link", { name: "Timers", exact: true }).first().click()
  const row = page.getByRole("button", { name: `Actions for timer ${timer_id}` })
  await expect(row).toBeEnabled({ timeout: 35_000 })
  await row.click()
  await page.getByRole("menuitem", { name: "Cancel…" }).click()
  const flow = page.getByTestId("mutation-flow")
  await expect(flow.getByTestId("preview-headline")).toHaveText("not found")
  await expect(flow.getByTestId("no-change")).toContainText("nothing would change")
  await expect(page.getByRole("button", { name: "Execute" })).toHaveCount(0)
})

test("a schema drift refusal lists the drift", async ({ page }) => {
  await open(page, "/")
  const { timer_id } = await pins(page, "keiro")
  await scenario(page, { mutations: { keiro: "enabled", previewRefusal: "schema_drift" } })
  await page.getByRole("link", { name: "Process Managers & Timers" }).first().click()
  await page.getByRole("link", { name: "Timers", exact: true }).first().click()
  const row = page.getByRole("button", { name: `Actions for timer ${timer_id}` })
  await expect(row).toBeEnabled({ timeout: 35_000 })
  await row.click()
  await page.getByRole("menuitem", { name: "Requeue…" }).click()
  const refusal = page.getByTestId("mutation-flow").getByRole("alert")
  await expect(refusal).toContainText("schema_drift")
  await expect(refusal.getByRole("list", { name: "Schema drift" })).toContainText("keiro_timers")
})
