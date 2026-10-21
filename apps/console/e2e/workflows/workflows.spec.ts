import { expect, feedScript, jump, open, pins, test } from "../support/mock"

test("filters round-trip through the URL and survive a reload", async ({ page }) => {
  await open(page, "/workflows")
  await page.getByRole("button", { name: "retrying" }).click()
  await page.getByRole("button", { name: "failed" }).click()
  await page.getByRole("textbox", { name: "Created since" }).fill("2026-10-21T00:00:00Z")
  await page.getByRole("textbox", { name: "Created since" }).press("Enter")
  await expect(page).toHaveURL(/created_since=2026-10-21T00%3A00%3A00Z/)
  await page.reload()
  await expect(page.getByRole("button", { name: "retrying" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.getByRole("button", { name: "failed" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("textbox", { name: "Created since" })).toHaveValue(
    "2026-10-21T00:00:00Z",
  )
  await expect(page.getByTestId("list-caption")).toContainText(
    "time windows and ordering are poll-only",
  )
})

test("paging forward and back", async ({ page }) => {
  await open(page, "/workflows")
  const { workflow_id } = await pins(page, "keiro")
  const table = page.getByRole("grid", { name: "Workflow instances" })
  await expect(table).toContainText(workflow_id!)
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page).toHaveURL(/after=/)
  await expect(table).toContainText(`${workflow_id}-ship`)
  await page.getByRole("button", { name: "Previous" }).click()
  await expect(page).not.toHaveURL(/after=/)
})

test("a feed update changes a row's badge without a reload", async ({ page }) => {
  await open(page, "/")
  const { workflow_id } = await pins(page, "keiro")
  await feedScript(page, "keiro", {
    append: 1,
    intervalMs: 100,
    changedFields: { status: "suspended", status_class: "sleeping" },
  })
  await jump(page, "Go to Workflows › Instances")
  const row = page
    .getByRole("grid", { name: "Workflow instances" })
    .getByRole("row", { name: new RegExp(`${workflow_id}-ship`) })
  await expect(row.locator("[data-status-class]")).toHaveText("sleeping")
  await expect(page.getByTestId("list-caption")).toContainText("live")
})

test("detail tabs follow the URL and the journal-entry sheet reopens after reload", async ({
  page,
}) => {
  await open(page, "/")
  const { workflow_name, workflow_id } = await pins(page, "keiro")
  await jump(page, `workflow ${workflow_name}/${workflow_id}`)
  await expect(page).toHaveURL(`/workflows/${workflow_name}/${workflow_id}`)
  await page.getByRole("tab", { name: "Steps" }).click()
  await expect(page).toHaveURL(/tab=steps/)
  await expect(page.getByRole("grid", { name: "Steps" })).toContainText("charge")
  await page.getByRole("tab", { name: "Journal" }).click()
  await page.getByRole("list", { name: "Journal" }).locator("[data-event-id]").first().click()
  await expect(page).toHaveURL(/sheet=journal-entry/)
  await page.reload()
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "reserve-inventory" }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("tab", { name: "Children" }).click()
  await page.getByRole("link", { name: `${workflow_id}-ship` }).click()
  await expect(page).toHaveURL(`/workflows/ship-order/${workflow_id}-ship`)
})

test("sidebar presets and recents", async ({ page }) => {
  await open(page, "/workflows")
  const { workflow_name, workflow_id } = await pins(page, "keiro")
  await page.getByRole("link", { name: "Failed" }).click()
  await expect(page.getByRole("button", { name: "failed" })).toHaveAttribute("aria-pressed", "true")
  await page.goto(`/workflows/${workflow_name}/${workflow_id}`)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(workflow_id!)
  await page.getByRole("link", { name: "Instances" }).click()
  await expect(page.getByRole("link", { name: `${workflow_name} / ${workflow_id}` })).toBeVisible()
})
