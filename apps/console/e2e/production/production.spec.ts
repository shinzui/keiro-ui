import { expect, type Page, test } from "@playwright/test"

const version = "0.1.0"

/** Whether the stack answers through the proxy; tier 2 runs only then. */
async function stackAnswers(page: Page): Promise<boolean> {
  const response = await page.request.get("/kiroku/health/live").catch(() => null)
  return response?.status() === 200
}

test.describe("tier 1", () => {
  test("serves the shell at /console/", async ({ page }) => {
    await page.goto("./")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview")
  })

  test("a deep link reload resolves /console/workflows", async ({ page }) => {
    await page.goto("workflows")
    await page.reload()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Workflows")
    expect(new URL(page.url()).pathname).toBe("/console/workflows")
  })

  test("assets are hashed and under the base path", async ({ page }) => {
    await page.goto("./")
    const urls = await page.evaluate(() => [
      ...[...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")!),
      ...[...document.querySelectorAll('link[rel="stylesheet"]')].map((l) =>
        l.getAttribute("href")!,
      ),
    ])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls)
      expect(url).toMatch(/^\/console\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css)$/)
  })

  test("the version slot shows the release", async ({ page }) => {
    await page.goto("./")
    await expect(page.locator("footer")).toContainText(new RegExp(`v${version} · [0-9a-f]{7}`))
  })

  test("health renders honestly whether or not the surfaces answer", async ({ page }) => {
    const up = await stackAnswers(page)
    await page.goto("./")
    const strip = page.getByRole("list", { name: "Surfaces" })
    for (const surface of ["kiroku", "pgmq", "shibuya", "keiro"]) {
      await expect(strip.locator(`[data-strip-surface="${surface}"]`)).toContainText(
        up ? /healthy|busy/ : "unreachable",
        { timeout: 15_000 },
      )
    }
  })
})

test.describe("tier 2", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await stackAnswers(page)),
      "skipped: /kiroku/health/live did not answer through the proxy",
    )
  })

  test("the overview is populated from every surface", async ({ page }) => {
    await page.goto("./")
    for (const card of ["queues", "workflows", "projections", "processors", "store"]) {
      await expect(page.getByTestId(`card-${card}-headline`)).not.toHaveText(/…|unavailable/, {
        timeout: 15_000,
      })
    }
  })

  test("no CORS preflight on a single origin", async ({ page }) => {
    const methods: string[] = []
    page.on("request", (request) => methods.push(request.method()))
    await page.goto("./")
    await expect(page.getByTestId("card-projections-headline")).not.toHaveText("…")
    await page.goto("projections")
    await expect(page.getByTestId("projections-caption")).toContainText("live")
    expect(methods).not.toContain("OPTIONS")
  })

  test("the keiro WebSocket upgrades through the proxy", async ({ page }) => {
    const opened = page.waitForEvent("websocket", (ws) => ws.url().endsWith("/keiro/ws"))
    await page.goto("projections")
    const ws = await opened
    expect(new URL(ws.url()).host).toBe(new URL(page.url()).host)
    await expect(page.getByTestId("projections-caption")).toContainText("live")
  })

  test("pgmq queues answer from the page origin", async ({ page }) => {
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/pgmq/queues")
    await page.goto("queues")
    const answer = await response
    expect(answer.status()).toBe(200)
    expect(new URL(answer.url()).origin).toBe(new URL(page.url()).origin)
  })
})
