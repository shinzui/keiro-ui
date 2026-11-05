import type { AggregateView } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Link } from "@tanstack/react-router"

import { JsonViewer } from "@/components/JsonViewer"
import { PositionBadge } from "@/components/PositionBadge"
import { links } from "@/lib/links"

import { HydrationBadge } from "../shared/HydrationBadge"
import { registersOf } from "./registers"
import { RegistersTable } from "./RegistersTable"
import { SnapshotCard } from "./SnapshotCard"
import { StoredSnapshotCard } from "./StoredSnapshotCard"

/** The folded state keiro rebuilt, how it was rebuilt, and the snapshot's health. */
export function FoldedStatePane({ view }: { view: AggregateView }) {
  const registers = registersOf(view.state)
  return (
    <section aria-label="Folded state" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{view.state_label ?? "State"}</h2>
        <HydrationBadge hydration={view.hydration} />
        {view.deleted_at && <Badge variant="destructive">deleted</Badge>}
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">state version</dt>
        <dd>
          {view.state_version === null ? (
            "—"
          ) : (
            <PositionBadge value={view.state_version} label="state version" />
          )}
        </dd>
        <dt className="text-muted-foreground">stream version</dt>
        <dd>
          <PositionBadge value={view.stream_version} label="stream version" />
        </dd>
        <dt className="text-muted-foreground">history</dt>
        <dd className="text-xs">
          {view.history.owner} ·{" "}
          <Link
            {...links.stream(view.history.stream_name)}
            className="font-mono underline-offset-2 hover:underline"
          >
            {view.history.stream_name}
          </Link>{" "}
          · head v{view.history.head_version.toString()}
        </dd>
        {view.truncate_before > 0n && (
          <>
            <dt className="text-muted-foreground">truncated</dt>
            <dd>history truncated before v{view.truncate_before.toString()}</dd>
          </>
        )}
      </dl>
      {registers && <RegistersTable registers={registers} />}
      <JsonViewer label="State" value={view.state} />
      <SnapshotCard snapshot={view.snapshot} />
      <StoredSnapshotCard
        key={view.stream_name}
        stream={view.stream_name}
        currentState={view.state}
        stateVersion={view.state_version}
      />
    </section>
  )
}
