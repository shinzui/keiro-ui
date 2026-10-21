import type { ProcessorMetrics } from "@keiro-ui/client-shibuya"

/** The processor's latest cursor and one cursor per partition; values are opaque strings. */
export function ProgressCursors({ progress }: { progress: ProcessorMetrics["progress"] }) {
  if (!progress)
    return <p className="text-sm text-muted-foreground">progress detail not enabled on this host</p>
  const partitions = Object.entries(progress.partitions).toSorted(([a], [b]) => a.localeCompare(b))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <dl className="grid grid-cols-[max-content_max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">latest</dt>
        <dd className="text-xs text-muted-foreground">{progress.latest?.kind ?? ""}</dd>
        <dd className="font-mono text-xs">{progress.latest?.value ?? "—"}</dd>
        {partitions.map(([key, cursor]) => (
          <div key={key} className="contents">
            <dt className="font-mono text-xs">{key}</dt>
            <dd className="text-xs text-muted-foreground">{cursor.kind}</dd>
            <dd className="font-mono text-xs">{cursor.value}</dd>
          </div>
        ))}
      </dl>
      {partitions.length === 0 && (
        <p className="text-muted-foreground">No partition has reported progress.</p>
      )}
      {progress.truncated && (
        <p className="text-xs text-muted-foreground">
          The server truncated the partition list; not every partition is shown.
        </p>
      )}
    </div>
  )
}
