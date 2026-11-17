import { stackOrigin } from "@keiro-ui/testing/stack"
import { describe, expect, test } from "vitest"
import { WebSocket as WsClient } from "ws"

import { createKirokuClient } from "../src"

// With the local stack (just stack-up): KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-kiroku test
const live = process.env.KEIRO_UI_LIVE === "1"
const base = stackOrigin("kiroku") // STACK_KIROKU_PORT in dev/.env, default 9091
const kiroku = createKirokuClient({ baseUrl: base })

describe.runIf(live)(`kiroku-inspect at ${base}`, () => {
  test("capabilities, paging $all to the end, and one event by id", async () => {
    const capabilities = await kiroku.capabilities()
    console.log(`kiroku ${capabilities.package} ${capabilities.version}`)
    let from: bigint | undefined = 0n
    let seen = 0
    let lastId = ""
    while (from !== undefined) {
      const page = await kiroku.events.all({ from, limit: 5 })
      seen += page.items.length
      lastId = page.items.at(-1)?.eventId ?? lastId
      from = page.nextCursor
    }
    expect(seen).toBeGreaterThan(0)
    expect((await kiroku.events.get(lastId)).eventId).toBe(lastId)
  })

  test("/ws/events starts at the current head", async () => {
    const socket = new WsClient(`${base.replace(/^http/, "ws")}/ws/events`)
    const first = await new Promise<string>((resolve, reject) => {
      socket.on("open", () => socket.send('{"type":"subscribe_events"}'))
      socket.on("message", (data) => resolve(String(data)))
      setTimeout(() => reject(new Error("no frame within 5 s")), 5000)
    })
    socket.close()
    expect(JSON.parse(first).type).toBe("event_stream_started")
  })
})
