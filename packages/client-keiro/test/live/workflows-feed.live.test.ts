import { execSync } from "node:child_process"

import { parseJsonLossless } from "@keiro-ui/client-core"
import { describe, expect, test } from "vitest"
import { WebSocket as WsClient } from "ws"

import { createKeiroClient } from "../../src"
import type { WorkflowInstance } from "../../src"
import { type FeedState, mergeFeedFrame, workflowKey, workflowOrder } from "../../src/feeds"

// MasterPlan early check 3: the workflows feed reconciles to /wf/inspect/list.
//   KEIRO_UI_LIVE=1 KEIRO_UI_LIVE_TRIGGER='cd <keiro> && nix develop --quiet -c just jitsurei-workflow' \
//     bun run --filter @keiro-ui/client-keiro test -- test/live/workflows-feed.live.test.ts
const live = process.env.KEIRO_UI_LIVE === "1"
const trigger = process.env.KEIRO_UI_LIVE_TRIGGER
const keiro = createKeiroClient({ baseUrl: "http://127.0.0.1:9093" })

const ids = (items: WorkflowInstance[]) => items.map((item) => workflowKey(item))

describe.runIf(live)("workflows feed reconcile", () => {
  test("snapshot and updates equal the list read", async () => {
    let state: FeedState<WorkflowInstance> | undefined
    let updates = 0
    const socket = new WsClient("ws://127.0.0.1:9093/ws")
    socket.on("message", (data) => {
      const frame = parseJsonLossless(String(data)) as { type: string; feed?: string } & Record<
        string,
        unknown
      >
      if (frame.feed !== "workflows" || (frame.type !== "snapshot" && frame.type !== "update"))
        return
      if (frame.type === "update") updates += 1
      state = mergeFeedFrame(state, frame, workflowKey, workflowOrder)
    })
    await new Promise<void>((resolve) => socket.on("open", () => resolve()))
    socket.send(JSON.stringify({ type: "subscribe", feed: "workflows", limit: 100 }))
    await expect.poll(() => state !== undefined, { timeout: 5000 }).toBe(true)
    expect(ids(state!.items)).toEqual(ids((await keiro.workflows.list({ limit: 100 })).items))

    if (trigger) {
      execSync(trigger, { stdio: "ignore", shell: "/bin/bash" })
      await expect.poll(() => updates, { timeout: 30_000, interval: 250 }).toBeGreaterThan(0)
      // Give the shared driver one refresh interval to settle, then compare again.
      await new Promise((resolve) => setTimeout(resolve, 2000))
      expect(ids(state!.items)).toEqual(ids((await keiro.workflows.list({ limit: 100 })).items))
    }
    socket.close()
    console.log(`reconciled: true (${state!.items.length} workflows, ${updates} updates)`)
  }, 600_000)
})
