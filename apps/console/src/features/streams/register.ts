import { registerFeature } from "@/shell/features"

import { EventDetailSheet } from "./EventDetailSheet"

/** The Streams & Subscriptions section's contributions to the shell. */
export function registerStreamsFeature(): void {
  registerFeature({ id: "streams", sheets: { event: EventDetailSheet } })
}
