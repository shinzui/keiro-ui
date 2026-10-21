import { registerFeature } from "@/shell/features"

import { TimerSheet } from "./TimerSheet"

/** The Process managers & Timers section's contributions: the timer sheet and a preset. */
export function registerTimersFeature(): void {
  registerFeature({
    id: "timers",
    sheets: { timer: TimerSheet },
    navigation: {
      "process-managers": [
        { id: "timers-stuck", title: "Stuck timers", href: "/timers?tab=stuck" },
      ],
    },
  })
}
