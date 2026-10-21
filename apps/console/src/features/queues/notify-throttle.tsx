import { Timestamp } from "@/components/timestamp"

import { useNotifyThrottle } from "./queries"

/** The queue's insert-notify throttle (`/notify/throttles`), when one is configured. */
export function NotifyThrottle({ queue }: { queue: string }) {
  const throttle = useNotifyThrottle(queue)
  if (!throttle.data) return null
  return (
    <p className="text-xs text-muted-foreground" data-testid="notify-throttle">
      Insert notifications throttled to one per {throttle.data.throttle_interval_ms} ms
      {throttle.data.last_notified_at && (
        <>
          {" "}
          · last <Timestamp value={throttle.data.last_notified_at} />
        </>
      )}
    </p>
  )
}
