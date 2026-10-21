import type { NavigateFn } from "@tanstack/react-router"
import { useEffect, useSyncExternalStore } from "react"

import { type LinkTarget, links } from "@/lib/links"

export type CommandGroup = "pages" | "recent" | "jump" | "actions"

export interface Command {
  id: string
  group: CommandGroup
  label: string
  /** Shown right-aligned, e.g. a path or shortcut. */
  hint?: string
  keywords?: string[]
  run: (ctx: { navigate: NavigateFn; close: () => void }) => void
}

// A module-level registry: static commands can be registered at module scope (through
// registerFeature) and page commands live exactly as long as their page is mounted.
let registry = new Map<string, Command>()
let snapshot: Command[] = []
const listeners = new Set<() => void>()

function publish() {
  snapshot = [...registry.values()]
  for (const listener of listeners) listener()
}

/** Adds commands for the lifetime of the app (static feature commands). */
export function registerCommands(commands: Command[]): () => void {
  registry = new Map(registry)
  for (const command of commands) registry.set(command.id, command)
  publish()
  return () => {
    registry = new Map(registry)
    for (const command of commands) {
      if (registry.get(command.id) === command) registry.delete(command.id)
    }
    publish()
  }
}

/** Adds commands while the calling component is mounted, keyed by `id`. */
export function useRegisterCommands(commands: Command[]): void {
  useEffect(() => registerCommands(commands), [commands])
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCommands(): Command[] {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export interface JumpParser {
  /** "workflow", "stream", ... */
  prefix: string
  /** "workflow <name>/<id>" */
  placeholder: string
  parse: (rest: string) => { label: string; href: LinkTarget } | null
}

type Jump = { label: string; href: LinkTarget }

/** Parses "a/b", split on its first slash; both halves must be non-empty. */
function two(build: (a: string, b: string) => Jump | null): (rest: string) => Jump | null {
  return (rest) => {
    const slash = rest.indexOf("/")
    if (slash <= 0 || slash === rest.length - 1) return null
    return build(rest.slice(0, slash), rest.slice(slash + 1))
  }
}

function one(build: (value: string) => Jump | null): (rest: string) => Jump | null {
  return (rest) => (rest.length > 0 ? build(rest) : null)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Every parsed "go to entity" command, one parser per entity kind in the link map. Screen
 * plans verify these rather than registering their own.
 */
export const jumpParsers: readonly JumpParser[] = [
  {
    prefix: "workflow",
    placeholder: "workflow <name>/<id>",
    parse: two((name, id) => ({
      label: `Open workflow ${name} / ${id}`,
      href: links.workflow(name, id),
    })),
  },
  {
    prefix: "aggregate",
    placeholder: "aggregate <type>/<id>",
    parse: two((type, id) => ({
      label: `Open aggregate ${type} / ${id}`,
      href: links.aggregate(type, id),
    })),
  },
  {
    prefix: "pm",
    placeholder: "pm <name>/<correlation>",
    parse: two((name, correlation) => ({
      label: `Open process manager ${name} / ${correlation}`,
      href: links.processManagerInstance(name, correlation),
    })),
  },
  {
    prefix: "timer",
    placeholder: "timer <id>",
    parse: one((id) => ({ label: `Open timer ${id}`, href: links.timer(id) })),
  },
  {
    prefix: "projection",
    placeholder: "projection <group>",
    parse: one((group) => ({
      label: `Open projection group ${group}`,
      href: links.projection(group),
    })),
  },
  {
    prefix: "stream",
    placeholder: "stream <name>",
    parse: one((name) => ({ label: `Open stream ${name}`, href: links.stream(name) })),
  },
  {
    prefix: "category",
    placeholder: "category <name>",
    parse: one((name) => ({ label: `Open category ${name}`, href: links.category(name) })),
  },
  {
    prefix: "event",
    placeholder: "event <uuid>",
    parse: one((id) =>
      UUID.test(id)
        ? { label: `Open event ${id.toLowerCase()}`, href: links.event(id.toLowerCase()) }
        : null,
    ),
  },
  {
    prefix: "subscription",
    placeholder: "subscription <name>",
    parse: one((name) => ({ label: `Open subscription ${name}`, href: links.subscription(name) })),
  },
  {
    prefix: "queue",
    placeholder: "queue <name>",
    parse: one((name) => ({ label: `Open queue ${name}`, href: links.queue(name) })),
  },
  {
    prefix: "message",
    placeholder: "message <queue>/<id>",
    parse: two((queue, id) =>
      /^\d+$/.test(id)
        ? { label: `Open message ${id} in ${queue}`, href: links.queueMessage(queue, id) }
        : null,
    ),
  },
  {
    prefix: "processor",
    placeholder: "processor <id>",
    parse: one((id) => ({ label: `Open processor ${id}`, href: links.processor(id) })),
  },
]

/** Splits on the first space, matches the prefix case-insensitively, delegates the rest. */
export function parseJump(input: string): { label: string; href: LinkTarget } | null {
  const trimmed = input.trim()
  const space = trimmed.search(/\s/)
  if (space <= 0) return null
  const prefix = trimmed.slice(0, space).toLowerCase()
  const rest = trimmed.slice(space).trim()
  if (!rest) return null
  const parser = jumpParsers.find((p) => p.prefix === prefix)
  return parser ? parser.parse(rest) : null
}
