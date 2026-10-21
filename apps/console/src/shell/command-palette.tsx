import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@keiro-ui/ui/components/command"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { type KeyboardEvent, useMemo, useState, useSyncExternalStore } from "react"

import { navigateToHref } from "@/lib/href"
import { useConnectionProfiles } from "@/settings/connection-profiles"

import { type Command as PaletteCommand, parseJump, useCommands } from "./commands"
import { useRecent } from "./recent"

// The palette's open state is a tiny module store so shortcuts, the bottom bar hint, and
// commands can all toggle it.
let paletteOpen = false
const listeners = new Set<() => void>()
function setPaletteOpen(open: boolean) {
  if (open === paletteOpen) return
  paletteOpen = open
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCommandPalette(): {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
} {
  const open = useSyncExternalStore(subscribe, () => paletteOpen)
  return { open, setOpen: setPaletteOpen, toggle: () => setPaletteOpen(!paletteOpen) }
}

/** Ask the open palette to show the profile sub-list ("Switch connection profile…"). */
let requestedMode: "commands" | "profiles" = "commands"
export function openProfileSwitcher() {
  requestedMode = "profiles"
  setPaletteOpen(true)
}

const PLACEHOLDER = "Jump to a page, entity, or type `workflow <name>/<id>`"

function textOf(command: PaletteCommand): string {
  return [command.label, command.hint, ...(command.keywords ?? [])].filter(Boolean).join(" ")
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/** The same case- and accent-insensitive `contains` the palette's filter applies. */
function matches(textValue: string, query: string): boolean {
  return fold(textValue).includes(fold(query.trim()))
}

/** Commands whose keywords or hint contain the query sort before label-only matches. */
function rank(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  const strong = (c: PaletteCommand) =>
    [c.hint, ...(c.keywords ?? [])].some((k) => k?.toLowerCase().includes(q))
  return [...commands.filter(strong), ...commands.filter((c) => !strong(c))]
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a page or entity, or run an action"
    >
      {open && <PaletteBody close={() => setOpen(false)} />}
    </CommandDialog>
  )
}

function PaletteBody({ close }: { close: () => void }) {
  const navigate = useNavigate()
  const router = useRouter()
  const commands = useCommands()
  const recent = useRecent({ limit: 20 })
  const { profiles, active, setActive } = useConnectionProfiles()
  const [input, setInput] = useState("")
  const [mode, setMode] = useState(() => {
    const initial = requestedMode
    requestedMode = "commands"
    return initial
  })

  const jump = parseJump(input)
  const recentCommands = useMemo<PaletteCommand[]>(
    () =>
      recent.map((visit) => ({
        id: `recent:${visit.href}`,
        group: "recent",
        label: visit.label,
        hint: visit.kind,
        run: () => void navigateToHref(router, visit.href),
      })),
    [recent, router],
  )

  const groups: { id: string; heading: string; items: PaletteCommand[] }[] =
    mode === "profiles"
      ? [
          {
            id: "profiles",
            heading: "Connection profiles",
            items: profiles.map((profile) => ({
              id: `profile:${profile.id}`,
              group: "actions",
              label: profile.name,
              hint: profile.id === active.id ? "active" : profile.mode,
              run: () => setActive(profile.id),
            })),
          },
        ]
      : [
          ...(jump
            ? [
                {
                  id: "jump",
                  heading: "Jump",
                  items: [
                    {
                      id: "jump:parsed",
                      group: "jump" as const,
                      label: jump.label,
                      run: ({ navigate: go }: { navigate: typeof navigate }) =>
                        void go(jump.href as never),
                    },
                  ],
                },
              ]
            : []),
          {
            id: "pages",
            heading: "Pages",
            items: rank(
              commands.filter((c) => c.group === "pages"),
              input,
            ),
          },
          { id: "recent", heading: "Recent", items: rank(recentCommands, input) },
          {
            id: "actions",
            heading: "Actions",
            items: rank(
              commands.filter((c) => c.group === "actions"),
              input,
            ),
          },
        ]

  const run = (command: PaletteCommand) => {
    // The profile sub-list stays inside the palette; everything else closes it first.
    if (command.id === "shell:switch-profile") {
      setMode("profiles")
      setInput("")
      return
    }
    close()
    command.run({ navigate, close })
  }

  const textValueOf = (command: PaletteCommand) =>
    command.id === "jump:parsed" ? input : textOf(command)
  const visibleGroups = groups
    .map((group) => ({
      id: group.id,
      heading: group.heading,
      items: group.items.filter((c) => matches(textValueOf(c), input)),
    }))
    .filter((group) => group.items.length > 0)

  // With no item focused (the list remounts per query), Enter runs the first ranked match.
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return
    const list = event.currentTarget.closest('[data-slot="command"]')
    if (list?.querySelector('[data-slot="command-item"][data-focused]')) return
    const first = visibleGroups[0]?.items[0]
    if (first) {
      event.preventDefault()
      run(first)
    }
  }

  return (
    <Command
      inputValue={input}
      onInputChange={setInput}
      filter={(text, query) => matches(text, query)}
    >
      <CommandInput
        placeholder={mode === "profiles" ? "Choose a connection profile" : PLACEHOLDER}
        onKeyDown={onInputKeyDown}
      />
      <CommandList
        // Remount per query so focus lands on the first *ranked* item; React Aria would
        // otherwise keep focus on an earlier first item that is still visible.
        key={`${mode}:${input}`}
        aria-label="Commands"
        renderEmptyState={() => <p className="py-6 text-center text-sm">No matching command.</p>}
      >
        {visibleGroups.map((group) => (
          <CommandGroup key={group.id} heading={group.heading} aria-label={group.heading}>
            {group.items.map((command) => (
              <CommandItem
                key={command.id}
                id={command.id}
                // The parsed jump bypasses the filter by matching the raw input exactly.
                textValue={textValueOf(command)}
                onAction={() => run(command)}
              >
                <span className="truncate">{command.label}</span>
                {command.hint && <CommandShortcut>{command.hint}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}
