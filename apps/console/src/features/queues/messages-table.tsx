import type { ArchivedMessage, Message } from "@keiro-ui/client-pgmq"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"

import { Timestamp } from "@/components/timestamp"
import { formatInt } from "@/lib/format"
import { useRightSheet } from "@/shell/right-sheet"

import { detectDeadLetter } from "./dead-letter"

export const VISIBLE_AT_HINT =
  "When the message becomes readable again. A future time means a consumer has leased it or it was sent with a delay."

/** "content-type=application/json, trace_id=t-1"; "—" for no headers. */
export function headersSummary(headers: unknown): string {
  if (headers === null || headers === undefined) return "—"
  if (typeof headers !== "object" || Array.isArray(headers)) return JSON.stringify(headers)
  const entries = Object.entries(headers as Record<string, unknown>)
  if (entries.length === 0) return "—"
  return entries.map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ")
}

/** `vt` as relative time ("in 2 min" while leased or delayed, "3 s ago" once visible). */
export function VisibleAt({ vt }: { vt: string }) {
  return <Timestamp value={vt} hint={VISIBLE_AT_HINT} />
}

/** One page of messages (or archived messages); a row opens the `queue-message` sheet. */
export function MessagesTable({
  queue,
  messages,
  archive = false,
  isPending,
}: {
  queue: string
  messages: (Message | ArchivedMessage)[]
  archive?: boolean
  isPending: boolean
}) {
  const { open } = useRightSheet()
  return (
    <Table aria-label={archive ? "Archived messages" : "Messages"}>
      <TableHeader>
        <TableHead isRowHeader>Message id</TableHead>
        <TableHead>Reads</TableHead>
        <TableHead>Enqueued</TableHead>
        <TableHead>Last read</TableHead>
        <TableHead>Visible at</TableHead>
        {archive && <TableHead>Archived</TableHead>}
        <TableHead>Headers</TableHead>
      </TableHeader>
      <TableBody
        renderEmptyState={() => (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {isPending ? "Loading…" : archive ? "The archive is empty." : "No messages."}
          </p>
        )}
      >
        {messages.map((message) => {
          const id = message.msg_id.toString()
          return (
            <TableRow
              key={id}
              id={id}
              onAction={() => open({ kind: "queue-message", ref: `${queue}/${id}` })}
              className="cursor-pointer"
            >
              <TableCell className="font-mono text-xs" textValue={id}>
                {id}
                {detectDeadLetter(message.message) && (
                  <span className="ml-2 font-sans text-destructive">dead letter</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{formatInt(message.read_ct)}</TableCell>
              <TableCell>
                <Timestamp value={message.enqueued_at} />
              </TableCell>
              <TableCell>
                {message.last_read_at ? <Timestamp value={message.last_read_at} /> : "never"}
              </TableCell>
              <TableCell>
                <VisibleAt vt={message.vt} />
              </TableCell>
              {archive && (
                <TableCell>
                  {"archived_at" in message ? <Timestamp value={message.archived_at} /> : "—"}
                </TableCell>
              )}
              <TableCell className="max-w-64 truncate font-mono text-xs">
                {headersSummary(message.headers)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
