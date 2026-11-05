import { expect, open, test } from "../support/mock"

test("cards show their headlines and open their sections by mouse and keyboard", async ({
  page,
}) => {
  await open(page, "/")
  await expect(page.getByTestId("card-projections-headline")).toContainText("26")
  await expect(page.getByTestId("card-processors-headline")).toContainText("running")
  await expect(page.getByTestId("mutations")).toHaveText("mutations: disabled on server")
  await page.getByTestId("card-queues").click()
  await expect(page).toHaveURL("/queues?target=same-origin")
  await page.goBack()
  await page.getByTestId("card-timers").focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL("/timers?target=same-origin")
})

test("pausing liveness stops the cards' polling; resuming refetches at once", async ({ page }) => {
  await open(page, "/")
  await expect(page.getByTestId("card-projections-headline")).toContainText("26")
  const reads: string[] = []
  // Health probes are the shell's connectivity check and keep running while paused.
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (/^\/(keiro|kiroku|pgmq|shibuya)\//.test(path) && !/\/health(\/live)?$/.test(path))
      reads.push(path)
  })
  await page.getByRole("button", { name: "Pause live updates" }).click()
  await page.waitForTimeout(16000)
  expect(reads).toEqual([])
  await page.getByRole("button", { name: /Resume live updates/ }).click()
  await expect.poll(() => reads.length).toBeGreaterThanOrEqual(5)
  await expect.poll(() => reads.includes("/keiro/wf/inspect/counts")).toBe(true)
})

test("Overview reads exact totals without sampling the workflow list", async ({ page }) => {
  const reads: string[] = []
  page.on("request", (request) => reads.push(new URL(request.url()).pathname))
  await open(page, "/")
  await expect(page.getByTestId("card-workflows-subtitle")).toContainText("completed 2")
  await expect(page.getByTestId("card-workflows")).not.toContainText(/newest|sample|\+/)
  expect(reads).toContain("/keiro/wf/inspect/counts")
  expect(reads).not.toContain("/keiro/wf/inspect/list")
})
