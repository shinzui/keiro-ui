import { queryKeys } from "@keiro-ui/client-core"

/** kiroku's query keys; every key starts with "kiroku". */
export const kirokuKeys = {
  all: () => queryKeys.kiroku(),
  capabilities: () => queryKeys.kiroku("capabilities"),
  metrics: () => queryKeys.kiroku("metrics"),
  subscriptionMetrics: (name: string) => queryKeys.kiroku("metrics", name),
  health: (kind: "live" | "ready" | "combined") => queryKeys.kiroku("health", kind),
  liveSubscriptions: (name?: string) => queryKeys.kiroku("subscriptions", name ?? null),
  checkpoints: () => queryKeys.kiroku("checkpoints"),
  deadLetters: (subscription: string, filter: { member?: number; limit?: number; from?: string }) =>
    queryKeys.kiroku("dead-letters", subscription, filter),
  streams: (filter: { category?: string; prefix?: string; limit?: number; from?: string }) =>
    queryKeys.kiroku("streams", filter),
  stream: (name: string) => queryKeys.kiroku("stream", name),
  streamEvents: (name: string, filter: { direction?: string; limit?: number; from?: string }) =>
    queryKeys.kiroku("stream-events", name, filter),
  categories: (filter: { limit?: number; from?: string }) => queryKeys.kiroku("categories", filter),
  categoryEvents: (name: string, filter: { limit?: number; from?: string }) =>
    queryKeys.kiroku("category-events", name, filter),
  allEvents: (filter: { direction?: string; limit?: number; from?: string }) =>
    queryKeys.kiroku("events", filter),
  event: (id: string) => queryKeys.kiroku("event", id),
  tail: (filter: { category?: string; fromPosition?: string }) => queryKeys.kiroku("tail", filter),
}
