import { expect, feedScript, jump, open, pins, test } from "../support/mock"

const BIG_ID = "9007199254740994"

test("the queue list leads with the oldest age and sorts by a header through the URL", async ({
  page,
}) => {
  await open(page, "/queues")
  const table = page.getByRole("grid", { name: "Queues" })
  const first = table.getByRole("row").nth(1)
  await expect(first).toContainText("dlq_orders")
  await expect(table.getByRole("row").last()).toContainText("empty")
  await table.getByRole("columnheader", { name: /Visible/ }).click()
  await expect(page).toHaveURL(/\/queues\?sort=visible&dir=desc$/)
  await expect(table.getByRole("row").nth(1)).toContainText("console_demo")
  await page.getByRole("textbox", { name: "Filter queues" }).fill("dlq")
  await expect(page).toHaveURL(/q=dlq/)
  await expect(table.getByRole("row")).toHaveCount(4)
})

test("a sheet URL reopens the message; Escape closes it; the full page shows the dead letter", async ({
  page,
}) => {
  await open(page, "/queues")
  const pgmq = await pins(page, "pgmq")
  await page.goto(`/queues/${pgmq.queue}?from=2&sheet=queue-message:${pgmq.queue}/${BIG_ID}`)
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByTestId("message-id")).toHaveText(BIG_ID)
  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
  await expect(page).not.toHaveURL(/sheet=/)
  await expect(page).toHaveURL(/from=2/)

  await page.goto(
    `/queues/${pgmq.dlq_queue}?sheet=queue-message:${pgmq.dlq_queue}/${pgmq.dlq_msg_id}`,
  )
  await page.getByRole("dialog").getByRole("link", { name: "Open full page" }).click()
  await expect(page).toHaveURL(`/queues/${pgmq.dlq_queue}/messages/${pgmq.dlq_msg_id}`)
  const panel = page.getByRole("region", { name: "Dead letter", exact: true })
  await expect(panel).toContainText("poison_message")
  await expect(panel).toContainText("Redrive is not available")
})

test("the big message id renders exactly in the table, the page, and the URL", async ({ page }) => {
  await open(page, "/queues")
  const { queue } = await pins(page, "pgmq")
  await page.goto(`/queues/${queue}?tab=messages&from=2`)
  await expect(page.getByRole("grid", { name: "Messages" })).toContainText(BIG_ID)
  await page.goto(`/queues/${queue}/messages/${BIG_ID}`)
  await expect(page.getByTestId("message-id")).toHaveText(BIG_ID)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Message ${BIG_ID}`)
})

test("the metrics header follows the queue's feed and shows the newest source", async ({
  page,
}) => {
  await open(page, "/")
  const { queue } = await pins(page, "pgmq")
  // poll, then notify: the header ends on the notify-sourced update.
  await feedScript(page, "pgmq", { append: 2, intervalMs: 50 })
  await jump(page, `queue ${queue}`)
  await expect(page).toHaveURL(`/queues/${queue}`)
  const source = page.getByTestId("metrics-source")
  await expect(source).toContainText("notify")
  await expect(source).toContainText("notify-assisted")
  await expect(page.locator('[data-figure="visible"]')).toHaveText("3")
})

test("tabs are URL state and the archive page reloads to the same page", async ({ page }) => {
  await open(page, "/queues")
  const pgmq = await pins(page, "pgmq")
  await page.goto(`/queues/${pgmq.queue}`)
  await page.getByRole("tab", { name: "Archive" }).click()
  await expect(page).toHaveURL(/tab=archive/)
  await expect(page.getByRole("grid", { name: "Archived messages" })).toContainText(
    pgmq.archived_msg_id!,
  )
  await page.reload()
  await expect(page.getByRole("tab", { name: "Archive" })).toHaveAttribute("aria-selected", "true")
  await page.getByRole("tab", { name: "Bindings" }).click()
  await expect(page.getByRole("grid", { name: "Topic bindings" })).toContainText("console.*")
  await page.getByRole("textbox", { name: "Routing key" }).fill("console.demo")
  await page.getByRole("button", { name: "Test" }).click()
  await expect(page.getByRole("list", { name: "Matching queues" })).toContainText(pgmq.queue!)
})
