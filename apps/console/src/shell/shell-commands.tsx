import { useRouter } from "@tanstack/react-router"
import { useMemo } from "react"

import { navigateToHref } from "@/lib/href"

import { type Command, useRegisterCommands } from "./commands"
import { useLiveness } from "./liveness"
import { sections } from "./navigation"
import { useRightSheet } from "./right-sheet"
import { setShortcutsOpen } from "./shortcuts"
import { type Theme, useTheme } from "./theme"

const nextTheme: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" }

/** The shell's own palette commands: every page, plus theme, liveness, profile, help, about. */
export function ShellCommands() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { paused, pause, resume } = useLiveness()
  const { open: openSheet } = useRightSheet()

  const pageCommands = useMemo<Command[]>(
    () =>
      sections.flatMap((section) =>
        section.pages.map((page) => ({
          id: `page:${section.id}:${page.id}`,
          group: "pages" as const,
          label: `Go to ${section.title} › ${page.title}`,
          hint: page.href,
          keywords: [page.title],
          run: () => void navigateToHref(router, page.href),
        })),
      ),
    [router],
  )

  const actionCommands = useMemo<Command[]>(
    () => [
      {
        id: "shell:toggle-theme",
        group: "actions",
        label: "Toggle theme",
        hint: `${theme} → ${nextTheme[theme]}`,
        keywords: ["dark", "light", "system"],
        run: () => setTheme(nextTheme[theme]),
      },
      paused
        ? { id: "shell:liveness", group: "actions", label: "Resume live updates", run: resume }
        : { id: "shell:liveness", group: "actions", label: "Pause live updates", run: pause },
      {
        id: "shell:switch-profile",
        group: "actions",
        label: "Switch connection profile…",
        keywords: ["connection", "origin"],
        // The palette handles this command by showing the profile sub-list.
        run: () => {},
      },
      {
        id: "shell:shortcuts",
        group: "actions",
        label: "Open shortcuts help",
        hint: "?",
        keywords: ["keyboard"],
        run: () => setShortcutsOpen(true),
      },
      {
        id: "shell:about",
        group: "actions",
        label: "About this console",
        keywords: ["version"],
        run: () => openSheet({ kind: "about", ref: "console" }),
      },
    ],
    [theme, setTheme, paused, pause, resume, openSheet],
  )

  useRegisterCommands(pageCommands)
  useRegisterCommands(actionCommands)
  return null
}
