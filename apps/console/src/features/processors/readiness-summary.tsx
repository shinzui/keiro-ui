import { cn } from "cn"

import { useReadiness } from "./queries"

interface Dependency {
  name: string
  healthy: boolean
  latencyMs?: number | null
  error?: string | null
}

function dependencies(value: unknown[]): Dependency[] {
  return value.filter(
    (d): d is Dependency => typeof d === "object" && d !== null && "name" in d && "healthy" in d,
  )
}

/** `/health/ready` in one line: application state, processor tallies, dependency dots. */
export function ReadinessSummary() {
  const readiness = useReadiness()
  if (readiness.isError)
    return (
      <span className="text-destructive">Readiness unavailable: {readiness.error.message}</span>
    )
  const body = readiness.data?.body
  if (!body) return <span>Checking readiness…</span>
  const p = body.processors
  const paused = typeof p.paused === "number" ? p.paused : 0
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="readiness">
      <span className={cn(body.ready ? "text-foreground" : "text-destructive")}>
        {body.application}
        {!body.ready && " · not ready"}
      </span>
      <span>
        {p.healthy} healthy, {p.failed} failed, {p.stuck} stuck, {paused} paused of {p.total}
      </span>
      {dependencies(body.dependencies).map((d) => (
        <span key={d.name} className="inline-flex items-center gap-1" title={d.error ?? undefined}>
          <span
            aria-hidden
            className={cn("size-2 rounded-full", d.healthy ? "bg-emerald-500" : "bg-destructive")}
          />
          {d.name}
          {typeof d.latencyMs === "number" && ` ${d.latencyMs} ms`}
        </span>
      ))}
    </span>
  )
}
