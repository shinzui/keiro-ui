import type { HttpResponse } from "msw"

import { fixtureText, hasFixture, manifests, rawResponse } from "./fixtures"
import { arrayElements, bigintField, replaceField, stringField } from "./json-text"

// A small stateful model of kiroku's `$all` log (ADR-3: a pushed event must also be returned
// by the next poll, and an overflow re-read must find the dropped events). Seeded from the
// recorded `$all` pages; until something is appended the handlers keep serving the recorded
// bytes untouched.

interface LogEvent {
  text: string
  position: bigint
  id: string
  stream: string
}

let events: LogEvent[] | null = null
let appended = 0
const streamVersions = new Map<string, number>()

/** kiroku's category is the stream name up to its first "-". */
export function categoryOf(stream: string): string {
  const dash = stream.indexOf("-")
  return dash === -1 ? stream : stream.slice(0, dash)
}

function parseEvent(text: string): LogEvent {
  return {
    text,
    position: bigintField(text, "globalPosition") ?? 0n,
    id: stringField(text, "eventId") ?? "",
    stream: stringField(text, "original_stream_name") ?? "",
  }
}

function seeded(): LogEvent[] {
  if (events) return events
  const byPosition = new Map<bigint, LogEvent>()
  for (const slug of ["events-forward", "events-forward.page2", "events-backward"]) {
    const relative = `kiroku/${slug}.json`
    if (!hasFixture(relative)) continue
    for (const element of arrayElements(fixtureText(relative), "items")) {
      const event = parseEvent(element)
      byPosition.set(event.position, event)
    }
  }
  events = [...byPosition.values()].toSorted((a, b) => (a.position < b.position ? -1 : 1))
  return events
}

function uuid(): string {
  return crypto.randomUUID()
}

export const kirokuLog = {
  /** The highest global position in the log. */
  head(): bigint {
    const all = seeded()
    return all.length ? all[all.length - 1]!.position : 0n
  },

  /** Appends one synthesized event in kiroku's published shape at `head() + 1`. */
  append(init: { category?: string; eventType?: string } = {}): string {
    const category = init.category ?? manifests.kiroku.pins.category ?? "console"
    const stream = `${category}-console-mock`
    const version = (streamVersions.get(stream) ?? 0) + 1
    streamVersions.set(stream, version)
    const position = this.head() + 1n
    appended += 1
    const event = {
      causationId: null,
      correlationId: null,
      createdAt: new Date().toISOString(),
      eventId: uuid(),
      eventType: init.eventType ?? "ConsoleMockEvent",
      globalPosition: "__POSITION__",
      metadata: { source: "@keiro-ui/testing" },
      originalStreamId: 0,
      originalVersion: version,
      original_stream_name: stream,
      payload: { kind: init.eventType ?? "ConsoleMockEvent", sequence: appended },
      streamVersion: version,
    }
    // The position is spliced in as digits so it stays exact beyond 2^53.
    const text = JSON.stringify(event).replace('"__POSITION__"', position.toString())
    seeded().push(parseEvent(text))
    return text
  },

  /** True once anything has been appended since the last reset. */
  grown(): boolean {
    return appended > 0
  },

  /** Events after `position` (exclusive), oldest first, optionally in one category. */
  after(position: bigint, category?: string): string[] {
    return seeded()
      .filter((e) => e.position > position && (!category || categoryOf(e.stream) === category))
      .map((e) => e.text)
  },

  /**
   * kiroku's page semantics over the log: `from` is exclusive; `from=0` (or absent) starts
   * at the oldest event forward or the newest backward; `next_cursor` is the last position
   * on a full page.
   */
  page(query: URLSearchParams, category?: string): HttpResponse<string> {
    const limit = Number(query.get("limit") ?? "100")
    const backward = query.get("direction") === "backward"
    const fromText = query.get("from")
    const from = fromText && /^\d+$/.test(fromText) ? BigInt(fromText) : 0n
    let candidates = seeded().filter((e) => !category || categoryOf(e.stream) === category)
    if (backward) {
      candidates = candidates.filter((e) => from === 0n || e.position < from).toReversed()
    } else {
      candidates = candidates.filter((e) => e.position > from)
    }
    const items = candidates.slice(0, limit)
    const last = items[items.length - 1]
    const cursor = items.length === limit && last ? `,"next_cursor":${last.position}` : ""
    return rawResponse(`{"items":[${items.map((e) => e.text).join(",")}]${cursor}}`, 200)
  },

  /** One event by id, or undefined. */
  get(id: string): string | undefined {
    return seeded().find((e) => e.id === id)?.text
  },

  /** `/subscription-checkpoints` with the log head as `store_position`. */
  checkpoints(body: string): string {
    return replaceField(body, "store_position", this.head().toString())
  },

  reset(): void {
    events = null
    appended = 0
    streamVersions.clear()
  },
}
