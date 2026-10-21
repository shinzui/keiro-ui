import { ws, type WebSocketHandler } from "msw"

import { fixtureText, hasFixture, manifests } from "./fixtures"
import { arrayElements, fieldText, objectMembers, stringField } from "./json-text"
import { kirokuLog } from "./kiroku-log"
import { type FeedOptions, scenarioState } from "./scenario"
import type { Surface } from "./types"

// Scripted WebSocket feeds, one per dialect. Every frame body comes from the recorded poll
// fixture of the same data, so a console reconciling pushes against polls (ADR-3) sees the
// same keys. Frames are written as text so int64 values stay exact.

type Client = Parameters<Parameters<ReturnType<typeof ws.link>["addEventListener"]>[1]>[0]["client"]

const openClients = new Set<{ client: Client; stop: () => void }>()

function options(
  surface: Surface,
  defaults: Required<Pick<FeedOptions, "append" | "dropped" | "intervalMs">>,
): FeedOptions & typeof defaults {
  return { ...defaults, ...scenarioState.feeds[surface] }
}

function links(path: string) {
  return [ws.link(`ws://*${path}`), ws.link(`wss://*${path}`)]
}

/** Tracks a connection's timers so close and reset stop them. */
function track(client: Client) {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const entry = {
    client,
    stop: () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },
  }
  openClients.add(entry)
  client.addEventListener("close", () => {
    entry.stop()
    openClients.delete(entry)
  })
  return {
    later(ms: number, fn: () => void) {
      const timer = setTimeout(() => {
        timers.delete(timer)
        fn()
      }, ms)
      timers.add(timer)
    },
    stop: entry.stop,
  }
}

function parse(data: unknown): Record<string, unknown> | null {
  try {
    const value = JSON.parse(String(data)) as unknown
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Sends `goodbye` to every open scripted connection and stops their scripts. */
export function closeFeeds(): void {
  for (const { client, stop } of openClients) {
    stop()
    try {
      client.send('{"type":"goodbye"}')
      client.close()
    } catch {
      // Already closed.
    }
  }
  openClients.clear()
}

// --- kiroku /ws/events --------------------------------------------------------------------

function kirokuEvents(): WebSocketHandler[] {
  return links("/kiroku/ws/events").map((link) =>
    link.addEventListener("connection", ({ client }) => {
      const tail = track(client)
      client.addEventListener("message", (event) => {
        const message = parse(event.data)
        if (!message) {
          client.send(
            '{"type":"error","code":"invalid_message","message":"expected a JSON object"}',
          )
          return
        }
        if (message.type === "ping") return client.send('{"type":"pong"}')
        if (message.type === "unsubscribe_events") return tail.stop()
        if (message.type !== "subscribe_events") return
        tail.stop()
        const category = typeof message.category === "string" ? message.category : undefined
        // Numbers above 2^53 arrive rounded through JSON.parse; read the digits instead.
        const fromText = /"from_position"\s*:\s*(\d+)/.exec(String(event.data))?.[1]
        const from = fromText === undefined ? kirokuLog.head() : BigInt(fromText)
        client.send(`{"type":"event_stream_started","from_position":${from}}`)
        if (fromText !== undefined) {
          for (const text of kirokuLog.after(from, category))
            client.send(`{"type":"event","event":${text}}`)
        }
        const { append, dropped, intervalMs, overflowAfter } = options("kiroku", {
          append: 3,
          dropped: 2,
          intervalMs: 250,
        })
        let pushed = 0
        const step = () => {
          if (pushed >= append) return
          const text = kirokuLog.append({ category })
          client.send(`{"type":"event","event":${text}}`)
          pushed += 1
          if (overflowAfter !== undefined && pushed === overflowAfter) {
            for (let i = 0; i < dropped; i += 1) kirokuLog.append({ category })
            client.send(
              '{"type":"error","code":"event_stream_overflowed","message":"event stream overflowed; 3 undelivered batch(es) dropped since the last notice; re-read from your last position"}',
            )
          }
          tail.later(intervalMs, step)
        }
        tail.later(intervalMs, step)
      })
    }),
  )
}

// --- kiroku /ws/metrics -------------------------------------------------------------------

function kirokuMetricsBody(): string {
  const recorded =
    scenarioState.recorded.kiroku?.includes("metrics") && hasFixture("kiroku/metrics.recorded.json")
  return fixtureText(recorded ? "kiroku/metrics.recorded.json" : "kiroku/metrics.json")
}

function kirokuMetrics(): WebSocketHandler[] {
  return links("/kiroku/ws/metrics").map((link) =>
    link.addEventListener("connection", ({ client }) => {
      const feed = track(client)
      const { intervalMs } = options("kiroku", { append: 3, dropped: 2, intervalMs: 1000 })
      const push = () => {
        client.send(`{"type":"snapshot","metrics":${kirokuMetricsBody()}}`)
        feed.later(intervalMs, push)
      }
      push()
      client.addEventListener("message", (event) => {
        const message = parse(event.data)
        if (message?.type === "ping") client.send('{"type":"pong"}')
        else if (message?.type === "unsubscribe_metrics") feed.stop()
        else if (message?.type === "subscribe_metrics") {
          feed.stop()
          push()
        }
      })
    }),
  )
}

// --- pgmq /ws -----------------------------------------------------------------------------

function pgmqQueueMetrics(queue: string): string | undefined {
  for (const element of arrayElements(fixtureText("pgmq/metrics.json"))) {
    if (stringField(element, "queue_name") === queue) return element
  }
  return queue === manifests.pgmq.pins.queue ? fixtureText("pgmq/queue-metrics.json") : undefined
}

function pgmq(): WebSocketHandler[] {
  return links("/pgmq/ws").map((link) =>
    link.addEventListener("connection", ({ client }) => {
      const feed = track(client)
      client.addEventListener("message", (event) => {
        const message = parse(event.data)
        if (!message) return
        if (message.type === "ping") return client.send('{"type":"pong"}')
        const queue = typeof message.queue === "string" ? message.queue : ""
        if (message.type === "unsubscribe") return feed.stop()
        if (message.type !== "subscribe") return
        const metrics = pgmqQueueMetrics(queue)
        if (!metrics) {
          client.send(
            `{"type":"error","code":"queue_not_found","message":"queue does not exist","queue":${JSON.stringify(queue)}}`,
          )
          return
        }
        client.send(
          `{"type":"snapshot","queue":${JSON.stringify(queue)},"metrics":${metrics},"push":true}`,
        )
        const { append, intervalMs, overflowAfter } = options("pgmq", {
          append: 3,
          dropped: 2,
          intervalMs: 250,
        })
        let pushed = 0
        const step = () => {
          if (pushed >= append) return
          const source = pushed % 2 === 0 ? "poll" : "notify"
          client.send(
            `{"type":"update","queue":${JSON.stringify(queue)},"metrics":${metrics},"source":"${source}"}`,
          )
          pushed += 1
          if (overflowAfter !== undefined && pushed === overflowAfter) {
            client.send(
              '{"type":"error","code":"overflow","message":"The server dropped frames because this connection was not reading them; re-subscribe or re-read the queue over HTTP.","queue":null}',
            )
          }
          feed.later(intervalMs, step)
        }
        feed.later(intervalMs, step)
      })
    }),
  )
}

// --- shibuya /ws --------------------------------------------------------------------------

function shibuya(): WebSocketHandler[] {
  return links("/shibuya/ws").map((link) =>
    link.addEventListener("connection", ({ client }) => {
      const feed = track(client)
      const metrics = fixtureText("shibuya/metrics.json")
      const processors = objectMembers(metrics)
      const snapshot = () => client.send(`{"type":"snapshot","metrics":${metrics}}`)
      const { append, intervalMs, overflowAfter, terminal } = options("shibuya", {
        append: 3,
        dropped: 2,
        intervalMs: 250,
      })
      let pushed = 0
      const step = () => {
        if (pushed >= append) {
          if (terminal) {
            const processor = manifests.shibuya.pins.processor ?? processors[0]?.[0] ?? ""
            client.send(
              terminal === "failed"
                ? `{"type":"terminal","processor":${JSON.stringify(processor)},"status":"failed","error":"handler raised an exception","messageId":null}`
                : `{"type":"terminal","processor":${JSON.stringify(processor)},"status":"stopped"}`,
            )
          }
          return
        }
        const [processor, body] = processors[pushed % Math.max(processors.length, 1)] ?? ["", "{}"]
        client.send(`{"type":"update","processor":${JSON.stringify(processor)},"metrics":${body}}`)
        pushed += 1
        if (overflowAfter !== undefined && pushed === overflowAfter) {
          client.send(
            '{"type":"error","code":"queue_overflow","message":"deltas were dropped; a replacement snapshot follows"}',
          )
          snapshot()
        }
        feed.later(intervalMs, step)
      }
      snapshot()
      feed.later(intervalMs, step)
      client.addEventListener("message", (event) => {
        const message = parse(event.data)
        if (!message) {
          client.send(
            '{"type":"error","code":"invalid_message","message":"expected a JSON object"}',
          )
        } else if (message.type === "ping") {
          client.send('{"type":"pong"}')
        } else if (["subscribe_all", "subscribe", "unsubscribe"].includes(String(message.type))) {
          // Each subscription change establishes a new snapshot boundary.
          snapshot()
        }
      })
    }),
  )
}

// --- keiro /ws ----------------------------------------------------------------------------

const keiroFeedSources: Record<string, string> = {
  workflows: "keiro/workflows-created-desc.json",
  timers: "keiro/timers-pending.json",
  projection_groups: "keiro/projection-status.json",
}

function keiro(): WebSocketHandler[] {
  return links("/keiro/ws").map((link) =>
    link.addEventListener("connection", ({ client }) => {
      const feed = track(client)
      client.addEventListener("message", (event) => {
        const message = parse(event.data)
        if (!message) {
          client.send(
            '{"type":"error","code":"invalid_message","message":"expected a JSON object"}',
          )
          return
        }
        if (message.type === "ping") return client.send('{"type":"pong"}')
        const name = String(message.feed ?? "")
        if (message.type === "unsubscribe") {
          feed.stop()
          return client.send(`{"type":"unsubscribed","feed":${JSON.stringify(name)}}`)
        }
        if (message.type !== "subscribe") return
        const source = keiroFeedSources[name]
        if (!source) {
          client.send(
            `{"type":"error","code":"unknown_feed","message":"unknown feed","feed":${JSON.stringify(name)}}`,
          )
          return
        }
        const body = fixtureText(source)
        const items = fieldText(body, "items") ?? "[]"
        const first = arrayElements(body, "items")[0]
        let sequence = 0
        const frame = (fields: string) =>
          `{"type":"%T","feed":${JSON.stringify(name)},"sequence":${sequence},${fields}}`
        client.send(
          frame(
            `"trigger":"subscribe","observed_at":"${new Date().toISOString()}","items":${items}`,
          ).replace("%T", "snapshot"),
        )
        const { append, intervalMs, overflowAfter } = options("keiro", {
          append: 3,
          dropped: 2,
          intervalMs: 250,
        })
        let pushed = 0
        const step = () => {
          if (pushed >= append) return
          sequence += 1
          const changed = first ? `[${first}]` : "[]"
          client.send(
            frame(
              `"trigger":"notify","observed_at":"${new Date().toISOString()}","changed":${changed},"removed":[]`,
            ).replace("%T", "update"),
          )
          pushed += 1
          if (overflowAfter !== undefined && pushed === overflowAfter) {
            client.send(
              `{"type":"error","code":"queue_overflow","message":"frames were dropped for this feed; re-subscribe or re-read","feed":${JSON.stringify(name)}}`,
            )
          }
          feed.later(intervalMs, step)
        }
        feed.later(intervalMs, step)
      })
    }),
  )
}

export const feedHandlers: WebSocketHandler[] = [
  ...kirokuEvents(),
  ...kirokuMetrics(),
  ...pgmq(),
  ...shibuya(),
  ...keiro(),
]
