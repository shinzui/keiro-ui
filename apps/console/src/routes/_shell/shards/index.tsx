import { Badge } from "@keiro-ui/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { Timestamp } from "@/components/timestamp"
import { useShards, useShardStatus } from "@/features/projections/queries"
import { formatDuration } from "@/lib/format"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/shards/")({
  validateSearch: shellSearchSchema.extend({
    subscription: z.string().min(1).optional().catch(undefined),
  }),
  component: ShardsPage,
})

const count = (value: unknown) => (typeof value === "number" ? value : "—")

function ShardsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const list = useShards()
  return (
    <>
      <PageHeader
        title="Shards"
        description={
          list.data?.observed_at ? (
            <span>
              as of <Timestamp value={list.data.observed_at} />
            </span>
          ) : (
            "Sharded subscriptions and which worker owns each bucket."
          )
        }
      />
      <div className="flex flex-col gap-6 p-6">
        {list.isError && <p className="text-sm text-destructive">{list.error.message}</p>}
        <Table
          aria-label="Sharded subscriptions"
          selectionMode="single"
          selectedKeys={search.subscription ? [search.subscription] : []}
          onSelectionChange={(keys) => {
            const [key] = keys === "all" ? [] : [...keys]
            void navigate({
              search: (prev) => ({ ...prev, subscription: key ? String(key) : undefined }),
            })
          }}
        >
          <TableHeader>
            <TableHead isRowHeader>Subscription</TableHead>
            <TableHead>Shard counts</TableHead>
            <TableHead>Buckets</TableHead>
            <TableHead>Live</TableHead>
            <TableHead>Expired</TableHead>
            <TableHead>Unowned</TableHead>
            <TableHead>Live owners</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {list.isPending ? "Loading…" : "No sharded subscriptions."}
              </p>
            )}
          >
            {(list.data?.items ?? []).map((row) => {
              const extra = row as Record<string, unknown>
              const counts = Array.isArray(extra.shard_counts)
                ? (extra.shard_counts as { shard_count: number; rows: number }[])
                    .map((c) => `${c.shard_count} (${c.rows} rows)`)
                    .join(", ")
                : "—"
              return (
                <TableRow key={row.subscription} id={row.subscription} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{row.subscription}</TableCell>
                  <TableCell className="text-xs">{counts}</TableCell>
                  <TableCell className="tabular-nums">{row.buckets_total}</TableCell>
                  <TableCell className="tabular-nums">{row.buckets_live}</TableCell>
                  <TableCell className="tabular-nums">{count(extra.buckets_expired)}</TableCell>
                  <TableCell className="tabular-nums">{count(extra.buckets_unowned)}</TableCell>
                  <TableCell className="tabular-nums">{row.live_owners}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {search.subscription && <Ownership subscription={search.subscription} />}
      </div>
    </>
  )
}

interface OwnershipRow {
  bucket: number
  owner?: string | null
  lease_state?: string
  lease_expires_at?: string | null
  heartbeat_at?: string | null
  lease_age_seconds?: number | null
}

function Ownership({ subscription }: { subscription: string }) {
  const status = useShardStatus(subscription)
  const rows = (status.data?.ownership ?? []) as OwnershipRow[]
  const unowned = rows.filter((row) => !row.owner).length
  return (
    <section aria-label="Bucket ownership" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">
        {subscription} · {rows.length} buckets ·{" "}
        <span data-testid="unowned">{unowned} unowned</span>
      </h2>
      {status.isError && <p className="text-sm text-destructive">{status.error.message}</p>}
      <Table aria-label="Ownership">
        <TableHeader>
          <TableHead isRowHeader>Bucket</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Lease</TableHead>
          <TableHead>Lease expires</TableHead>
          <TableHead>Heartbeat</TableHead>
          <TableHead>Lease age</TableHead>
        </TableHeader>
        <TableBody
          renderEmptyState={() => (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {status.isPending ? "Loading…" : "No buckets."}
            </p>
          )}
        >
          {rows.map((row) => (
            <TableRow key={row.bucket} id={String(row.bucket)}>
              <TableCell className="tabular-nums">{row.bucket}</TableCell>
              <TableCell className="font-mono text-xs">
                {row.owner ?? <span className="text-muted-foreground">unowned</span>}
              </TableCell>
              <TableCell>
                <Badge variant={row.lease_state === "live" ? "secondary" : "outline"}>
                  {row.lease_state ?? "—"}
                </Badge>
              </TableCell>
              <TableCell>
                {row.lease_expires_at ? <Timestamp value={row.lease_expires_at} /> : "—"}
              </TableCell>
              <TableCell>
                {row.heartbeat_at ? <Timestamp value={row.heartbeat_at} /> : "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {typeof row.lease_age_seconds === "number"
                  ? formatDuration(row.lease_age_seconds)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
