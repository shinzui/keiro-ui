import { parseJsonLossless, serializeJson } from "./int64"

// One WebSocket core for every surface (ADR-2): type-tagged JSON frames, explicit
// subscribe/unsubscribe, snapshot then deltas, in-band errors, goodbye. A data-only Dialect
// descriptor names each surface's frames; the descriptors live in the client packages.

export type Frame = { type: string } & Record<string, unknown>
export type FeedStatus = "connecting" | "open" | "reconnecting" | "closed"

export interface Dialect<SubscribeArgs = void> {
  name: string
  /** null: this dialect pushes on connect (kiroku /ws/metrics). */
  subscribe(args: SubscribeArgs): Frame | null
  unsubscribe(args: SubscribeArgs): Frame | null
  /** {"type":"ping"} on every surface. */
  ping: Frame
  frameTypes: {
    snapshot: string
    /** "event" for kiroku /ws/events, "update" elsewhere. */
    delta: "update" | "event"
    error: string
    goodbye: string
    pong: string
    /** e.g. "event_stream_started", "terminal", "unsubscribed". */
    extra?: string[]
  }
  /** Error codes that mean frames were dropped; the owner re-reads. */
  overflowCodes: string[]
  /** Any other frame that means the client must re-read (keiro sequence gaps). */
  isResync(frame: Frame): boolean
}

export interface FeedHandle<SubscribeArgs = void> {
  readonly status: FeedStatus
  send(frame: Frame): void
  subscribe(args: SubscribeArgs): void
  unsubscribe(args: SubscribeArgs): void
  close(): void
}

export interface FeedOptions<SubscribeArgs> {
  url: string
  dialect: Dialect<SubscribeArgs>
  subscriptions?: SubscribeArgs[]
  onSnapshot(frame: Frame): void
  onDelta(frame: Frame): void
  onExtra?(frame: Frame): void
  onError?(frame: Frame): void
  /** Overflow codes, `isResync` frames, and every reconnect ("reconnected"). */
  onResync(reason: { code: string; frame?: Frame }): void
  onStatus?(status: FeedStatus, detail?: { serverGoodbye: boolean }): void
  WebSocket?: typeof WebSocket
  backoff?: { initialMs?: number; maxMs?: number; resetAfterMs?: number }
}

function isFrame(value: unknown): value is Frame {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === "string"
  )
}

function sameArgs(a: unknown, b: unknown): boolean {
  return serializeJson(a) === serializeJson(b)
}

/**
 * Connects immediately and keeps the connection up: full-jitter exponential backoff from
 * 500 ms, doubling, capped at 30 s, reset after 10 s open. Subscriptions are remembered and
 * re-sent after every reconnect, followed by `onResync({code: "reconnected"})`, because
 * frames may have been missed. `goodbye` only marks the close as server-initiated. Unknown
 * frame types and non-object messages are ignored.
 */
export function openFeed<SubscribeArgs = void>(
  options: FeedOptions<SubscribeArgs>,
): FeedHandle<SubscribeArgs> {
  const { dialect } = options
  const Socket = options.WebSocket ?? globalThis.WebSocket
  const initialMs = options.backoff?.initialMs ?? 500
  const maxMs = options.backoff?.maxMs ?? 30_000
  const resetAfterMs = options.backoff?.resetAfterMs ?? 10_000
  const subscriptions: SubscribeArgs[] = [...(options.subscriptions ?? [])]

  let socket: WebSocket | null = null
  let status: FeedStatus = "connecting"
  let closedByUser = false
  let serverGoodbye = false
  let attempt = 0
  let connectedOnce = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  const setStatus = (next: FeedStatus, detail?: { serverGoodbye: boolean }) => {
    status = next
    options.onStatus?.(next, detail)
  }

  const sendRaw = (frame: Frame | null) => {
    if (frame && socket && socket.readyState === Socket.OPEN) socket.send(serializeJson(frame))
  }

  const dispatch = (frame: Frame) => {
    const types = dialect.frameTypes
    if (frame.type === types.snapshot) options.onSnapshot(frame)
    else if (frame.type === types.delta) options.onDelta(frame)
    else if (frame.type === types.error) {
      const code = typeof frame.code === "string" ? frame.code : ""
      if (dialect.overflowCodes.includes(code) || dialect.isResync(frame))
        options.onResync({ code, frame })
      else options.onError?.(frame)
    } else if (frame.type === types.goodbye) serverGoodbye = true
    else if (frame.type === types.pong) return
    else if (types.extra?.includes(frame.type)) options.onExtra?.(frame)
    else if (dialect.isResync(frame)) options.onResync({ code: frame.type, frame })
    // Any other type is ignored: clients tolerate unknown frames.
  }

  const connect = () => {
    serverGoodbye = false
    const current = new Socket(options.url)
    socket = current
    current.addEventListener("open", () => {
      if (socket !== current) return
      setStatus("open")
      for (const args of subscriptions) sendRaw(dialect.subscribe(args))
      if (connectedOnce) options.onResync({ code: "reconnected" })
      connectedOnce = true
      clearTimeout(resetTimer)
      resetTimer = setTimeout(() => {
        attempt = 0
      }, resetAfterMs)
    })
    current.addEventListener("message", (event: MessageEvent) => {
      if (socket !== current || typeof event.data !== "string") return
      let value: unknown
      try {
        value = parseJsonLossless(event.data)
      } catch {
        return
      }
      if (isFrame(value)) dispatch(value)
    })
    current.addEventListener("close", () => {
      if (socket !== current) return
      clearTimeout(resetTimer)
      socket = null
      if (closedByUser) {
        setStatus("closed")
        return
      }
      setStatus("reconnecting", { serverGoodbye })
      const ceiling = Math.min(maxMs, initialMs * 2 ** attempt)
      attempt += 1
      reconnectTimer = setTimeout(connect, Math.random() * ceiling)
    })
  }

  setStatus("connecting")
  connect()

  return {
    get status() {
      return status
    },
    send: (frame) => sendRaw(frame),
    subscribe(args) {
      subscriptions.push(args)
      sendRaw(dialect.subscribe(args))
    },
    unsubscribe(args) {
      const index = subscriptions.findIndex((existing) => sameArgs(existing, args))
      if (index !== -1) subscriptions.splice(index, 1)
      sendRaw(dialect.unsubscribe(args))
    },
    close() {
      closedByUser = true
      clearTimeout(reconnectTimer)
      clearTimeout(resetTimer)
      if (socket) socket.close()
      else setStatus("closed")
    },
  }
}
