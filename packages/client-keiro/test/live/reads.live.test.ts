import { describe, expect, test } from "vitest"

import { createKeiroClient, isRouteUnavailable } from "../../src"

// With the local stack (just stack-up): KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test
const live = process.env.KEIRO_UI_LIVE === "1"
const keiro = createKeiroClient({ baseUrl: "http://127.0.0.1:9093" })

describe.runIf(live)("keiro-ops-http on 9093", () => {
  test("health, timers, projections, shards decode", async () => {
    expect((await keiro.health.get()).status).toBe("ok")
    const pending = await keiro.timers.pending()
    const status = await keiro.projections.status()
    const shards = await keiro.shards.list()
    console.log(
      `keiro live: ${pending.items.length} pending timers, ${status.items.length} projection groups, ${shards.items.length} sharded subscriptions`,
    )
    expect(status.items.length).toBeGreaterThan(0)
  })

  test("the hook-less host answers aggregates with RouteUnavailable", async () => {
    const error = await keiro.aggregates.types().catch((e: unknown) => e)
    expect(isRouteUnavailable(error)).toBe(true)
  })
})
