import { expect, test } from "@playwright/test"

// Skipped unless KEIRO_UI_LIVE=1: every list screen against the EP-9 stack, through the Vite
// proxy, with liveness on. Each list shows rows or its honest empty state; the stack mounts hooks,
// so nothing here may report "not mounted".

test.skip(
  process.env.KEIRO_UI_LIVE !== "1",
  "set KEIRO_UI_LIVE=1 with the stack and `bun run dev` running",
)

const lists: [path: string, ready: string][] = [
  ["/streams", "grid"],
  ["/categories", "grid"],
  ["/events", "grid"],
  ["/subscriptions", "grid"],
  ["/queues", "grid"],
  ["/processors", "grid"],
  ["/workflows", "grid"],
  ["/process-managers", "form"],
  ["/timers", "grid"],
  ["/aggregates", "grid"],
  ["/projections", "grid"],
  ["/shards", "grid"],
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

  for (const [path, ready] of lists) {
    await page.goto(path)
    const main = page.getByRole("main")
    if (ready === "form") {
      await expect(main.getByRole("form").first()).toBeVisible()
    } else {
      const grid = main.getByRole("grid").first()
      await expect(grid).toBeVisible()
      // At least one data row, or the table's own empty state; never a stuck "Loading…".
      await expect(grid).not.toContainText("Loading…", { timeout: 15_000 })
    }
  }
  expect(errors).toEqual([])
})
