import { expect, feedScript, open, test } from "../support/mock"

test("distances read n/a, caught up, and exact numbers; a feed update lands live", async ({
  page,
}) => {
  await open(page, "/")
  await feedScript(page, "keiro", {
    append: 1,
    intervalMs: 100,
    changedFields: { lifecycle_phase: "rebuilding" },
  })
  await page.getByRole("link", { name: "Projections" }).first().click()
  const table = page.getByRole("grid", { name: "Projection groups" })
  await expect(page.getByTestId("distance-jitsurei-order-search")).toHaveText("caught up")
  await expect(page.getByTestId("distance-jitsurei-order-reporting")).toHaveText("21")
  await expect(page.getByTestId("distance-$legacy-read-model:jitsurei-area-chapters")).toHaveText(
    "n/a",
  )
  await expect(table.getByRole("row", { name: /jitsurei-area-chapters/ })).toContainText(
    "rebuilding",
  )
  await expect(page.getByTestId("projections-caption")).toContainText("live")
  await table.getByRole("link", { name: "jitsurei-order-reporting" }).click()
  await page
    .getByRole("textbox", { name: "Feeding subscription name" })
    .fill("jitsurei-order-reporting")
  await page.getByRole("button", { name: "Show checkpoints" }).click()
  await expect(page.getByTestId("max-distance")).toHaveText("21")
})
