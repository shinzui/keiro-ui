import type { LucideIcon } from "lucide-react"
import {
  Boxes,
  Clock,
  Database,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Rows3,
  Settings,
  Workflow,
} from "lucide-react"
import { useSyncExternalStore } from "react"

import type { EntityKind } from "./recent"

export type SectionId =
  | "overview"
  | "aggregates"
  | "workflows"
  | "process-managers"
  | "projections"
  | "streams"
  | "queues"
  | "settings"

export interface SidebarEntry {
  id: string
  title: string
  /** A route path such as "/streams", optionally with a query string for presets. */
  href: string
  icon?: LucideIcon
}

export interface Section {
  id: SectionId
  title: string
  icon: LucideIcon
  /** The rail target. */
  href: string
  /** Pathnames that belong to this section. */
  matchPrefixes: string[]
  pages: SidebarEntry[]
}

export const sections: readonly Section[] = [
  {
    id: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    href: "/",
    matchPrefixes: [],
    pages: [{ id: "overview", title: "Overview", href: "/", icon: LayoutDashboard }],
  },
  {
    id: "aggregates",
    title: "Aggregates",
    icon: Boxes,
    href: "/aggregates",
    matchPrefixes: ["/aggregates"],
    pages: [{ id: "aggregates", title: "Aggregate types", href: "/aggregates", icon: Boxes }],
  },
  {
    id: "workflows",
    title: "Workflows",
    icon: Workflow,
    href: "/workflows",
    matchPrefixes: ["/workflows"],
    pages: [{ id: "workflows", title: "Instances", href: "/workflows", icon: Workflow }],
  },
  {
    id: "process-managers",
    title: "Process Managers & Timers",
    icon: GitBranch,
    href: "/process-managers",
    matchPrefixes: ["/process-managers", "/timers"],
    pages: [
      { id: "process-managers", title: "Instances", href: "/process-managers", icon: GitBranch },
      { id: "timers", title: "Timers", href: "/timers", icon: Clock },
    ],
  },
  {
    id: "projections",
    title: "Projections & Read Models",
    icon: Rows3,
    href: "/projections",
    matchPrefixes: ["/projections", "/shards"],
    pages: [
      { id: "projections", title: "Status", href: "/projections", icon: Rows3 },
      { id: "shards", title: "Shards", href: "/shards" },
    ],
  },
  {
    id: "streams",
    title: "Streams & Subscriptions",
    icon: Database,
    href: "/streams",
    matchPrefixes: ["/streams", "/categories", "/events", "/subscriptions"],
    pages: [
      { id: "streams", title: "Streams", href: "/streams", icon: Database },
      { id: "categories", title: "Categories", href: "/categories" },
      { id: "events", title: "All events", href: "/events" },
      { id: "subscriptions", title: "Subscriptions", href: "/subscriptions" },
    ],
  },
  {
    id: "queues",
    title: "Queues & Processors",
    icon: Inbox,
    href: "/queues",
    matchPrefixes: ["/queues", "/processors"],
    pages: [
      { id: "queues", title: "Queues", href: "/queues", icon: Inbox },
      { id: "processors", title: "Processors", href: "/processors" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    href: "/settings/connections",
    matchPrefixes: ["/settings"],
    pages: [
      { id: "connections", title: "Connections", href: "/settings/connections", icon: Settings },
    ],
  },
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function sectionForPathname(pathname: string): Section {
  const match = sections.find((section) =>
    section.matchPrefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  )
  return match ?? sections[0]!
}

export function sectionById(id: SectionId): Section {
  return sections.find((section) => section.id === id)!
}

const kindSections: Record<EntityKind, SectionId> = {
  workflow: "workflows",
  aggregate: "aggregates",
  "process-manager": "process-managers",
  timer: "process-managers",
  projection: "projections",
  stream: "streams",
  category: "streams",
  event: "streams",
  subscription: "streams",
  queue: "queues",
  "queue-message": "queues",
  processor: "queues",
}

export function entityKindSection(kind: EntityKind): SectionId {
  return kindSections[kind]
}

// Extra sidebar entries (presets) contributed by screen plans through registerFeature.
let extraEntries: Partial<Record<SectionId, SidebarEntry[]>> = {}
const listeners = new Set<() => void>()

export function registerNavigationEntries(entries: Partial<Record<SectionId, SidebarEntry[]>>) {
  const next = { ...extraEntries }
  for (const [id, list] of Object.entries(entries) as [SectionId, SidebarEntry[]][]) {
    const existing = next[id] ?? []
    next[id] = [...existing.filter((entry) => !list.some((e) => e.id === entry.id)), ...list]
  }
  extraEntries = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The section's own pages followed by the presets registered for it. */
export function useSectionEntries(section: Section): {
  pages: SidebarEntry[]
  presets: SidebarEntry[]
} {
  const extra = useSyncExternalStore(subscribe, () => extraEntries)
  return { pages: section.pages, presets: extra[section.id] ?? [] }
}
