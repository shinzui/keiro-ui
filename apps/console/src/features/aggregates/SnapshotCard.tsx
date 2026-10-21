import type { SnapshotStatus } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import type { ReactNode } from "react"

import { Timestamp } from "@/components/timestamp"
import { formatDuration } from "@/lib/format"

function Hash({ value }: { value: string }) {
  return (
    <button
      type="button"
      title={`${value} (click to copy)`}
      className="font-mono text-xs underline-offset-2 hover:underline"
      onClick={() => void navigator.clipboard?.writeText(value)}
    >
      {value.length > 16 ? `${value.slice(0, 12)}…` : value}
    </button>
  )
}

const rows = (entries: [string, ReactNode][]) =>
  entries.map(([label, value]) => (
    <div key={label} className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  ))

/** keiro's snapshot status: configured policy and shapes, and the stored snapshot's health. */
export function SnapshotCard({ snapshot }: { snapshot: SnapshotStatus }) {
  const configured = snapshot.configured as Record<string, unknown> | null
  const stored = snapshot.stored as (Record<string, unknown> & { compatibility: string }) | null
  const mismatched = Array.isArray(stored?.mismatched) ? (stored.mismatched as unknown[]) : []
  return (
    <Card size="sm" role="region" aria-label="Snapshot">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Snapshot <Badge variant="outline">{snapshot.status}</Badge>
          {snapshot.observed_at && (
            <span className="text-xs font-normal text-muted-foreground">
              as of <Timestamp value={snapshot.observed_at} />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {configured ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            {rows(
              Object.entries(configured).map(([key, value]) => [
                key.replaceAll("_", " "),
                typeof value === "string" && key.endsWith("hash") ? (
                  <Hash key={key} value={value} />
                ) : (
                  String(value)
                ),
              ]),
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground">Snapshots are not configured for this kind.</p>
        )}
        {stored && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            {rows([
              ["stored at version", String(stored.stream_version)],
              [
                "compatibility",
                <Badge
                  key="c"
                  variant={stored.compatibility === "incompatible" ? "destructive" : "outline"}
                >
                  {stored.compatibility}
                </Badge>,
              ],
              [
                "created",
                typeof stored.created_at === "string" ? (
                  <Timestamp key="cr" value={stored.created_at} />
                ) : (
                  "—"
                ),
              ],
              [
                "updated",
                typeof stored.updated_at === "string" ? (
                  <Timestamp key="up" value={stored.updated_at} />
                ) : (
                  "—"
                ),
              ],
              [
                "age",
                typeof stored.age_seconds === "number" ? formatDuration(stored.age_seconds) : "—",
              ],
              [
                "events since",
                stored.events_since === null || stored.events_since === undefined
                  ? "—"
                  : String(stored.events_since),
              ],
              [
                "ahead of observed head",
                stored.ahead_of_observed_head === true ? (
                  <Badge key="a" variant="destructive">
                    yes
                  </Badge>
                ) : (
                  "no"
                ),
              ],
            ])}
          </dl>
        )}
        {mismatched.length > 0 && (
          <p role="alert" className="rounded-md bg-destructive/10 p-2 text-destructive">
            The stored snapshot no longer matches the running code:{" "}
            {mismatched.map(String).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
