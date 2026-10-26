import { useSurfaceAvailable, type Surface } from "@keiro-ui/client-core"
import { isRouteUnavailable } from "@keiro-ui/client-keiro"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@keiro-ui/ui/components/collapsible"
import type { ReactNode } from "react"

import { PositionBadge } from "@/components/PositionBadge"
import { useAggregateTypes } from "@/features/aggregates/queries"
import { positionDistance } from "@/features/projections/distance"
import { formatDuration, formatInt } from "@/lib/format"
import { links } from "@/lib/links"
import { useSurfaceHealth } from "@/shell/health"
import { useStatusSlot } from "@/shell/status-slots"

import { HealthStrip } from "./health-strip"
import {
  TIMER_SAMPLE,
  useProcessorsCard,
  useProjectionsCard,
  useQueuesCard,
  useStoreCard,
  useStoreMetrics,
  useTimersCard,
  useWorkflowsCard,
  WORKFLOW_SAMPLE,
} from "./queries"
import { useSampleHistory } from "./sample-history"
import { StatCard } from "./stat-card"

const STATUS_CLASSES = [
  "running",
  "retrying",
  "sleeping",
  "awaiting",
  "completed",
  "cancelled",
  "failed",
] as const

/** A card's body when its query failed: the server's message, never a fabricated number. */
const failed = (error: { message: string } | null) => (error ? "unavailable" : "…")

function QueuesCard() {
  const metrics = useQueuesCard()
  const rows = metrics.data ?? []
  const ages = rows.flatMap((m) => (m.oldest_msg_age_sec === null ? [] : [m.oldest_msg_age_sec]))
  const oldest = ages.length ? Math.max(...ages) : undefined
  const { trend } = useSampleHistory(oldest, metrics.dataUpdatedAt)
  const total = rows.reduce((sum, m) => sum + m.queue_length, 0n)
  const visible = rows.reduce((sum, m) => sum + m.queue_visible_length, 0n)
  return (
    <StatCard
      title="Queues"
      testId="card-queues"
      to={links.queues()}
      headline={
        metrics.data
          ? oldest === undefined
            ? "no ready messages"
            : formatDuration(oldest)
          : failed(metrics.error)
      }
      label={oldest === undefined ? undefined : "oldest ready message"}
      subtitle={
        metrics.data &&
        `${rows.length} queues · ${formatInt(total)} total · ${formatInt(visible)} visible`
      }
      observedAt={metrics.dataUpdatedAt}
      trend={trend}
    />
  )
}

function WorkflowsCard() {
  const list = useWorkflowsCard()
  const items = list.data?.items ?? []
  const more = list.data?.nextCursor !== undefined
  const count = (c: string) =>
    `${items.filter((wf) => wf.status_class === c).length}${more ? "+" : ""}`
  return (
    <StatCard
      title="Workflows"
      testId="card-workflows"
      to={links.workflows()}
      headline={list.data ? count("running") : failed(list.error)}
      label="running"
      subtitle={
        list.data &&
        `${more ? `newest ${WORKFLOW_SAMPLE} instances: ` : ""}${STATUS_CLASSES.filter(
          (c) => c !== "running",
        )
          .map((c) => `${c} ${count(c)}`)
          .join(" · ")}`
      }
      observedAt={list.data?.observed_at ?? list.dataUpdatedAt}
    />
  )
}

function ProjectionsCard() {
  const status = useProjectionsCard()
  const page = status.data
  const head = page?.visible_store_head
  const distances = (page?.items ?? []).map((g) =>
    positionDistance({
      head,
      applied: g.serving_applied_position,
      basis: g.serving_position_basis,
    }),
  )
  const behind = distances.flatMap((d) => (d.kind === "behind" ? [d.distance] : []))
  const max = behind.length ? behind.reduce((a, b) => (b > a ? b : a)) : undefined
  const { trend } = useSampleHistory(max ?? 0n, status.dataUpdatedAt)
  const failedGroups = (page?.items ?? []).filter((g) => g.failed_at).length
  // A managed group with no served position is neither behind nor caught up.
  const unserved = distances.filter((d) => d.kind === "none").length
  useStatusSlot(
    "store-head",
    head === undefined ? null : (
      <span className="flex items-center gap-1">
        head <PositionBadge value={head} label="visible store head" />
      </span>
    ),
  )
  return (
    <StatCard
      title="Projections"
      testId="card-projections"
      to={links.projections()}
      headline={
        !page
          ? failed(status.error)
          : max !== undefined
            ? formatInt(max)
            : unserved > 0
              ? "no served position"
              : "all caught up"
      }
      label={
        max !== undefined
          ? "max global position distance"
          : unserved > 0
            ? `${unserved} managed ${unserved === 1 ? "group serves" : "groups serve"} no position yet`
            : undefined
      }
      subtitle={
        page &&
        `${page.items.length}${page.nextCursor ? "+" : ""} groups · ${failedGroups} failed${head === undefined ? "" : ` · head ${formatInt(head)}`}`
      }
      observedAt={page?.observed_at ?? status.dataUpdatedAt}
      trend={trend}
    />
  )
}

function ProcessorsCard() {
  const ready = useProcessorsCard()
  const body = ready.data?.body
  const p = body?.processors
  const paused = typeof p?.paused === "number" ? p.paused : 0
  return (
    <StatCard
      title="Processors"
      testId="card-processors"
      to={links.processors()}
      headline={body ? body.application : failed(ready.error)}
      label={body && (body.ready ? "ready" : "not ready")}
      subtitle={
        p &&
        `total ${p.total} · healthy ${p.healthy} · failed ${p.failed} · stuck ${p.stuck} · paused ${paused}`
      }
      observedAt={ready.dataUpdatedAt}
    />
  )
}

function StoreCard() {
  const inventory = useStoreCard()
  const metrics = useStoreMetrics()
  const subscriptions = new Set((inventory.data?.checkpoints ?? []).map((c) => c.subscription)).size
  const deadLettered = (metrics.data as { subscriptions_dead_lettered?: unknown } | undefined)
    ?.subscriptions_dead_lettered
  return (
    <StatCard
      title="Store"
      testId="card-store"
      to={links.subscriptions()}
      headline={inventory.data ? formatInt(inventory.data.store_position) : failed(inventory.error)}
      label="store position"
      subtitle={
        inventory.data && (
          <span title="kiroku-inspect runs no subscriptions itself, so its process-local dead-letter counter stays 0">
            {subscriptions} subscriptions
            {typeof deadLettered === "number" || typeof deadLettered === "bigint"
              ? ` · dead letters seen: ${formatInt(deadLettered)}`
              : ""}
          </span>
        )
      }
      observedAt={inventory.dataUpdatedAt}
    />
  )
}

function AggregatesCard() {
  const types = useAggregateTypes()
  const error: unknown = types.error
  const notMounted = isRouteUnavailable(error)
  const items = types.data?.items ?? []
  return (
    <StatCard
      title="Aggregates & process managers"
      testId="card-aggregates"
      to={links.aggregates()}
      headline={
        notMounted
          ? "not mounted on this host"
          : types.data
            ? String(items.length)
            : failed(types.error)
      }
      label={types.data ? "aggregate types" : undefined}
      subtitle={types.data && items.map((t) => t.name).join(", ")}
      observedAt={types.dataUpdatedAt}
    />
  )
}

function TimersCard() {
  const { pending, stuck } = useTimersCard()
  const more = pending.data?.nextCursor !== undefined
  return (
    <StatCard
      title="Timers"
      testId="card-timers"
      to={links.timers()}
      headline={
        pending.data ? `${pending.data.items.length}${more ? "+" : ""}` : failed(pending.error)
      }
      label={`pending${more ? ` (first ${TIMER_SAMPLE})` : ""}`}
      subtitle={stuck.data && `${stuck.data.length} stuck`}
      observedAt={pending.data?.observed_at ?? pending.dataUpdatedAt}
    />
  )
}

function KeiroHealthCard() {
  const probe = useSurfaceHealth("keiro")
  const body = probe.body as
    | { status?: string; schema_drift?: string[]; mutations_enabled?: boolean }
    | undefined
  const drift = body?.schema_drift ?? []
  let mutations: ReactNode = null
  if (body?.mutations_enabled !== undefined)
    mutations = `mutations: ${body.mutations_enabled ? "enabled" : "disabled"} on server`
  return (
    <Card size="sm" role="region" aria-label="keiro health">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">keiro health</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <span className="text-2xl font-semibold">
          {body?.status ?? (probe.status === "unknown" ? "…" : "unreachable")}
        </span>
        {mutations && (
          <span className="text-xs" data-testid="mutations">
            {mutations}
          </span>
        )}
        {drift.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs underline-offset-2 hover:underline">
              schema drift ({drift.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="list-inside list-disc text-xs">
                {drift.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

/** The landing page: one card per concern, the surfaces' health, and keiro's own health. */
export function Overview() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <HealthStrip />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AvailableSurface surface="pgmq" title="Queues">
          <QueuesCard />
        </AvailableSurface>
        <AvailableSurface surface="keiro" title="Workflows">
          <WorkflowsCard />
        </AvailableSurface>
        <AvailableSurface surface="keiro" title="Projections">
          <ProjectionsCard />
        </AvailableSurface>
        <AvailableSurface surface="shibuya" title="Processors">
          <ProcessorsCard />
        </AvailableSurface>
        <AvailableSurface surface="kiroku" title="Store">
          <StoreCard />
        </AvailableSurface>
        <AvailableSurface surface="keiro" title="Aggregates & process managers">
          <AggregatesCard />
        </AvailableSurface>
        <AvailableSurface surface="keiro" title="Timers">
          <TimersCard />
        </AvailableSurface>
        <AvailableSurface surface="keiro" title="keiro health">
          <KeiroHealthCard />
        </AvailableSurface>
      </div>
    </div>
  )
}

function AvailableSurface({
  surface,
  title,
  children,
}: {
  surface: Surface
  title: string
  children: ReactNode
}) {
  return useSurfaceAvailable(surface) ? (
    children
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        Not configured for this application
        {surface === "shibuya" && " · Select a worker if one is listed"}
      </CardContent>
    </Card>
  )
}
