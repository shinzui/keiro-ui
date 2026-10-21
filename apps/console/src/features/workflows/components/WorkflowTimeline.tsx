import type { WorkflowJournalEntry } from "@keiro-ui/client-keiro"
import { cn } from "cn"

import { Timestamp } from "@/components/timestamp"
import { formatDuration } from "@/lib/format"

import { groupBySteps, isFailure, isSynthetic, lensIndices } from "../journal"
import type { JournalLens } from "../search"
import { deriveSegments } from "../segments"

/**
 * The journal in stream-version order, grouped by step, with a derived span bar per entry
 * (time since the previous recorded entry; the first is measured from `created_at`).
 */
export function WorkflowTimeline({
  entries,
  createdAt,
  lens,
  onOpen,
}: {
  entries: WorkflowJournalEntry[]
  createdAt: string | undefined
  lens: JournalLens
  onOpen: (entry: WorkflowJournalEntry) => void
}) {
  const segments = deriveSegments(entries, createdAt)
  const maxSpan = Math.max(0, ...segments.perEntry.map((s) => s.spanSeconds ?? 0))
  const groups = groupBySteps(entries, lensIndices(entries, lens))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground" data-testid="segments-legend">
        Spans are derived in the browser from recorded timestamps, not reported by the server.
        {segments.timeToFirstStepSeconds !== null && (
          <> Time to first step: {formatDuration(segments.timeToFirstStepSeconds)}.</>
        )}
        {segments.totalSeconds !== null && (
          <> Through the last loaded entry: {formatDuration(segments.totalSeconds)}.</>
        )}
      </p>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No journal entries for this lens.</p>
      )}
      <ol aria-label="Journal" className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.indices[0]} className="rounded-lg border p-2" data-step={group.step}>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium">{group.step}</span>
              {group.indices.length > 1 && (
                <span className="text-muted-foreground">× {group.indices.length}</span>
              )}
            </div>
            <ul className="mt-1 flex flex-col">
              {group.indices.map((i) => {
                const entry = entries[i]!
                const span = segments.perEntry[i]?.spanSeconds ?? null
                return (
                  <li key={entry.event_id}>
                    <button
                      type="button"
                      onClick={() => onOpen(entry)}
                      className={cn(
                        "grid w-full grid-cols-[3rem_minmax(8rem,14rem)_8rem_1fr] items-center gap-3 rounded px-1 py-0.5 text-left text-xs hover:bg-muted/60",
                        isFailure(entry) && "text-destructive",
                        isSynthetic(entry) && !isFailure(entry) && "text-muted-foreground",
                      )}
                      data-event-id={entry.event_id}
                    >
                      <span className="tabular-nums text-muted-foreground">
                        v{entry.stream_version.toString()}
                      </span>
                      <span className="truncate">{entry.event_type}</span>
                      <span>
                        <Timestamp value={entry.recorded_at} />
                      </span>
                      <span className="flex items-center gap-2">
                        {span !== null && (
                          <>
                            <span
                              aria-hidden
                              className={cn(
                                "h-1.5 rounded-full bg-sky-500/70",
                                i === segments.longestIndex && "bg-amber-500",
                              )}
                              style={{
                                width: `${maxSpan > 0 ? Math.max(2, (span / maxSpan) * 160) : 2}px`,
                              }}
                            />
                            <span className="tabular-nums text-muted-foreground">
                              +{formatDuration(span)}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
