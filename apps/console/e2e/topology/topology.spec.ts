import { expect, jump, open, scenario, test } from "../support/mock"

test("the section is reachable from the rail and the palette, and shows the mounted document", async ({
  page,
}) => {
  await open(page, "/")
  await page.getByRole("link", { name: "Service Topology" }).first().click()
  await expect(page).toHaveURL("/topology?target=same-origin")
  await expect(page.getByTestId("topology-service")).toHaveText("hospital-capacity")
  await expect(page.getByTestId("topology-shown")).toHaveText("25 declarations")
  await expect(page.getByTestId("topology-caption")).toContainText("not the running binary")

  await open(page, "/workflows")
  await jump(page, "Service Topology")
  await expect(page).toHaveURL("/topology?target=same-origin")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Service topology")
})

test("the filter lives in the URL and survives a reload", async ({ page }) => {
  await open(page, "/topology")
  await page.getByRole("textbox", { name: "Filter declarations by name" }).fill("res")
  await expect(page).toHaveURL("/topology?q=res&target=same-origin")
  await expect(page.getByTestId("topology-shown")).toHaveText("6 of 25 declarations match")
  await page.reload()
  await expect(page.getByRole("textbox", { name: "Filter declarations by name" })).toHaveValue(
    "res",
  )
  await expect(page.getByTestId("topology-shown")).toHaveText("6 of 25 declarations match")
  await page
    .getByRole("navigation", { name: "Filter declarations by kind" })
    .getByRole("link", { name: /^Operations/ })
    .click()
  await expect(page).toHaveURL("/topology?q=res&kind=operation&target=same-origin")
  await expect(page.getByTestId("topology-shown")).toHaveText("2 of 25 declarations match")
})

test("a relation leads to the other declaration, whose page shows the same edge reversed", async ({
  page,
}) => {
  await open(page, "/topology")
  await page
    .getByRole("grid", { name: "Processes" })
    .getByRole("link", { name: "HospitalSurge" })
    .click()
  await expect(page).toHaveURL("/topology/process/HospitalSurge?target=same-origin")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Process HospitalSurge")
  const outgoing = page.getByRole("grid", { name: "Outgoing relations" })
  const saga = outgoing.getByRole("row").filter({ hasText: "keeps its saga in" })
  await expect(saga).toContainText("categoryhospitalSurge")
  await saga.getByRole("link", { name: "Surge" }).click()

  await expect(page).toHaveURL("/topology/aggregate/Surge?target=same-origin")
  await expect(page.getByRole("grid", { name: "Transitions" }).getByRole("row")).toHaveCount(3)
  const back = page
    .getByRole("grid", { name: "Incoming relations" })
    .getByRole("row")
    .filter({ hasText: "is the saga of" })
  await expect(back).toContainText("Process HospitalSurge")
  await back.getByRole("link", { name: "HospitalSurge" }).click()
  await expect(page).toHaveURL("/topology/process/HospitalSurge?target=same-origin")
})

test("an unknown declaration says so", async ({ page }) => {
  await open(page, "/topology/aggregate/Nope")
  await expect(page.getByTestId("topology-no-such-node")).toContainText(
    "No such declaration in the mounted document",
  )
})

test("the map draws the service, filters by group, and focuses by keyboard", async ({ page }) => {
  await open(page, "/topology")
  await page.getByRole("link", { name: "Map", exact: true }).click()
  await expect(page).toHaveURL("/topology/map?target=same-origin")
  const map = page.getByTestId("service-map")
  await expect(map.locator("[data-graph-node]")).toHaveCount(25)
  await expect(page.getByTestId("map-counts")).toContainText("This is the whole service")

  // Turning a group off updates the URL and the hidden counts; a reload keeps the view.
  await page.getByRole("link", { name: /Hide Projections/ }).click()
  await expect(page).toHaveURL(/groups=messaging%2Ccoordination%2Cstate%2Cqueues/)
  await expect(map.locator("[data-graph-node]")).toHaveCount(16)
  await expect(page.getByTestId("map-counts")).toContainText("9 declarations and 14 relations")
  await page.reload()
  await expect(map.locator("[data-graph-node]")).toHaveCount(16)
  await page.getByRole("link", { name: "Show all groups" }).click()
  await expect(map.locator("[data-graph-node]")).toHaveCount(25)

  // Keyboard only: reach a declaration, walk a relation, and make it the focus.
  const process = map.getByRole("button", { name: "Process HospitalSurge" })
  await process.focus()
  await page.keyboard.press("Space")
  await expect(page.getByTestId("map-selection")).toContainText("Process HospitalSurge")
  await page.keyboard.press("ArrowRight")
  await expect(page.locator("[data-graph-node]:focus")).toHaveAttribute(
    "data-graph-node",
    /^aggregate:/,
  )
  await process.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/focus=process%3AHospitalSurge/)
  await expect(page.getByTestId("map-focus")).toContainText("Focused on Process HospitalSurge")
  await expect(map.locator("[data-graph-node]")).toHaveCount(4)

  // From the selection, open the declaration; its page draws the same neighbourhood.
  await map.getByRole("button", { name: "Aggregate Surge" }).click()
  await page.getByTestId("map-selection").getByRole("link", { name: "Open declaration" }).click()
  await expect(page).toHaveURL("/topology/aggregate/Surge?target=same-origin")
  await expect(page.getByTestId("machine-diagram").locator("[data-graph-node]")).toHaveCount(3)
  await expect(
    page.getByRole("region", { name: "Neighbourhood" }).locator("[data-graph-node]"),
  ).toHaveCount(2)
})

test("no box overlaps another on the drawn map, and a machine's selection reaches its table", async ({
  page,
}) => {
  await open(page, "/topology/map")
  const boxes = await page
    .getByTestId("service-map")
    .locator("[data-graph-node] > rect:first-of-type")
    .evaluateAll((rects) =>
      rects.map((rect) => {
        const b = rect.getBoundingClientRect()
        return { x: b.x, y: b.y, r: b.right, b: b.bottom }
      }),
    )
  expect(boxes).toHaveLength(25)
  const overlaps = boxes.flatMap((a, i) =>
    boxes.slice(i + 1).filter((o) => a.x < o.r && o.x < a.r && a.y < o.b && o.y < a.b),
  )
  expect(overlaps).toEqual([])
  // Labels fit their boxes: the text is drawn in the typeface the sizes assume.
  const overflow = await page
    .getByTestId("service-map")
    .locator("[data-graph-node]")
    .evaluateAll(
      (nodes) =>
        nodes.filter((node) => {
          const box = node.querySelector("rect")!.getBoundingClientRect()
          const text = node.querySelector("text")!.getBoundingClientRect()
          return text.left < box.left || text.right > box.right
        }).length,
    )
  expect(overflow).toBe(0)

  await open(page, "/topology/aggregate/Reservation")
  await page.locator('[data-transition="ReservationHeld#1"]').click()
  await expect(page.locator('[data-transition-row="ReservationHeld#1"]')).toHaveAttribute(
    "data-transition-selected",
    "true",
  )
  await page.locator('[data-transition-row="ReservationConfirmed#0"]').click()
  await expect(page.locator('[data-transition="ReservationConfirmed#0"]')).toHaveAttribute(
    "data-selected",
    "true",
  )
})

test("the recorded host disagrees with its document; a declaration says why it has no link", async ({
  page,
}) => {
  await open(page, "/topology")
  const section = page.getByRole("region", { name: "Document and host" })
  await expect(section).toContainText("Document and host disagree.")
  await expect(section.getByRole("list", { name: "Declared but not mounted" })).toContainText(
    "Reservation",
  )
  await expect(
    section.getByRole("list", { name: "Mounted but not declared" }).getByRole("listitem"),
  ).toHaveText(["credit-limit", "incident", "order"])
  await section.getByRole("link", { name: "Reservation" }).click()
  await expect(page.getByTestId("live-no-match")).toContainText(
    "No mounted aggregate type is named reservation",
  )
  await open(page, "/topology/workqueue/reservation_work")
  await expect(page.getByTestId("live-unjoinable")).toContainText("Not linked.")
})

test("SYNTHETIC joined host: from a declaration to its live screen and back through the panel", async ({
  page,
}) => {
  // The scenario lives in the page, so it is set before any catalogue is read and every
  // step after it navigates client-side.
  await open(page, "/settings/connections")
  await scenario(page, { joined: true })
  await jump(page, "Service Topology")
  await expect(page.getByTestId("agreement-agrees")).toContainText(
    "The mounted aggregates match the document",
  )
  await page
    .getByRole("grid", { name: "Aggregates" })
    .getByRole("link", { name: "Reservation" })
    .click()
  await page.getByRole("link", { name: "Instances of reservation" }).click()
  await expect(page).toHaveURL("/aggregates/reservation?target=same-origin")

  const panel = page.getByTestId("declaration-panel")
  await expect(panel).toContainText("Aggregate Reservation")
  await panel.getByRole("button", { name: "Show the declared state machine" }).click()
  await expect(panel.getByTestId("machine-diagram").locator("[data-graph-node]")).toHaveCount(6)
  await panel.getByRole("link", { name: "Reservation" }).click()
  await expect(page).toHaveURL("/topology/aggregate/Reservation?target=same-origin")

  // The process links to the manager the host built with its saga category, and back.
  await jump(page, "Service Topology")
  await page
    .getByRole("grid", { name: "Processes" })
    .getByRole("link", { name: "HospitalSurge" })
    .click()
  await page.getByRole("link", { name: "Instances of hospital-surge" }).click()
  await expect(page).toHaveURL("/process-managers/hospital-surge?target=same-origin")
  await expect(page.getByTestId("declaration-panel")).toContainText("Process HospitalSurge")
  await page.getByTestId("declaration-panel").getByRole("link", { name: "HospitalSurge" }).click()
  await expect(page).toHaveURL("/topology/process/HospitalSurge?target=same-origin")
})

test("live screens of the recorded host carry no declaration panel", async ({ page }) => {
  await open(page, "/aggregates/order")
  await expect(page.getByRole("grid", { name: "Aggregate instances" })).toBeVisible()
  await expect(page.getByTestId("declaration-panel")).toHaveCount(0)
})
