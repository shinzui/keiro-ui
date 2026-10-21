import { useEffect, useState } from "react"

/** The current time, re-rendering every `intervalMs`; a page calls it once and passes `now` down. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
