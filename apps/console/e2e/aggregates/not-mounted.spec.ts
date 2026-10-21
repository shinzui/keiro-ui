import { expect, open, scenario, test } from "../support/mock"

test("hosts without the inspection hooks say so for aggregates and process managers", async ({
  page,
}) => {
  await open(page, "/")
  await scenario(page, { fail: { keiro: ["aggregate-types", "pm-list"] } })
  await page.getByRole("link", { name: "Aggregates" }).first().click()
  const state = page.getByTestId("not-mounted")
  await expect(state).toContainText("Aggregate inspection is not mounted on this keiro host")
  await expect(state).toContainText("/keiro/aggregate/types")
  await expect(state).toContainText("dev/README.md")

  // Client-side navigation keeps the page's scenario.
  await page.getByRole("link", { name: "Process Managers & Timers" }).first().click()
  await page.getByRole("textbox", { name: "Process manager name" }).fill("jitsurei-fulfillment")
  await page
    .getByRole("form", { name: "Open a process manager" })
    .getByRole("button", { name: "Open" })
    .click()
  await expect(state).toContainText("Process-manager inspection is not mounted on this keiro host")
  await expect(state).toContainText("/keiro/pm/list")
})
