import { Badge } from "@keiro-ui/ui/components/badge"
import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { useNavigate } from "@tanstack/react-router"

import { Timestamp } from "@/components/timestamp"
import type { SheetProps } from "@/shell/right-sheet"
import { useStatusSlot } from "@/shell/status-slots"

import { useSessionAudit } from "./session-audit"

/** Sheet kind `actions`: what this browser session executed, newest first. */
export function SessionAuditSheet(_props: SheetProps) {
  const entries = useSessionAudit()
  return (
    <>
      <SheetHeader>
        <SheetTitle>Actions this session</SheetTitle>
        <SheetDescription>
          Kept in this tab's memory only; a reload clears the list.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-2 px-4 pb-4 text-sm">
        {entries.length === 0 && <p className="text-muted-foreground">No actions executed yet.</p>}
        <ol aria-label="Executed actions" className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={`${entry.at}-${entry.target}`}
              className="flex flex-col gap-0.5 rounded-md border p-2"
            >
              <span className="flex items-center gap-2">
                {entry.connection && (
                  <span>
                    {entry.connection.app} · {entry.connection.environment}
                    {entry.connection.workerId && ` · ${entry.connection.workerId}`}
                  </span>
                )}
                <Badge variant="outline">{entry.surface}</Badge>
                <span className="font-medium">{entry.action}</span>
                <span className="font-mono text-xs break-all">{entry.target}</span>
              </span>
              <span className="text-xs">
                {entry.outcome}
                {entry.exitCode !== undefined && ` · exit code ${entry.exitCode}`}
              </span>
              <span className="text-xs text-muted-foreground">
                <Timestamp value={entry.at} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

/** Fills the bottom bar's `actions` slot with the session's count once something ran. */
export function SessionAuditStatus() {
  const entries = useSessionAudit()
  const navigate = useNavigate()
  useStatusSlot(
    "actions",
    entries.length === 0 ? null : (
      <button
        type="button"
        className="underline-offset-2 hover:underline"
        onClick={() =>
          void navigate({
            to: ".",
            search: (prev: Record<string, unknown>) => ({ ...prev, sheet: "actions:session" }),
          } as never)
        }
      >
        {entries.length} {entries.length === 1 ? "action" : "actions"} this session
      </button>
    ),
  )
  return null
}
