import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

/**
 * The session's trail of earlier cursors for a page whose cursor lives in the URL's `from`.
 * Cursors cannot be computed backwards, so Previous replays the trail.
 */
export function useCursorTrail() {
  const navigate = useNavigate()
  const [trail, setTrail] = useState<(string | undefined)[]>([])
  const go = (cursor: string | undefined, nextTrail: (string | undefined)[]) => {
    setTrail(nextTrail)
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, from: cursor }),
    } as never)
  }
  return { trail, go, reset: () => setTrail([]) }
}
