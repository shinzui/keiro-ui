import { useKeiroClient } from "@keiro-ui/client-keiro"
import {
  type DlqRedrivePreview,
  type DlqRedriveResult,
  keiroMutations,
} from "@keiro-ui/client-keiro/mutations"
import { pgmqKeys } from "@keiro-ui/client-pgmq"
import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { Input } from "@keiro-ui/ui/components/input"
import { useMemo, useState } from "react"

import { useKeiroMutationsGate } from "@/features/actions/gate"
import { MutationFlow, type PreviewSummary } from "@/features/actions/mutation-flow"
import { formatInt } from "@/lib/format"
import { deadLetterSuffix, useConnectionProfiles } from "@/settings/connection-profiles"

export const JOB_LEVEL_SENTENCE =
  "Redrive moves these messages back to their original queue using keiro's job-level redrive (/keiro/pgmq/dlq/redrive). Adapter-level redrive is not available on this stack."

export function summarizeRedrive(preview: DlqRedrivePreview): PreviewSummary {
  const headline = `${formatInt(preview.available)} messages available, at most ${formatInt(preview.would_affect_at_most)} would move`
  return preview.would_affect_at_most > 0
    ? { headline, changes: true }
    : { headline, changes: false, reason: "No message would move, so nothing would change." }
}

export const redriveResultHeadline = (result: DlqRedriveResult) =>
  `${formatInt(result.affected)} messages moved to ${result.queue}`

/** The logical job queue for a dead-letter queue name, or null when it is not one. */
export function logicalQueueOf(name: string, suffix: string): string | null {
  if (!name.endsWith(suffix) || name.length <= suffix.length) return null
  const logical = name.slice(0, -suffix.length)
  // keiro derives `<queue>_dlq` itself and refuses a logical name that already ends in `_dlq`.
  return logical.endsWith("_dlq") ? null : logical
}

/**
 * On a dead-letter queue (by the profile's suffix): keiro's job-level redrive through the
 * shared preview → typed confirmation → result flow, gated by keiro's mutation gate.
 */
export function DeadLetterRedrive({ queue, length }: { queue: string; length?: bigint }) {
  const { active } = useConnectionProfiles()
  const suffix = deadLetterSuffix(active)
  const logical = logicalQueueOf(queue, suffix)
  const gate = useKeiroMutationsGate()
  const keiro = useKeiroClient()
  const [limitText, setLimitText] = useState("100")
  const [open, setOpen] = useState(false)
  const limit = /^\d+$/.test(limitText) && Number(limitText) > 0 ? Number(limitText) : undefined
  const handle = useMemo(
    () => (logical ? keiroMutations(keiro).pgmq.dlqRedrive({ queue: logical, limit }) : null),
    [keiro, logical, limit],
  )
  if (!logical) return null
  return (
    <Card size="sm" role="region" aria-label="Dead letters">
      <CardHeader>
        <CardTitle>Dead letters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>{JOB_LEVEL_SENTENCE}</p>
        <p className="text-xs text-muted-foreground" data-testid="logical-queue">
          Original queue: <code className="font-mono">{logical}</code>, derived from the suffix{" "}
          <code className="font-mono">{suffix}</code> in the connection profile. keiro sanitizes and
          hashes long queue names, so a derived name can be wrong for such queues; the preview shows
          the queue keiro will act on.
        </p>
        {length !== undefined && <p>{formatInt(length)} messages in this queue.</p>}
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Messages per redrive
            <Input
              aria-label="Redrive limit"
              inputMode="numeric"
              className="w-28"
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            isDisabled={!gate.enabled || limit === undefined}
            onPress={() => setOpen(true)}
          >
            Redrive
          </Button>
        </div>
        {gate.reason && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="gate-reason"
            title={gate.drift?.join("\n")}
          >
            {gate.reason}
          </p>
        )}
        {open && handle && (
          <MutationFlow
            isOpen
            onOpenChange={setOpen}
            title={`Redrive ${queue}`}
            description={`Moves up to ${limit} messages back to ${logical} through keiro.`}
            target={queue}
            handle={handle}
            summarize={summarizeRedrive}
            resultHeadline={redriveResultHeadline}
            invalidate={[
              pgmqKeys.queueMetrics(queue),
              pgmqKeys.queueMetrics(logical),
              pgmqKeys.allMetrics(),
              ["pgmq", "messages", queue],
              ["pgmq", "messages", logical],
              ["pgmq", "archive", queue],
            ]}
            audit={{ action: "dead-letter redrive" }}
          />
        )}
      </CardContent>
    </Card>
  )
}
