import { describe, expect, test } from "vitest"
import { WebSocket as WsClient } from "ws"

import { createShibuyaClient } from "../src"

// With the local stack (just stack-up): KEIRO_UI_LIVE=1 bun run --filter @keiro-ui/client-shibuya test
const live = process.env.KEIRO_UI_LIVE === "1"
const shibuya = createShibuyaClient({ baseUrl: "http://127.0.0.1:9090" })

describe.runIf(live)("shibuya-metrics on 9090", () => {
  test("the processor map decodes; record which detail fields the host serves", async () => {
    const map = await shibuya.metrics.all()
    expect(Object.keys(map).length).toBeGreaterThan(0)
    for (const [id, record] of Object.entries(map)) {
      const present = (["latency", "oldestInFlight", "progress"] as const).filter(
        (field) => record[field] !== undefined,
      )
      console.log(
        `shibuya ${id}: ${record.state.status}; detail fields: ${present.join(", ") || "none (basic metrics)"}`,
      )
    }
  })

  test("/ws starts with a snapshot", async () => {
    const socket = new WsClient("ws://127.0.0.1:9090/ws")
    const first = await new Promise<string>((resolve, reject) => {
      socket.on("message", (data) => resolve(String(data)))
      setTimeout(() => reject(new Error("no frame within 5 s")), 5000)
    })
    socket.close()
    expect(JSON.parse(first).type).toBe("snapshot")
  })
})
