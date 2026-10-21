import type { WorkflowStatusClass } from "@keiro-ui/client-keiro"

import { links } from "@/lib/links"
import { stringifySearch } from "@/lib/search"
import { registerFeature } from "@/shell/features"

import { JournalEntrySheet } from "./components/JournalEntrySheet"
import { STATUS_CLASSES } from "./search"

// Hrefs are built from the search serializer, not `hrefOf`: this module runs while the router
// module is still being evaluated (`__root.tsx` registers features at import time).
const presetHref = (statusClass: WorkflowStatusClass) =>
  `/workflows${stringifySearch({ status_class: [statusClass] })}`

const PRESETS = [
  { id: "workflows-running", title: "Running", statusClass: "running" },
  { id: "workflows-retrying", title: "Retrying", statusClass: "retrying" },
  { id: "workflows-failed", title: "Failed", statusClass: "failed" },
] as const

/** The Workflows section's contributions to the shell. */
export function registerWorkflowsFeature(): void {
  registerFeature({
    id: "workflows",
    sheets: { "journal-entry": JournalEntrySheet },
    navigation: {
      workflows: PRESETS.map((p) => ({
        id: p.id,
        title: p.title,
        href: presetHref(p.statusClass),
      })),
    },
    commands: STATUS_CLASSES.map((statusClass) => ({
      id: `workflows:class:${statusClass}`,
      group: "pages" as const,
      label: `Workflows: ${statusClass}`,
      hint: presetHref(statusClass),
      keywords: ["workflow", statusClass],
      run: ({ navigate }) =>
        void navigate(links.workflows({ status_class: [statusClass] }) as never),
    })),
  })
}
