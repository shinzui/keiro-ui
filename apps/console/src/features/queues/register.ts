import { registerFeature } from "@/shell/features"

import { QueueMessageSheet } from "./queue-message-sheet"

/** The Queues & Processors section's contributions to the shell. */
export function registerQueuesFeature(): void {
  registerFeature({ id: "queues", sheets: { "queue-message": QueueMessageSheet } })
}
