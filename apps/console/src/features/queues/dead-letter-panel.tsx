import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"

import { JsonViewer } from "@/components/JsonViewer"
import { Timestamp } from "@/components/timestamp"
import { formatInt } from "@/lib/format"

import { type DeadLetterPayload, REDRIVE_UNAVAILABLE } from "./dead-letter"

/** The adapter's dead-letter fields, read-only; redrive is reported as unavailable. */
export function DeadLetterPanel({ deadLetter }: { deadLetter: DeadLetterPayload }) {
  const d = deadLetter
  return (
    <Card role="region" aria-label="Dead letter" size="sm">
      <CardHeader>
        <CardTitle>Dead letter</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Reason code</dt>
          <dd className="font-mono text-xs">{d.reasonCode}</dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd className="break-words">{d.reason}</dd>
          <dt className="text-muted-foreground">Attempts</dt>
          <dd>
            {d.readCount === undefined ? (
              <span className="text-muted-foreground">not recorded</span>
            ) : (
              formatInt(d.readCount)
            )}
          </dd>
          <dt className="text-muted-foreground">Originally enqueued</dt>
          <dd>
            {d.originalEnqueuedAt ? (
              <Timestamp value={d.originalEnqueuedAt} />
            ) : (
              <span className="text-muted-foreground">not recorded</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Original message id</dt>
          <dd className="font-mono text-xs">
            {d.originalMessageId === undefined ? (
              <span className="text-muted-foreground">not recorded</span>
            ) : (
              d.originalMessageId.toString()
            )}
          </dd>
          <dt className="text-muted-foreground">Detail</dt>
          <dd>
            {d.reasonDetail === null || d.reasonDetail === undefined ? (
              <span className="text-muted-foreground">none</span>
            ) : (
              <JsonViewer label="Reason detail" value={d.reasonDetail} />
            )}
          </dd>
        </dl>
        {d.originalHeaders !== undefined && d.originalHeaders !== null && (
          <JsonViewer label="Original headers" value={d.originalHeaders} />
        )}
        <JsonViewer label="Original message" value={d.originalMessage} />
        <p className="text-sm text-muted-foreground">{REDRIVE_UNAVAILABLE}</p>
      </CardContent>
    </Card>
  )
}
