import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"

export type StatusSlotId = "page" | "store-head"

type Slots = Partial<Record<StatusSlotId, ReactNode>>
type SetSlot = (id: StatusSlotId, content: ReactNode | undefined) => void

// Two contexts: components that fill a slot only read the stable setter, so they do not
// re-render (and re-register) whenever any slot's content changes.
const SlotsContext = createContext<Slots | null>(null)
const SetSlotContext = createContext<SetSlot | null>(null)

export function StatusSlotProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slots>({})
  const setSlot = useCallback<SetSlot>((id, content) => {
    setSlots((prev) => {
      if (prev[id] === content) return prev
      const next = { ...prev }
      if (content === undefined) delete next[id]
      else next[id] = content
      return next
    })
  }, [])
  return (
    <SetSlotContext.Provider value={setSlot}>
      <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>
    </SetSlotContext.Provider>
  )
}

/** Fills a bottom-bar slot while the calling component is mounted. */
export function useStatusSlot(id: StatusSlotId, content: ReactNode): void {
  const setSlot = useContext(SetSlotContext)
  if (!setSlot) throw new Error("useStatusSlot requires <StatusSlotProvider>")
  useEffect(() => {
    setSlot(id, content)
  }, [id, content, setSlot])
  useEffect(() => () => setSlot(id, undefined), [id, setSlot])
}

export function useStatusSlotContent(id: StatusSlotId): ReactNode {
  const slots = useContext(SlotsContext)
  if (!slots) throw new Error("useStatusSlotContent requires <StatusSlotProvider>")
  return slots[id]
}
