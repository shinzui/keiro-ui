import { expect, open, pins, scenario, test } from "../support/mock"

test("an instance shows its panels and links; an unknown correlation says so", async ({ page }) => {
  await open(page, "/process-managers")
  const { process_manager, correlation_id } = await pins(page, "keiro")
  // The catalog names the manager; nobody types anything.
  const catalog = page.getByRole("grid", { name: "Process managers" })
  await expect(page.getByRole("textbox", { name: "Process manager name" })).toHaveCount(0)
  await expect(page.getByTestId(`timers-${process_manager}`)).toHaveText("unknown")
  await catalog.getByRole("link", { name: process_manager!, exact: true }).click()
  await page.getByRole("link", { name: correlation_id!, exact: true }).click()
  await expect(page).toHaveURL(
    `/process-managers/${process_manager}/${correlation_id}?target=same-origin`,
  )
  await expect(page.getByRole("region", { name: "Waiting for" })).toContainText(
    "ObserveFulfillmentEvent → FulfillmentIdle",
  )
  await expect(page.getByRole("region", { name: "Last reaction" })).toContainText("unavailable")
  await expect(
    page.getByRole("link", { name: `fulfillment-${correlation_id}` }).last(),
  ).toHaveAttribute("href", `/streams/fulfillment-${correlation_id}?target=same-origin`)
  // A host that cannot list its managers offers recents instead.
  await scenario(page, { fail: { keiro: ["pm-types"] } })
  await page.getByRole("link", { name: "Process managers" }).first().click()
  await expect(page.getByRole("region", { name: "Recently opened" })).toContainText(
    process_manager!,
  )

  await page.goto(`/process-managers/${process_manager}/missing`)
  await expect(
    page.getByText(`No instance of ${process_manager} with correlation missing`),
  ).toBeVisible()
})
