import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"
import { useLocation } from "@tanstack/react-router"
import { cn } from "cn"

import { AppLink } from "@/components/app-link"

import { type Section, sectionForPathname, sections } from "./navigation"

function RailButton({ section, active }: { section: Section; active: boolean }) {
  const Icon = section.icon
  return (
    <TooltipTrigger>
      <AppLink
        href={section.href}
        aria-label={section.title}
        aria-current={active ? "page" : undefined}
        data-active={active}
        className={cn(
          "flex size-9 items-center justify-center rounded-md text-sidebar-foreground/70 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-4" />
      </AppLink>
      <Tooltip placement="right">{section.title}</Tooltip>
    </TooltipTrigger>
  )
}

/** One icon per section; never collapses. Settings is pinned to the bottom. */
export function Rail() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const current = sectionForPathname(pathname)
  const main = sections.filter((section) => section.id !== "settings")
  const settings = sections.find((section) => section.id === "settings")!
  return (
    <nav
      aria-label="Sections"
      data-slot="rail"
      className="sticky top-0 z-20 flex h-svh w-12 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2"
    >
      <div className="mb-2 flex size-9 items-center justify-center text-xs font-bold" aria-hidden>
        経
      </div>
      {main.map((section) => (
        <RailButton key={section.id} section={section} active={section.id === current.id} />
      ))}
      <div className="mt-auto">
        <RailButton section={settings} active={settings.id === current.id} />
      </div>
    </nav>
  )
}
