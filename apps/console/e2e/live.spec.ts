import { expect, test } from "@playwright/test"

// Skipped unless KEIRO_UI_LIVE=1: every list screen against the EP-9 stack, through the Vite
// proxy, with liveness on. Each list shows rows or its honest empty state; the stack mounts hooks,
// so nothing here may report "not mounted".

test.skip(
  process.env.KEIRO_UI_LIVE !== "1",
  "set KEIRO_UI_LIVE=1 with the stack and `bun run dev` running",
)

const lists: string[] = [
  "/streams",
  "/categories",
  "/events",
  "/subscriptions",
  "/queues",
  "/processors",
  "/workflows",
  "/process-managers",
  "/timers",
  "/aggregates",
  "/projections",
  "/shards",
]

test("every section renders against the live stack", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  for (const surface of ["kiroku", "pgmq", "shibuya", "keiro"]) {
    await expect(
      page.getByRole("list", { name: "Surfaces" }).locator(`[data-strip-surface="${surface}"]`),
    ).toHaveAttribute("data-health", "up", { timeout: 15_000 })
  }
  await expect(page.getByTestId("card-queues-headline")).not.toHaveText("…")

  for (const path of lists) {
    await page.goto(path)
    const main = page.getByRole("main")
    const grid = main.getByRole("grid").first()
    await expect(grid).toBeVisible()
    // At least one data row, or the table's own empty state; never a stuck "Loading…".
    await expect(grid).not.toContainText("Loading…", { timeout: 15_000 })
  }
  expect(errors).toEqual([])
})

test("the stack's keiro host mounts aggregates and process managers", async ({ page }) => {
  await page.goto("/aggregates")
  const main = page.getByRole("main")
  for (const name of ["credit-limit", "incident", "order"]) {
    await expect(main.locator(`a[href^="/aggregates/${name}?"]`)).toBeVisible()
  }
  await expect(main.getByTestId("not-mounted")).toHaveCount(0)

  let catalogReads = 0
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/pm/types")) catalogReads += 1
  })
  await page.goto("/process-managers")
  await expect(main.getByTestId("timers-jitsurei-fulfillment")).toHaveText("unknown")
  await expect(main.getByRole("textbox", { name: "Process manager name" })).toHaveCount(0)
  // Longer than keiro's 5 s poll: the catalog is not re-read. The dev server's StrictMode can read
  // it twice at mount, so this compares counts rather than expecting one.
  const atMount = catalogReads
  await page.waitForTimeout(6_000)
  expect(catalogReads).toBe(atMount)
  await main.getByRole("link", { name: "jitsurei-fulfillment", exact: true }).click()
  await expect(main.getByRole("link", { name: /^demo-/ }).first()).toBeVisible()
  await expect(main.getByTestId("not-mounted")).toHaveCount(0)
})

test("a processor's Control card reports the host's disabled gate with its reason", async ({
  page,
}) => {
  await page.goto("/processors/orders")
  const control = page.getByRole("region", { name: "Control" })
  await expect(control).toContainText("Control enabled: no")
  await expect(control).toContainText("Control operations are disabled on the server")
  await expect(control).not.toContainText("no control surface")
})

test("a group shows the subscription keiro reports; an unmanaged group says it has none", async ({
  page,
}) => {
  const positions: string[] = []
  const checkpoints: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith("/projection/position")) positions.push(url.search)
    if (url.pathname.endsWith("/subscription-checkpoints")) checkpoints.push(url.pathname)
  })
  await page.goto("/projections")
  await expect(page.getByTestId("subscriptions-jitsurei-order-reporting")).toHaveText(
    "jitsurei-order-audit-subscription",
  )
  await page.goto("/projections/jitsurei-order-reporting")
  await expect(page.getByTestId("feeding-subscriptions")).toContainText(
    "jitsurei-order-audit-subscription",
  )
  await expect(page.getByRole("grid", { name: "Members" })).toBeVisible()
  expect(new Set(positions)).toEqual(new Set(["?subscription=jitsurei-order-audit-subscription"]))
  expect(checkpoints).toEqual([])

  positions.length = 0
  await page.goto(`/projections/${encodeURIComponent("$legacy-read-model:jitsurei-area-chapters")}`)
  await expect(page.getByTestId("no-feeding-subscription")).toBeVisible()
  expect(positions).toEqual([])
})

test("a credit-limit aggregate shows registers, then its stored snapshot on request", async ({
  page,
}) => {
  const reads: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/snapshot/show")) reads.push(request.url())
  })
  await page.goto("/aggregates/credit-limit")
  const main = page.getByRole("main")
  await main
    .getByRole("link", { name: /^registers-/ })
    .first()
    .click()
  const registers = main.getByRole("region", { name: "Registers" })
  await expect(registers.getByTestId("register-balance")).toHaveText("25")
  await expect(registers.getByTestId("register-active")).toHaveText("false")
  expect(reads).toEqual([])

  const card = main.getByRole("region", { name: "Stored snapshot" })
  await card.getByRole("button", { name: "Read stored snapshot" }).click()
  await expect(card.getByTestId("comparison-versions")).toHaveText(
    "current at state version 1, stored at stream version 1",
  )
  await expect(card.getByTestId("difference-balance")).toHaveText("")

  // An incident's policy is `never`: no registers, and no stored row.
  await page.goto("/aggregates/incident")
  await main.locator('a[href^="/aggregates/incident/"]').first().click()
  await expect(main.getByRole("region", { name: "Folded state" })).toBeVisible()
  await expect(main.getByRole("region", { name: "Registers" })).toHaveCount(0)
  await main
    .getByRole("region", { name: "Stored snapshot" })
    .getByRole("button", { name: "Read stored snapshot" })
    .click()
  await expect(main.getByTestId("stored-snapshot-none")).toBeVisible()
})
