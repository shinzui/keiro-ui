import { describe, expect, test } from "vitest"
import { WebSocket as WsClient } from "ws"

import { createPgmqClient } from "../src"

// With the local stack (just stack-up): KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-pgmq test
const live = process.env.KEIRO_UI_LIVE === "1"
const base = "http://127.0.0.1:9095"
const pgmq = createPgmqClient({ baseUrl: base })

describe.runIf(live)("pgmq-inspect on 9095", () => {
  test("queues and the first queue's first page", async () => {
    const queues = await pgmq.queues.list()
    expect(queues.length).toBeGreaterThan(0)
    const page = await pgmq.messages.page(queues[0]!.queue_name, { limit: 10 })
    console.log(
      `pgmq ${queues[0]!.queue_name}: ${page.items.map((m) => String(m.msg_id)).join(", ")}`,
    )
  })

  test("the surface is GET-only: HEAD answers 405", async () => {
    const response = await fetch(`${base}/queues`, { method: "HEAD" })
    expect(response.status).toBe(405)
  })

  test("/ws answers a subscribe with a snapshot", async () => {
    const queue = (await pgmq.queues.list())[0]!.queue_name
    const socket = new WsClient(`ws://127.0.0.1:9095/ws`)
    const first = await new Promise<string>((resolve, reject) => {
      socket.on("open", () => socket.send(JSON.stringify({ type: "subscribe", queue })))
      socket.on("message", (data) => resolve(String(data)))
      setTimeout(() => reject(new Error("no frame within 5 s")), 5000)
    })
    socket.close()
    expect(JSON.parse(first).type).toBe("snapshot")
  })
})
