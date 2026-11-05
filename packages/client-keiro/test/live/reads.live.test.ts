import { describe, expect, test } from "vitest"
import { z } from "zod"

import { createKeiroClient } from "../../src"

// With the local stack (just stack-up): KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-keiro test
const live = process.env.KEIRO_UI_LIVE === "1"
const keiro = createKeiroClient({ baseUrl: "http://127.0.0.1:9093" })

describe.runIf(live)("keiro-ops-http on 9093", () => {
  test("released counts and category consumers decode through public methods", async () => {
    const global = await keiro.workflows.counts()
    expect(Object.keys(global.counts)).toHaveLength(7)
    expect(typeof global.counts.running).toBe("bigint")
    const named = await keiro.workflows.counts({ workflow_name: "order-fulfillment" })
    expect(named.observed_at).toBeTypeOf("string")
    const missing = await keiro.workflows.counts({ workflow_name: "keiro-ui-counts-missing" })
    expect(Object.values(missing.counts)).toEqual(Array(7).fill(0n))
    const order = await keiro.projections.consumers({ category: "order", limit: 100 })
    expect(order.items.map((item) => item.name)).toContain("jitsurei-order-reporting")
    const empty = await keiro.projections.consumers({ category: "creditLimit", limit: 100 })
    expect(empty.items).toEqual([])
    expect(empty.coverage).toEqual({ projection_catalog: true, durable_subscribers: false })
    expect((await keiro.projections.consumers({ category: "order", limit: 1 })).items).toHaveLength(
      1,
    )
  })

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

  test("jitsurei-ops-http mounts the hook-gated catalogs", async () => {
    const aggregates = await keiro.aggregates.types()
    expect(aggregates.items.map((item) => item.name)).toEqual(
      expect.arrayContaining(["credit-limit", "incident", "order"]),
    )
  })

  // The console's representative producer/consumer check for the new routes
  // (docs/masterplans/3-support-the-new-keiro-runtime-ops-apis-in-the-console.md). Temporary
  // schemas until the sibling plans add these to the client.
  test("the new routes answer in the documented shapes", async () => {
    const get = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:9093${path}`)
      expect(response.status).toBe(200)
      return (await response.json()) as unknown
    }

    const pmTypes = z
      .object({
        items: z.array(
          z.object({
            name: z.string(),
            category: z.string(),
            snapshots_configured: z.boolean(),
            snapshot_policy: z.string(),
            timers_configured: z.boolean().nullable(),
          }),
        ),
      })
      .parse(await get("/pm/types"))
    expect(pmTypes.items.map((item) => item.name)).toContain("jitsurei-fulfillment")

    const status = z
      .object({
        items: z.array(
          z.object({ group_id: z.string(), feeding_subscriptions: z.array(z.string()) }),
        ),
      })
      .parse(await get("/projection/status?limit=100"))
    expect(status.items.length).toBeGreaterThan(0)

    const list = z
      .object({ items: z.array(z.object({ aggregate_id: z.string(), stream_name: z.string() })) })
      .parse(await get("/aggregate/list?name=credit-limit&limit=1"))
    const instance = list.items[0]
    expect(instance).toBeDefined()
    const snapshot = z
      .object({
        stream: z.string(),
        stream_version: z.number(),
        state: z.object({ registers: z.record(z.string(), z.unknown()) }),
        state_codec_version: z.number(),
        state_bytes: z.number(),
        created_at: z.string(),
        updated_at: z.string(),
      })
      .parse(await get(`/snapshot/show?stream=${encodeURIComponent(instance!.stream_name)}`))
    expect(snapshot.stream).toBe(instance!.stream_name)

    expect(await get("/snapshot/show?stream=order-missing")).toBeNull()
  })
})
