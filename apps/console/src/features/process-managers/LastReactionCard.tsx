import type { ProcessManagerInstanceView } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"

import { GlobalPosition } from "@/components/GlobalPosition"
import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

type Reaction = NonNullable<ProcessManagerInstanceView["last_reaction"]>

interface Provenance {
  family?: string
  source_event_id?: string
  source_global_position?: number | bigint
  source_stream_name?: string | null
  dispatched_commands?: {
    emit_index: number
    target_stream_name: string
    event_id: string
    witness: string
  }[]
  timer_ids?: string[]
}

// keiro's provenance is bounded opt-in metadata (mori://shinzui/keiro/okf/adrs/concepts/ADR-55):
// `unavailable` is the ordinary case and reads as information, not as a warning.
const STATUS_NOTE: Record<string, string> = {
  available: "provenance recorded",
  truncated: "provenance bounded; some entries omitted",
  unavailable: "this reaction predates provenance recording or the host opted out",
}

/** The last event the manager reacted to, and what it did in response when recorded. */
export function LastReactionCard({
  reaction,
  manager,
  correlation,
}: {
  reaction: Reaction | null
  manager: string
  correlation: string
}) {
  const provenance = reaction?.provenance as Provenance | null | undefined
  return (
    <Card size="sm" role="region" aria-label="Last reaction">
      <CardHeader>
        <CardTitle>Last reaction</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!reaction ? (
          <p className="text-muted-foreground">No reaction recorded.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">event</dt>
              <dd>
                {reaction.event_type}{" "}
                <Link
                  {...links.event(reaction.event_id)}
                  className="font-mono text-xs underline-offset-2 hover:underline"
                >
                  {reaction.event_id.slice(0, 8)}
                </Link>
              </dd>
              <dt className="text-muted-foreground">stream version</dt>
              <dd className="tabular-nums">{reaction.stream_version.toString()}</dd>
              <dt className="text-muted-foreground">global position</dt>
              <dd>
                <GlobalPosition value={reaction.global_position} />
              </dd>
              <dt className="text-muted-foreground">recorded</dt>
              <dd>
                <Timestamp value={reaction.recorded_at} />
              </dd>
              <dt className="text-muted-foreground">provenance</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" data-provenance={reaction.provenance_status}>
                  {reaction.provenance_status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {STATUS_NOTE[reaction.provenance_status] ?? ""}
                </span>
              </dd>
            </dl>
            {provenance && (
              <div className="flex flex-col gap-2" data-testid="provenance">
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">family</dt>
                  <dd>{provenance.family ?? "—"}</dd>
                  <dt className="text-muted-foreground">source event</dt>
                  <dd>
                    {provenance.source_event_id ? (
                      <Link
                        {...links.event(provenance.source_event_id)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {provenance.source_event_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="text-muted-foreground">source global position</dt>
                  <dd className="tabular-nums">
                    {provenance.source_global_position?.toString() ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">source stream</dt>
                  <dd>
                    {provenance.source_stream_name ? (
                      <Link
                        {...links.stream(provenance.source_stream_name)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {provenance.source_stream_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </dl>
                {(provenance.dispatched_commands?.length ?? 0) > 0 && (
                  <Table aria-label="Dispatched commands">
                    <TableHeader>
                      <TableHead isRowHeader>Emit</TableHead>
                      <TableHead>Target stream</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Witness</TableHead>
                    </TableHeader>
                    <TableBody>
                      {provenance.dispatched_commands!.map((c) => (
                        <TableRow key={c.emit_index} id={String(c.emit_index)}>
                          <TableCell className="tabular-nums">{c.emit_index}</TableCell>
                          <TableCell>
                            <Link
                              {...links.stream(c.target_stream_name)}
                              className="font-mono text-xs underline-offset-2 hover:underline"
                            >
                              {c.target_stream_name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              {...links.event(c.event_id)}
                              className="font-mono text-xs underline-offset-2 hover:underline"
                            >
                              {c.event_id.slice(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={c.witness === "event_present" ? "secondary" : "outline"}
                            >
                              {c.witness}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {(provenance.timer_ids?.length ?? 0) > 0 && (
                  <p className="flex flex-wrap gap-2 text-xs">
                    <span className="text-muted-foreground">timers</span>
                    {provenance.timer_ids!.map((id) => (
                      <Link
                        key={id}
                        to="/timers"
                        search={{ manager, correlation, sheet: `timer:${id}` }}
                        className="font-mono underline-offset-2 hover:underline"
                      >
                        {id.slice(0, 8)}
                      </Link>
                    ))}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
