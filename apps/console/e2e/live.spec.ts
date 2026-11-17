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

test("exact workflow counts and category declarations use the released reads", async ({
  page,
  request,
}) => {
  const countsRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/wf/inspect/counts") && response.status() === 200,
  )
  await page.goto("/")
  const counts = (await (await countsRead).json()).counts
  await expect(page.getByTestId("card-workflows-headline")).toHaveText(String(counts.running))
  const subtitle = page.getByTestId("card-workflows-subtitle")
  for (const status of ["retrying", "sleeping", "awaiting", "completed", "cancelled", "failed"]) {
    await expect(subtitle).toContainText(`${status} ${counts[status]}`)
  }
  const api = await (await request.get("/keiro/wf/inspect/counts")).json()
  expect(api.counts).toEqual(counts)
  const consumersRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/projection/consumers") &&
      response.status() === 200,
  )
  await page.goto("/categories/order")
  expect((await (await consumersRead).json()).category).toBe("order")
  const panel = page.getByRole("region", { name: "Declared consumers" })
  await expect(panel).toContainText("Durable subscriber metadata: unavailable")
  await expect(panel).toContainText("inline")
  await expect(
    panel.getByRole("link", { name: "jitsurei-order-audit-subscription", exact: true }),
  ).toBeVisible()
  await panel.getByRole("link", { name: "jitsurei-order-reporting", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("jitsurei-order-reporting")
  await page.goto("/categories/creditLimit")
  await expect(panel).toContainText("No matching consumers in the reported metadata")
  await expect(panel).toContainText("Durable subscriber metadata: unavailable")
})

test("the service topology section shows the document the stack's keiro host mounts", async ({
  page,
  request,
}) => {
  const reads: string[] = []
  page.on("request", (req) => {
    const path = new URL(req.url()).pathname
    if (path.startsWith("/keiro/topology/")) reads.push(`${req.method()} ${path}`)
  })
  await page.goto("/topology")
  // dev/process-compose.yaml mounts keiro's hospital-capacity golden, which describes another
  // service than Jitsurei by design.
  await expect(page.getByTestId("topology-service")).toHaveText("hospital-capacity")
  const api = await (await request.get("/keiro/topology/summary")).json()
  await expect(page.getByTestId("topology-schema")).toHaveText(api.schema_id)
  const digest = api.document_sha256 as string
  await expect(page.getByTestId("topology-digest").locator("code")).toHaveAttribute("title", digest)
  for (const [kind, count] of Object.entries(api.node_counts as Record<string, number>))
    await expect(page.getByTestId(`topology-count-${kind}`)).toHaveText(String(count))
  await expect(page.getByTestId("topology-node-total")).toHaveText(
    String(Object.values(api.node_counts as Record<string, number>).reduce((a, b) => a + b, 0)),
  )
  // Only GETs, and the document itself is fetched once (twice under the dev server's StrictMode).
  expect(reads.every((read) => read.startsWith("GET "))).toBe(true)
  expect(reads).toContain("GET /keiro/topology/summary")
  expect(reads.filter((read) => read.endsWith("/show")).length).toBeLessThanOrEqual(2)

  await page
    .getByRole("grid", { name: "Aggregates" })
    .getByRole("link", { name: "Reservation" })
    .click()
  await expect(page.getByRole("list", { name: "States" }).getByRole("listitem")).toHaveCount(6)
  await expect(page.getByRole("grid", { name: "Transitions" }).getByRole("row")).toHaveCount(7)
})

test("the service map draws the mounted document and a machine diagram", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/topology/map")
  const map = page.getByTestId("service-map")
  await expect(map.locator("[data-graph-node]")).toHaveCount(25)
  await expect(page.getByTestId("map-counts")).toContainText(
    "Drawing 25 of 25 declarations and 27 of 27 relations",
  )
  await page.goto("/topology/map?focus=aggregate:Reservation")
  await expect(map.locator("[data-graph-node]")).toHaveCount(2)
  await page.goto("/topology/aggregate/Reservation")
  const diagram = page.getByTestId("machine-diagram")
  await expect(diagram.locator("[data-graph-node]")).toHaveCount(6)
  await expect(diagram.locator("[data-transition]")).toHaveCount(6)
  expect(errors).toEqual([])
})

test("the default stack's document and host disagree, and the console says how", async ({
  page,
  request,
}) => {
  // Jitsurei is hand-written and serves a document about another service, by design.
  const mounted = (
    (await (await request.get("/keiro/aggregate/types")).json()) as { items: { name: string }[] }
  ).items.map((item) => item.name)
  expect(mounted.length).toBeGreaterThan(0)
  await page.goto("/topology")
  const section = page.getByRole("region", { name: "Document and host" })
  await expect(section).toContainText("Document and host disagree.")
  await expect(
    section.getByRole("list", { name: "Mounted but not declared" }).getByRole("listitem"),
  ).toHaveText(mounted)
  await expect(
    section.getByRole("list", { name: "Declared but not mounted" }).getByRole("listitem"),
  ).toHaveCount(5)

  await page.goto("/topology/aggregate/Reservation")
  await expect(page.getByTestId("live-no-match")).toContainText(
    "No mounted aggregate type is named reservation",
  )
  await page.goto("/topology/workqueue/reservation_work")
  await expect(page.getByTestId("live-unjoinable")).toContainText("Not linked.")
  // The live screens are as before: no panel, since nothing declared here is running.
  await page.goto(`/aggregates/${mounted[0]}`)
  await expect(page.getByRole("grid", { name: "Aggregate instances" })).toBeVisible()
  await expect(page.getByTestId("declaration-panel")).toHaveCount(0)
})

// The mori profile (`just stack-up mori`) mounts mori's own topology on the hook-less
// standalone host. Run alone: KEIRO_UI_LIVE=1 KEIRO_UI_LIVE_PROFILE=mori bunx playwright test
// --config playwright.live.config.ts -g "mori profile". The cases above assume the default profile.
test("mori profile: a real service's own topology, with every join answering honestly", async ({
  page,
  request,
}) => {
  test.skip(process.env.KEIRO_UI_LIVE_PROFILE !== "mori", "set KEIRO_UI_LIVE_PROFILE=mori")
  const summary = (await (await request.get("/keiro/topology/summary")).json()) as {
    service: string
    node_counts: Record<string, number>
    members: unknown[]
  }
  expect(summary.service).toBe("mori")
  expect(summary.members.length).toBeGreaterThan(1)
  const total = Object.values(summary.node_counts).reduce((a, b) => a + b, 0)

  await page.goto("/topology")
  await expect(page.getByTestId("topology-service")).toHaveText("mori")
  await expect(page.getByTestId("topology-node-total")).toHaveText(String(total))
  // The standalone host mounts no aggregate hooks: the comparison cannot be made, and that is
  // said, not reported as agreement or as an empty host.
  await expect(page.getByTestId("agreement-cannot-compare")).toContainText("Cannot compare")

  const aggregate = page.getByRole("grid", { name: "Aggregates" }).getByRole("link").first()
  await aggregate.click()
  await expect(page.getByTestId("live-not-mounted")).toContainText(
    "does not mount the inspection hooks",
  )
  await expect(page.getByTestId("machine-diagram")).toBeVisible()

  // Every projection owner mori declares is delivered inline, so none has a subscription.
  await page.goto("/topology?kind=projection-owner")
  await page.getByRole("grid", { name: "Projection owners" }).getByRole("link").first().click()
  await expect(page.getByTestId("live-inline")).toContainText("delivered inline")

  // More declarations than the map draws at once: it asks for a starting point.
  await page.goto("/topology/map")
  await expect(page.getByTestId("map-too-large")).toContainText(`${total} declarations`)
  await page.getByRole("link", { name: /^Only State/ }).click()
  await expect(page.getByTestId("service-map").locator("[data-graph-node]")).toHaveCount(
    summary.node_counts.aggregate!,
  )
})
