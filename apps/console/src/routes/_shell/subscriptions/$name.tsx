import { useKirokuCheckpoints } from "@keiro-ui/client-kiroku"
import { Input } from "@keiro-ui/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { CursorPager } from "@/components/CursorPager"
import { JsonViewer } from "@/components/JsonViewer"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { useDeadLettersPage } from "@/features/streams/queries"
import { deadLettersSearch } from "@/features/streams/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { formatPositionDistance } from "@/lib/format"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

export const Route = createFileRoute("/_shell/subscriptions/$name")({
  validateSearch: deadLettersSearch,
  component: SubscriptionPage,
})

function SubscriptionPage() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const inventory = useKirokuCheckpoints()
  const deadLetters = useDeadLettersPage(name, search)
  const pager = useCursorTrail()
  const [expanded, setExpanded] = useState<string | null>(null)
  useRecordVisit({ kind: "subscription", label: name, href: hrefOf(links.subscription(name)) })
  const rows = inventory.data?.checkpoints.filter((row) => row.subscription === name) ?? []
  const storePosition = inventory.data?.store_position

  return (
    <>
      <PageHeader title={name} description="Durable checkpoints and parked dead letters." />
      <div className="flex flex-col gap-4 p-6">
        <Table aria-label="Checkpoints">
          <TableHeader>
            <TableHead isRowHeader>Member</TableHead>
            <TableHead>Checkpoint</TableHead>
            <TableHead>Distance to head</TableHead>
            <TableHead>Updated</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No durable checkpoint for this subscription.
              </p>
            )}
          >
            {rows.map((row) => (
              <TableRow key={row.member} id={String(row.member)}>
                <TableCell>{row.member}</TableCell>
                <TableCell>
                  <PositionBadge value={row.checkpoint_position} label="checkpoint position" />
                </TableCell>
                <TableCell>
                  {storePosition === undefined
                    ? "—"
                    : formatPositionDistance(storePosition, row.checkpoint_position).text}
                </TableCell>
                <TableCell>
                  <Timestamp value={row.updated_at} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <section aria-label="Dead letters" className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-sm font-semibold">Dead letters</h2>
            <label className="flex items-center gap-2 text-xs">
              Member
              <Input
                aria-label="Member filter"
                inputMode="numeric"
                className="w-20"
                defaultValue={search.member?.toString() ?? ""}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  const value = event.currentTarget.value.trim()
                  pager.reset()
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      member: value === "" ? undefined : Number(value),
                      from: undefined,
                    }),
                  })
                }}
              />
            </label>
          </div>
          {deadLetters.isError && (
            <p className="text-sm text-destructive">{deadLetters.error.message}</p>
          )}
          <Table aria-label="Dead letters">
            <TableHeader>
              <TableHead isRowHeader>Reason</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Global position</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Event</TableHead>
            </TableHeader>
            <TableBody
              renderEmptyState={() => (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {deadLetters.isPending ? "Loading…" : "Nothing parked."}
                </p>
              )}
            >
              {(deadLetters.data?.items ?? []).map((row) => {
                const id = row.dead_letter_id.toString()
                return (
                  <TableRow
                    key={id}
                    id={id}
                    onAction={() => setExpanded(expanded === id ? null : id)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      {row.reason_summary}
                      {expanded === id && (
                        <JsonViewer label="Reason" value={row.reason} className="mt-2" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Timestamp value={row.created_at} />
                    </TableCell>
                    <TableCell>{row.member}</TableCell>
                    <TableCell>
                      <PositionBadge value={row.global_position} label="global position" />
                    </TableCell>
                    <TableCell>{row.attempt_count}</TableCell>
                    <TableCell>
                      <Link
                        {...links.event(row.event_id)}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {row.event_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <CursorPager
            cursor={search.from}
            nextCursor={deadLetters.data?.nextCursor}
            trail={pager.trail}
            onNavigate={pager.go}
            itemCount={deadLetters.data?.items.length}
          />
          <p className="text-xs text-muted-foreground">
            Redrive is not available: kiroku specifies no store-level redrive endpoint; the console
            will offer one when it does.
          </p>
        </section>
      </div>
    </>
  )
}
