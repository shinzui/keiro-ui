import { expect, feedScript, jump, open, pins, test } from "../support/mock"

test("filters round-trip, a feed update lands live, and the stuck tab validates input", async ({
  page,
}) => {
  await open(page, "/")
  const { timer_id, process_manager, correlation_id } = await pins(page, "keiro")
  await feedScript(page, "keiro", { append: 1, intervalMs: 100, changedFields: { attempts: 9 } })
  await jump(page, "Go to Process Managers & Timers › Timers")
  const table = page.getByRole("grid", { name: "Pending timers" })
  await expect(table.getByRole("row", { name: new RegExp(timer_id!.slice(0, 8)) })).toContainText(
    "9",
  )
  await expect(page.getByTestId("timers-caption")).toContainText("live")

  await page.getByRole("textbox", { name: "Manager" }).fill(process_manager!)
  await page.getByRole("textbox", { name: "Correlation" }).fill(correlation_id!)
  await page.getByRole("button", { name: "Filter" }).click()
  await expect(page).toHaveURL(
    new RegExp(`manager=${process_manager}&correlation=${correlation_id}`),
  )

  await page.getByRole("tab", { name: "Stuck" }).click()
  await expect(page.getByRole("grid", { name: "Stuck timers" })).toContainText(
    timer_id!.slice(0, 8),
  )
  await page.getByRole("textbox", { name: "Minimum age" }).fill("five")
  await page.getByRole("button", { name: "Apply" }).click()
  await expect(page.getByRole("alert")).toContainText('invalid duration "five"')
})

test("the palette opens a timer in the sheet, with its payload and gated actions", async ({
  page,
}) => {
  await open(page, "/")
  const { timer_id } = await pins(page, "keiro")
  await jump(page, `timer ${timer_id}`)
  await expect(page).toHaveURL(new RegExp(`/timers\\?sheet=timer%3A${timer_id}`))
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByText("Payload")).toBeVisible()
  await expect(sheet.getByRole("button", { name: "Requeue" })).toBeDisabled()
  await expect(sheet.getByTestId("gate-reason")).toContainText("Mutations are disabled")
})
