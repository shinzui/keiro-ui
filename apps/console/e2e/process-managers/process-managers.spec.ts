import { expect, open, pins, test } from "../support/mock"

test("an instance shows its panels and links; an unknown correlation says so", async ({ page }) => {
  await open(page, "/process-managers")
  const { process_manager, correlation_id } = await pins(page, "keiro")
  await page.getByRole("textbox", { name: "Process manager name" }).fill(process_manager!)
  await page
    .getByRole("form", { name: "Open a process manager" })
    .getByRole("button", { name: "Open" })
    .click()
  await page.getByRole("link", { name: correlation_id!, exact: true }).click()
  await expect(page).toHaveURL(`/process-managers/${process_manager}/${correlation_id}`)
  await expect(page.getByRole("region", { name: "Waiting for" })).toContainText(
    "ObserveFulfillmentEvent → FulfillmentIdle",
  )
  await expect(page.getByRole("region", { name: "Last reaction" })).toContainText("unavailable")
  await expect(
    page.getByRole("link", { name: `fulfillment-${correlation_id}` }).last(),
  ).toHaveAttribute("href", `/streams/fulfillment-${correlation_id}`)
  // Recents now offer the manager on the index.
  await page.getByRole("link", { name: "Process managers" }).first().click()
  await expect(page.getByRole("region", { name: "Recently opened" })).toContainText(
    process_manager!,
  )

  await page.goto(`/process-managers/${process_manager}/missing`)
  await expect(
    page.getByText(`No instance of ${process_manager} with correlation missing`),
  ).toBeVisible()
})
