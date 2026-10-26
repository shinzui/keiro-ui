import { cn } from "cn"

import type { Surface } from "@/settings/connection-profiles"
import { type HealthProbe, useSurfaceHealth } from "@/shell/health"

const SURFACES: Surface[] = ["kiroku", "pgmq", "shibuya", "keiro"]

const tone: Record<HealthProbe["status"], string> = {
  up: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/40",
}

/** "unreachable" when the probe failed before any response; otherwise the status word. */
export function healthLabel(probe: HealthProbe): string {
  if (probe.status === "down" && probe.httpStatus === undefined) return "unreachable"
  if (probe.status === "up") return "healthy"
  if (probe.status === "degraded") {
    const body = probe.body as { error?: { code?: unknown } } | undefined
    return body?.error?.code === "inspection_busy" ? "busy" : "schema drift"
  }
  return probe.status === "down" ? `down (${probe.httpStatus})` : "checking"
}

function Dot({ surface }: { surface: Surface }) {
  const probe = useSurfaceHealth(surface)
  const label = probe.url ? healthLabel(probe) : "Not configured for this application"
  return (
    <li
      className="flex items-center gap-1.5 text-xs"
      data-strip-surface={surface}
      data-health={probe.status}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          label === "unreachable" ? "bg-muted-foreground/40" : tone[probe.status],
        )}
      />
      <span className="font-medium">{surface}</span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  )
}

/** The four surfaces' health, with the same rule as the bottom bar (whose probes it shares). */
export function HealthStrip() {
  return (
    <ul aria-label="Surfaces" className="flex flex-wrap gap-x-5 gap-y-2">
      {SURFACES.map((surface) => (
        <Dot key={surface} surface={surface} />
      ))}
    </ul>
  )
}
