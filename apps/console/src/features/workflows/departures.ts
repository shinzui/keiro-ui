import { useEffect, useRef, useState } from "react"

const NOTICE_MS = 8_000

/**
 * Keys that were on the list and are not any more, for a short notice: a feed `removed`
 * means "left the first page", not "deleted", so rows that move off say so instead of
 * silently vanishing. Only tracked while `enabled` (page one with the feed live).
 */
export function useDepartures(keys: string[], enabled: boolean): string[] {
  const previous = useRef<string[] | null>(null)
  const [departed, setDeparted] = useState<string[]>([])
  const joined = keys.join("\n")
  useEffect(() => {
    const current = joined === "" ? [] : joined.split("\n")
    const before = previous.current
    previous.current = current
    if (!enabled || before === null) return
    const gone = before.filter((key) => !current.includes(key))
    if (gone.length === 0) return
    setDeparted(gone)
    const timer = setTimeout(() => setDeparted([]), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [joined, enabled])
  return departed
}
