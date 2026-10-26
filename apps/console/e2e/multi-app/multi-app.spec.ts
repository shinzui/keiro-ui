import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, type Page } from "@playwright/test"
const ports = {
  orders: process.env.ORDERS_PORT ?? "19193",
  billing: process.env.BILLING_PORT ?? "19293",
}
const fixture = (app: keyof typeof ports, path: string) => `http://127.0.0.1:${ports[app]}${path}`
const timer = "7b2f6a0e-5c1d-4e8a-9f3b-2d6c8a1e4f01"
const workflow = "workflow-20261021202320830171000000"
async function openFlow(page: Page, app: string) {
  await page.goto(`timers?target=prod-${app}`)
  await page.getByRole("button", { name: `Actions for timer ${timer}` }).click()
  await page.getByRole("menuitem", { name: "Requeue…" }).click()
  await expect(page.getByTestId("preview-headline")).toHaveText("would requeue")
}

const configPath = () => join(process.env.MULTI_APP_CONFIG_DIR!, "console-config.json")
const originalConfig = readFileSync(
  fileURLToPath(new URL("../../../../dev/multi-app/console-config.json", import.meta.url)),
  "utf8",
)
test.beforeEach(async ({ request }) => {
  writeFileSync(configPath(), originalConfig)
  for (const app of ["orders", "billing"] as const)
    await request.post(fixture(app, "/__control"), { data: { reset: true, closeFeeds: true } })
})

test("same-ID reads and real feed exchanges switch together, links reload and tabs stay independent", async ({
  page,
  context,
  request,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("workflows?target=prod-orders")
  const grid = page.getByRole("grid", { name: "Workflow instances" })
  await expect(grid).toContainText(workflow)
  await expect(grid).toContainText("completed")
  const link = grid.getByRole("link", { name: workflow })
  await expect(link).toHaveAttribute("href", /target=prod-orders/)
  const href = await link.getAttribute("href")
  const other = await context.newPage()
  await other.goto(href!)
  await expect(other.getByRole("combobox", { name: "Application" })).toHaveValue("prod-orders")
  await page.getByRole("combobox", { name: "Application" }).selectOption("prod-billing")
  await expect(page).toHaveURL(/console\/\?target=prod-billing$/)
  await page.goto("workflows?target=prod-billing")
  await expect(grid).toContainText("failed")
  await expect(other.getByRole("combobox", { name: "Application" })).toHaveValue("prod-orders")
  await page.reload()
  await expect(grid).toContainText("failed")
  for (const app of ["orders", "billing"] as const)
    await expect
      .poll(
        async () =>
          (await (await request.get(fixture(app, "/__journal"))).json()).filter(
            (row: any) => row.method === "WS" && row.frame.feed === "workflows",
          ).length,
      )
      .toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test("late Orders reads and feed frames cannot enter Billing, and history restores selection", async ({
  page,
  request,
}) => {
  await request.post(fixture("orders", "/__control"), { data: { delayMs: 800 } })
  await page.goto("workflows?target=prod-orders")
  await page.getByRole("combobox", { name: "Application" }).selectOption("prod-billing")
  await page.getByRole("link", { name: "Workflows", exact: true }).first().click()
  await expect(page.getByRole("grid", { name: "Workflow instances" })).toContainText("failed")
  await request.post(fixture("orders", "/__control"), {
    data: {
      frame: {
        type: "snapshot",
        feed: "workflows",
        sequence: 99,
        items: [],
        observed_at: new Date().toISOString(),
      },
    },
  })
  await page.waitForTimeout(1000)
  await expect(page.getByRole("grid", { name: "Workflow instances" })).toContainText("failed")
  await page.goBack()
  await page.goBack()
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue("prod-orders")
})

test("both apps preview/execute through the proxy and delayed completion retains origin", async ({
  page,
  request,
}) => {
  for (const app of ["orders", "billing"] as const) {
    await openFlow(page, app)
    await expect(page.getByRole("dialog", { name: "Requeue timer" })).toContainText(`${app} · prod`)
    await page.getByRole("textbox", { name: "Confirmation" }).fill(timer)
    await page.getByRole("button", { name: "Execute", exact: true }).click()
    await expect(page.getByTestId("result-headline")).toHaveText("transitioned")
    const posts = (await (await request.get(fixture(app, "/__journal"))).json()).filter(
      (r: any) => r.method === "POST",
    )
    expect(posts.map((r: any) => r.body)).toEqual(["", '{"confirm":"execute"}'])
    expect(posts.every((r: any) => r.path === `/keiro/timer/requeue/${timer}`)).toBe(true)
  }
  await request.post(fixture("orders", "/__control"), { data: { executeDelayMs: 700 } })
  await openFlow(page, "orders")
  await page.getByRole("textbox", { name: "Confirmation" }).fill(timer)
  await page.getByRole("button", { name: "Execute", exact: true }).click()
  // Browser navigation through an anchor keeps this tab's audit while retiring the session.
  await page.evaluate(() => {
    ;(document.querySelector('[aria-label="Application"]') as HTMLSelectElement).value =
      "prod-billing"
    document
      .querySelector('[aria-label="Application"]')!
      .dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue("prod-billing")
  await page.waitForTimeout(800)
  await page.getByRole("button", { name: /actions? this session/ }).click()
  await expect(page.getByRole("dialog")).toContainText("orders · prod")
  await expect(page.getByRole("dialog")).toContainText("transitioned")
})

test("worker changes discard confirmations; optional and unknown selections send no fallback requests", async ({
  page,
  request,
}) => {
  await page.goto("processors/detailed?target=prod-orders&worker=jobs-1")
  await page
    .getByRole("region", { name: "Control", exact: true })
    .getByRole("button", { name: "Pause", exact: true })
    .click()
  await expect(page.getByRole("alertdialog")).toContainText("jobs-1")
  await page.evaluate(() => {
    const select = document.querySelector('[aria-label="Worker"]') as HTMLSelectElement
    select.value = "subscriptions-1"
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await expect(page).toHaveURL(/worker=subscriptions-1/)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await page.goto("processors/detailed?target=prod-orders&worker=subscriptions-1")
  await page
    .getByRole("region", { name: "Control", exact: true })
    .getByRole("button", { name: "Pause", exact: true })
    .click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause", exact: true }).click()
  const posts = (await (await request.get(fixture("orders", "/__journal"))).json()).filter(
    (r: any) => r.method === "POST",
  )
  expect(posts).toHaveLength(1)
  expect(posts[0].worker).toBe("subscriptions-1")
  const paths: string[] = []
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/inspection")) paths.push(req.url())
  })
  await page.goto("queues?target=prod-billing")
  await expect(page.getByText("Not configured for this application", { exact: true })).toBeVisible()
  expect(paths.some((p) => p.includes("/pgmq"))).toBe(false)
  paths.length = 0
  await page.goto("workflows?target=unknown")
  await expect(page.getByRole("alert")).toContainText("Application unavailable")
  expect(paths).toEqual([])
})

test("proxy fails closed for unknown and forbidden HTTP/WebSocket routes; catalog is uncached JSON", async ({
  page,
  request,
}) => {
  const cfg = await request.get("console-config.json")
  expect(cfg.headers()["content-type"]).toContain("application/json")
  expect(cfg.headers()["cache-control"]).toBe("no-store")
  for (const [prefix, status] of [
    ["/inspection/unknown/keiro", 404],
    ["/inspection/forbidden/keiro", 403],
  ] as const) {
    expect((await request.get(`${prefix}/health`)).status()).toBe(status)
    expect(
      (
        await request.get(`${prefix}/ws`, {
          headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
            "Sec-WebSocket-Version": "13",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          },
        })
      ).status(),
    ).toBe(status)
  }
  await page.goto("workflows?target=prod-orders")
  await expect(page.getByRole("heading", { name: "Workflows", exact: true })).toBeVisible()
})

test("catalog additions need no rebuild; malformed catalogs fail closed with Retry", async ({
  page,
}) => {
  const assets = fileURLToPath(new URL("../../dist-multi-app/assets/", import.meta.url))
  const hashes = () =>
    readdirSync(assets).map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(assets, file)))
        .digest("hex"),
    ])
  const before = hashes()
  const config = JSON.parse(originalConfig)
  config.targets.push({
    ...config.targets[1],
    id: "staging-billing",
    label: "Staging Billing",
    environment: "staging",
  })
  writeFileSync(configPath(), JSON.stringify(config))
  await page.goto("workflows?target=staging-billing")
  await expect(page.getByRole("combobox", { name: "Application" })).toHaveValue("staging-billing")
  await expect(page.getByRole("grid", { name: "Workflow instances" })).toContainText("failed")
  expect(hashes()).toEqual(before)
  writeFileSync(configPath(), "<html>wrong configuration</html>")
  await page.reload()
  await expect(page.getByRole("heading", { name: "Console configuration error" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
  writeFileSync(configPath(), originalConfig)
  await page.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("alert")).toContainText("Application unavailable: staging-billing")
})

test("proxy preserves encoded entity IDs, query strings, bodies and browser Origin", async ({
  request,
}) => {
  const origin = "http://127.0.0.1:" + (process.env.MULTI_APP_PORT ?? "18080")
  await request.get(
    "/inspection/prod/orders/kiroku/streams/order%2Fencoded?from=9007199254740993",
    { headers: { Origin: origin } },
  )
  const journal = await (await request.get(fixture("orders", "/__journal"))).json()
  expect(
    journal.some(
      (row: any) =>
        row.path === "/kiroku/streams/order%2Fencoded" &&
        row.query === "?from=9007199254740993" &&
        row.origin === origin,
    ),
  ).toBe(true)
})

test("worker state and availability stay bound to one logical replica", async ({
  page,
  request,
}) => {
  await page.goto("processors/detailed?target=prod-orders&worker=jobs-1")
  await page
    .getByRole("region", { name: "Control", exact: true })
    .getByRole("button", { name: "Pause", exact: true })
    .click()
  await request.post(fixture("orders", "/__control"), {
    data: { worker: "jobs-1", unavailable: true },
  })
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  const journal = await (await request.get(fixture("orders", "/__journal"))).json()
  expect(journal.filter((row: any) => row.method === "POST")).toEqual([])
  expect(journal.some((row: any) => row.worker === "subscriptions-1")).toBe(false)
  expect(
    (await request.get("/inspection/prod/orders/workers/jobs-1/shibuya/metrics")).status(),
  ).toBe(503)
  await request.post(fixture("orders", "/__control"), {
    data: { worker: "jobs-1", unavailable: false },
  })
  await page.reload()
  await page
    .getByRole("region", { name: "Control", exact: true })
    .getByRole("button", { name: "Pause", exact: true })
    .click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause", exact: true }).click()
  const jobs = await (
    await request.get("/inspection/prod/orders/workers/jobs-1/shibuya/metrics")
  ).json()
  const subscriptions = await (
    await request.get("/inspection/prod/orders/workers/subscriptions-1/shibuya/metrics")
  ).json()
  expect(jobs.detailed.state.status).toBe("paused")
  expect(subscriptions.detailed.state.status).toBe("processing")
  expect(jobs.detailed.stats.processed).not.toBe(subscriptions.detailed.stats.processed)
})

test("identical queue and processor IDs resolve to each app's own data when configured", async ({
  page,
}) => {
  const config = JSON.parse(originalConfig)
  config.targets[1].surfaces.pgmq = "/inspection/prod/billing/pgmq"
  config.targets[1].surfaces.shibuya = "/inspection/prod/billing/shibuya"
  writeFileSync(configPath(), JSON.stringify(config))
  for (const [app, count] of [
    ["orders", "101"],
    ["billing", "202"],
  ] as const) {
    await page.goto(`queues?target=prod-${app}`)
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "console_demo", exact: true }) })
    await expect(row).toContainText(count)
    await page.goto(`processors/detailed?target=prod-${app}`)
    await expect(page.getByRole("region", { name: "Counters" })).toContainText(
      app === "orders" ? "101" : "201",
    )
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("detailed")
  }
})
