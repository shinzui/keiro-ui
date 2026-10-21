import type { Dialect, Frame } from "@keiro-ui/client-core"

// keiro-ops-http `/ws` (`/keiro/ws` when composed): docs/guides/stream-keiro-inspection-views.md
// in mori://shinzui/keiro. Feeds mirror the first page only; there is no replay cursor
// (ADR-56), so `queue_overflow` or any gap in `sequence` means re-read the poll path.

export type KeiroFeedName = "workflows" | "timers" | "projection_groups"
export type KeiroFeedSubscription = { feed: KeiroFeedName } & Record<string, unknown>

export const keiroFeedDialect: Dialect<KeiroFeedSubscription> = {
  name: "keiro",
  subscribe: ({ feed, ...filters }) => ({ type: "subscribe", feed, ...filters }) as Frame,
  unsubscribe: ({ feed }) => ({ type: "unsubscribe", feed }),
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
    extra: ["unsubscribed"],
  },
  overflowCodes: ["queue_overflow"],
  isResync: () => false,
}
