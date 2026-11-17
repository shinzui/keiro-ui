import { expect, jump, open, test } from "../support/mock"

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
