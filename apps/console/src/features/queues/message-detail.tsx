import { JsonViewer } from "@/components/JsonViewer"
import { Timestamp } from "@/components/timestamp"
import { formatInt } from "@/lib/format"

import { detectDeadLetter } from "./dead-letter"
import { DeadLetterPanel } from "./dead-letter-panel"
import { VisibleAt } from "./messages-table"
import type { LocatedMessage } from "./queries"

/** A message's timing fields, headers, dead-letter panel (when the adapter wrote it), payload. */
export function MessageDetail({ located }: { located: LocatedMessage }) {
  const { message } = located
  const deadLetter = detectDeadLetter(message.message)
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Message id</dt>
        <dd className="font-mono text-xs" data-testid="message-id">
          {message.msg_id.toString()}
        </dd>
        <dt className="text-muted-foreground">Where</dt>
        <dd>{located.where === "archive" ? "archive" : "queue"}</dd>
        <dt className="text-muted-foreground">Reads</dt>
        <dd>{formatInt(message.read_ct)}</dd>
        <dt className="text-muted-foreground">Enqueued</dt>
        <dd>
          <Timestamp value={message.enqueued_at} />
        </dd>
        <dt className="text-muted-foreground">Last read</dt>
        <dd>{message.last_read_at ? <Timestamp value={message.last_read_at} /> : "never"}</dd>
        <dt className="text-muted-foreground">Visible at</dt>
        <dd>
          <VisibleAt vt={message.vt} />
        </dd>
        {located.where === "archive" && (
          <>
            <dt className="text-muted-foreground">Archived</dt>
            <dd>
              <Timestamp value={located.message.archived_at} />
            </dd>
          </>
        )}
      </dl>
      {deadLetter && <DeadLetterPanel deadLetter={deadLetter} />}
      <JsonViewer label="Headers" value={message.headers} />
      <JsonViewer label="Message" value={message.message} />
    </div>
  )
}

/** Splits a `queue-message` sheet ref, `<queue>/<msg_id>`, on its last slash. */
export function parseMessageRef(ref: string): { queue: string; id: string } {
  const slash = ref.lastIndexOf("/")
  return slash < 0
    ? { queue: ref, id: "" }
    : { queue: ref.slice(0, slash), id: ref.slice(slash + 1) }
}
