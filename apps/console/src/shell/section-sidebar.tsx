import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@keiro-ui/ui/components/sidebar"
import { useLocation } from "@tanstack/react-router"
import { Circle, History, Pin } from "lucide-react"

import {
  entityKindSection,
  type SidebarEntry,
  sectionForPathname,
  useSectionEntries,
} from "./navigation"
import { usePinned, useRecent } from "./recent"

function pathOf(href: string): string {
  const query = href.indexOf("?")
  return query === -1 ? href : href.slice(0, query)
}

function EntryList({
  entries,
  activePath,
  fallbackIcon,
}: {
  entries: SidebarEntry[]
  activePath: string
  fallbackIcon: typeof Circle
}) {
  return (
    <SidebarMenu>
      {entries.map((entry) => {
        const Icon = entry.icon ?? fallbackIcon
        return (
          <SidebarMenuItem key={entry.id}>
            <SidebarMenuButton
              href={entry.href}
              isActive={pathOf(entry.href) === activePath && !entry.href.includes("?")}
              tooltip={entry.title}
            >
              <Icon />
              <span className="truncate">{entry.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function SectionSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const section = sectionForPathname(pathname)
  const { pages, presets } = useSectionEntries(section)
  const recent = useRecent({ section: section.id, limit: 10 })
  const { pinned } = usePinned()
  const sectionPins = pinned.filter((visit) => entityKindSection(visit.kind) === section.id)

  return (
    <>
      <SidebarHeader className="flex-row items-center justify-between gap-2 border-b">
        <span className="truncate px-2 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          {section.title}
        </span>
        <SidebarTrigger aria-label="Toggle sidebar" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <EntryList
              entries={[...pages, ...presets]}
              activePath={pathname}
              fallbackIcon={Circle}
            />
          </SidebarGroupContent>
        </SidebarGroup>
        {sectionPins.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarGroupContent>
              <EntryList
                entries={sectionPins.map((v) => ({ id: v.href, title: v.label, href: v.href }))}
                activePath={pathname}
                fallbackIcon={Pin}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {recent.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Entities you open appear here.
              </p>
            ) : (
              <EntryList
                entries={recent.map((v) => ({ id: v.href, title: v.label, href: v.href }))}
                activePath={pathname}
                fallbackIcon={History}
              />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
