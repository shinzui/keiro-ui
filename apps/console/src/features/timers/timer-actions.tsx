import { keiroKeys, useKeiroClient } from "@keiro-ui/client-keiro"
import {
  keiroMutations,
  type TimerMutationPreview,
  type TimerMutationResult,
} from "@keiro-ui/client-keiro/mutations"
import { Button } from "@keiro-ui/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@keiro-ui/ui/components/dropdown-menu"
import { EllipsisVertical } from "lucide-react"
import { useMemo, useState } from "react"

import { useKeiroMutationsGate } from "@/features/actions/gate"
import { MutationFlow, type PreviewSummary } from "@/features/actions/mutation-flow"

type Verb = "requeue" | "cancel"

const NO_CHANGE: Record<string, string> = {
  not_found: "keiro has no timer with this id, so nothing would change.",
  not_firing:
    "The timer is not firing; requeue applies only to a firing timer, so nothing would change.",
  already_terminal: "The timer already reached a terminal state, so nothing would change.",
}

/** A timer preview's disposition as the dialog's headline; the no-change cases offer no Execute. */
export function summarizeTimer(preview: TimerMutationPreview): PreviewSummary {
  const headline = preview.disposition.replaceAll("_", " ")
  const reason = NO_CHANGE[preview.disposition]
  return reason ? { headline, changes: false, reason } : { headline, changes: true }
}

export const timerResultHeadline = (result: TimerMutationResult) =>
  result.outcome.replaceAll("_", " ")

// After an executed timer action the ledgers and instance pages re-read (ADR-3).
const INVALIDATE = [keiroKeys.timers.all(), ["keiro", "process-managers", "show"]]

function TimerFlow({
  timerId,
  verb,
  onClose,
}: {
  timerId: string
  verb: Verb
  onClose: () => void
}) {
  const keiro = useKeiroClient()
  const handle = useMemo(() => keiroMutations(keiro).timers[verb](timerId), [keiro, verb, timerId])
  return (
    <MutationFlow
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`${verb === "requeue" ? "Requeue" : "Cancel"} timer`}
      description={
        verb === "requeue"
          ? "Moves a stuck firing timer back to scheduled so it fires again."
          : "Cancels the timer so it never fires."
      }
      target={timerId}
      handle={handle}
      summarize={summarizeTimer}
      resultHeadline={timerResultHeadline}
      invalidate={INVALIDATE}
      audit={{ action: `timer ${verb}` }}
    />
  )
}

/** Requeue and Cancel buttons (the timer sheet), disabled with keiro's reason when gated. */
export function TimerActionButtons({ timerId }: { timerId: string }) {
  const gate = useKeiroMutationsGate()
  const [verb, setVerb] = useState<Verb | null>(null)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          isDisabled={!gate.enabled}
          onPress={() => setVerb("requeue")}
        >
          Requeue
        </Button>
        <Button
          size="sm"
          variant="outline"
          isDisabled={!gate.enabled}
          onPress={() => setVerb("cancel")}
        >
          Cancel timer
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
      {verb && <TimerFlow timerId={timerId} verb={verb} onClose={() => setVerb(null)} />}
    </div>
  )
}

/** The `/timers` row menu: the same two actions; a disabled button when keiro gates them. */
export function TimerRowActions({ timerId }: { timerId: string }) {
  const gate = useKeiroMutationsGate()
  const [verb, setVerb] = useState<Verb | null>(null)
  if (!gate.enabled)
    return (
      <Button
        size="icon-xs"
        variant="ghost"
        isDisabled
        aria-label={`Actions for timer ${timerId} (${gate.reason})`}
      >
        <EllipsisVertical />
      </Button>
    )
  return (
    <>
      <DropdownMenuTrigger>
        <Button size="icon-xs" variant="ghost" aria-label={`Actions for timer ${timerId}`}>
          <EllipsisVertical />
        </Button>
        <DropdownMenu
          aria-label={`Timer ${timerId} actions`}
          onAction={(key) => setVerb(key as Verb)}
        >
          <DropdownMenuItem id="requeue">Requeue…</DropdownMenuItem>
          <DropdownMenuItem id="cancel" variant="destructive">
            Cancel…
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
      {verb && <TimerFlow timerId={timerId} verb={verb} onClose={() => setVerb(null)} />}
    </>
  )
}

/** The gate's reason once above a list of actionable rows, when keiro refuses mutations. */
export function GateNotice({ subject }: { subject: string }) {
  const gate = useKeiroMutationsGate()
  if (gate.enabled || !gate.reason) return null
  return (
    <p
      className="text-xs text-muted-foreground"
      data-testid="gate-reason"
      title={gate.drift?.join("\n")}
    >
      {subject}: {gate.reason}
    </p>
  )
}
