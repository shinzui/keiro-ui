import { expect, open, pins, test } from "../support/mock"

test("kind → instance → browser with both panes, and the split survives a reload", async ({
  page,
}) => {
  await open(page, "/aggregates")
  const keiro = await pins(page, "keiro")
  await page
    .getByRole("grid", { name: "Aggregate kinds" })
    .getByRole("link", { name: "order" })
    .first()
    .click()
  await expect(page).toHaveURL("/aggregates/order?target=same-origin")
  await page.getByRole("link", { name: keiro.aggregate_id!, exact: true }).click()
  await expect(page.getByRole("region", { name: "Stream events" })).toContainText("OrderPlaced")
  await expect(page.getByRole("region", { name: "Folded state" })).toContainText(
    "full replay: snapshot_missed",
  )
  await expect(page.getByRole("region", { name: "Snapshot" })).toContainText("absent")

  const left = page.getByRole("region", { name: "Stream events" })
  const handle = page.locator('[data-slot="resizable-handle"]')
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 200, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  const saved = await page.evaluate(() => localStorage.getItem("keiro-ui.split.aggregate-browser"))
  expect(JSON.parse(saved!).left).toBeLessThan(50)
  const widthBefore = (await left.boundingBox())!.width
  await page.reload()
  await expect(left).toContainText("OrderPlaced")
  expect(Math.abs((await left.boundingBox())!.width - widthBefore)).toBeLessThan(8)

  await left.getByRole("row", { name: /OrderPlaced/ }).click()
  await expect(page).toHaveURL(/sheet=event%3A/)
})
