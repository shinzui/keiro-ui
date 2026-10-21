import { expect, test } from "@playwright/test"

// WARNING: this spec MUTATES the stack it points at. It pauses and resumes a shibuya processor
// and requeues a keiro timer. Run it only against a scratch database and a mutation-enabled
// stack (keiro-ops-http --enable-mutations; shibuya with enableControl = True and
// corsAllowedOrigins = ["http://localhost:5173"]) — never against production:
//   KEIRO_UI_LIVE_MUTATIONS=1 bunx playwright test --config playwright.live.config.ts actions
// Each step reads the authoritative state back over HTTP before it passes. If interrupted,
// resume the processor by hand: curl -X POST http://127.0.0.1:9090/control/processors/<id>/resume

test.skip(
  process.env.KEIRO_UI_LIVE_MUTATIONS !== "1",
  "mutates its target stack; set KEIRO_UI_LIVE_MUTATIONS=1 against a scratch, mutation-enabled stack",
)

const processor = process.env.KEIRO_UI_LIVE_PROCESSOR ?? "orders"

test("pause and resume a processor, reading its state back", async ({ page, request }) => {
  await page.goto(`/processors/${processor}`)
  const control = page.getByRole("region", { name: "Control" })
  await control.getByRole("button", { name: "Pause" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause" }).click()
  await expect
    .poll(
      async () => (await (await request.get(`/shibuya/metrics/${processor}`)).json()).state.status,
    )
    .toBe("paused")
  await control.getByRole("button", { name: "Resume" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Resume" }).click()
  await expect
    .poll(
      async () => (await (await request.get(`/shibuya/metrics/${processor}`)).json()).state.status,
    )
    .not.toBe("paused")
})

test("requeue a pending timer, reading the ledger back", async ({ page, request }) => {
  const pending = await (await request.get("/keiro/timer/pending/list?limit=1")).json()
  const timerId: string | undefined = pending.items[0]?.timer_id
  test.skip(!timerId, "the target stack has no pending timer to requeue")
  await page.goto(`/timers?sheet=timer:${timerId}`)
  await page.getByRole("dialog").getByRole("button", { name: "Requeue" }).click()
  const flow = page.getByTestId("mutation-flow")
  await expect(flow.getByTestId("preview-headline")).toBeVisible()
  if ((await flow.getByTestId("no-change").count()) > 0) return
  await flow.getByRole("textbox", { name: "Confirmation" }).fill(timerId!)
  await page.getByRole("button", { name: "Execute" }).click()
  await expect(flow.getByTestId("result-headline")).toBeVisible()
  const after = await (await request.get("/keiro/timer/pending/list?limit=100")).json()
  expect(after.items.some((t: { timer_id: string }) => t.timer_id === timerId)).toBe(true)
})
