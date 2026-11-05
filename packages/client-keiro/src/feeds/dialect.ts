import type { Dialect, Frame } from "@keiro-ui/client-core"

// keiro-ops-http `/ws` (`/keiro/ws` when composed): docs/guides/stream-keiro-inspection-views.md
// in mori://shinzui/keiro. Feeds mirror the first page only; there is no replay cursor
// (ADR-56), so `queue_overflow` or any gap in `sequence` means re-read the poll path.
// `view_retiring` means the view's last subscriber left and its cleanup is still joining; that
// guide says to retry the subscription after cleanup. Polling carries the screen meanwhile.

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
  retrySubscribeCodes: ["view_retiring"],
  isResync: () => false,
}
