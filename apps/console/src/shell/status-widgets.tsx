import { Button } from "@keiro-ui/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@keiro-ui/ui/components/dropdown-menu"
import { Kbd } from "@keiro-ui/ui/components/kbd"
import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { useRouter } from "@tanstack/react-router"
import { cn } from "cn"
import { useEffect, useState } from "react"

import { formatRelativeTime } from "@/lib/format"
import { navigateToHref } from "@/lib/href"
import { surfaces, type Surface, useConnectionProfiles } from "@/settings/connection-profiles"

import { useCommandPalette } from "./command-palette"
import { type HealthStatus, useSurfaceHealth } from "./health"
import { useLiveness } from "./liveness"

export function ConnectionSwitcher() {
  const router = useRouter()
  const { profiles, active, setActive } = useConnectionProfiles()
  return (
    <DropdownMenuTrigger>
      <Button variant="ghost" size="xs" aria-label={`Connection profile: ${active.name}`}>
        {active.name}
      </Button>
      <DropdownMenu placement="top start">
        <DropdownMenuLabel>Connection profile</DropdownMenuLabel>
        {profiles.map((profile) => (
          <DropdownMenuItem key={profile.id} onAction={() => setActive(profile.id)}>
            {profile.id === active.id ? "● " : ""}
            {profile.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onAction={() => void navigateToHref(router, "/settings/connections")}>
          Manage…
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}

const dotColour: Record<HealthStatus, string> = {
  up: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-muted-foreground/40",
}

function HealthDot({ surface }: { surface: Surface }) {
  const probe = useSurfaceHealth(surface)
  const details = [
    surface,
    probe.status,
    probe.latencyMs !== undefined ? `${probe.latencyMs} ms` : undefined,
    probe.httpStatus !== undefined && probe.status !== "up"
      ? `HTTP ${probe.httpStatus}`
      : undefined,
    probe.status !== "unknown" ? `checked ${formatRelativeTime(probe.checkedAt)}` : undefined,
  ].filter(Boolean)
  return (
    <TooltipTrigger>
      <span
        role="img"
        tabIndex={0}
        aria-label={`${surface} ${probe.status}`}
        data-surface={surface}
        data-status={probe.status}
        data-url={probe.url}
        className="flex items-center gap-1 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("size-2 rounded-full", dotColour[probe.status])} />
        <span className="text-muted-foreground">{surface}</span>
      </span>
      <Tooltip placement="top">
        <span className="flex flex-col">
          <span>{details.join(" · ")}</span>
          <span className="opacity-80">{probe.url}</span>
        </span>
      </Tooltip>
    </TooltipTrigger>
  )
}

export function HealthDots() {
  return (
    <div className="flex items-center gap-1" aria-label="Surface health">
      {surfaces.map((surface) => (
        <HealthDot key={surface} surface={surface} />
      ))}
    </div>
  )
}

function elapsed(since: Date, now: number): string {
  const seconds = Math.max(0, Math.floor((now - since.getTime()) / 1000))
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`
}

export function LivenessToggle() {
  const { paused, pausedSince, pause, resume } = useLiveness()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!paused) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [paused])
  const label =
    paused && pausedSince
      ? `Paused ${elapsed(pausedSince, Math.max(now, pausedSince.getTime()))}`
      : "Live"
  return (
    <Button
      variant="ghost"
      size="xs"
      onPress={paused ? resume : pause}
      aria-label={paused ? "Resume live updates" : "Pause live updates"}
      data-paused={paused}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          paused ? "bg-muted-foreground/60" : "animate-pulse bg-emerald-500",
        )}
      />
      <span data-slot="liveness-label">{label}</span>
    </Button>
  )
}

export function PaletteHint() {
  const { setOpen } = useCommandPalette()
  return (
    <Button
      variant="ghost"
      size="xs"
      onPress={() => setOpen(true)}
      aria-label="Open command palette"
    >
      <Kbd>⌘K</Kbd>
    </Button>
  )
}
