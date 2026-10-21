import type { WorkflowJournalEntry } from "@keiro-ui/client-keiro"

import type { JournalLens } from "./search"

// keiro's terminal journal entries carry synthetic step names (Keiro.Workflow.Inspection in
// mori://shinzui/keiro): completed, cancelled, failed, and continued-as-new.
const SYNTHETIC = /^__workflow_.*__$/

export const isSynthetic = (entry: WorkflowJournalEntry) => SYNTHETIC.test(entry.step_name ?? "")
export const isFailure = (entry: WorkflowJournalEntry) =>
  entry.event_type === "WorkflowFailed" || entry.step_name === "__workflow_failed__"

/**
 * Indices of the entries a lens shows: `steps` hides the synthetic terminal entries;
 * `errors` shows failures and the entry immediately before each.
 */
export function lensIndices(entries: WorkflowJournalEntry[], lens: JournalLens): number[] {
  const all = entries.map((_, i) => i)
  if (lens === "steps") return all.filter((i) => !isSynthetic(entries[i]!))
  if (lens === "errors") {
    const keep = new Set<number>()
    entries.forEach((entry, i) => {
      if (!isFailure(entry)) return
      if (i > 0) keep.add(i - 1)
      keep.add(i)
    })
    return [...keep].toSorted((a, b) => a - b)
  }
  return all
}

export interface JournalGroup {
  step: string
  indices: number[]
}

/** Consecutive entries sharing a step name collapse into one group. */
export function groupBySteps(entries: WorkflowJournalEntry[], indices: number[]): JournalGroup[] {
  const groups: JournalGroup[] = []
  for (const i of indices) {
    const step = entries[i]!.step_name ?? "(no step)"
    const last = groups.at(-1)
    if (last && last.step === step && last.indices.at(-1) === i - 1) last.indices.push(i)
    else groups.push({ step, indices: [i] })
  }
  return groups
}

/** The `journal-entry` sheet reference: `<name>/<id>/<event_id>` (the event id is a UUID). */
export function journalEntryRef(name: string, id: string, eventId: string): string {
  return `${name}/${id}/${eventId}`
}

export function parseJournalEntryRef(ref: string): { name: string; id: string; eventId: string } {
  const first = ref.indexOf("/")
  const last = ref.lastIndexOf("/")
  if (first < 0 || last <= first) return { name: ref, id: "", eventId: "" }
  return { name: ref.slice(0, first), id: ref.slice(first + 1, last), eventId: ref.slice(last + 1) }
}
