import type { WorkflowInstance } from "@keiro-ui/client-keiro"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@keiro-ui/ui/components/select"
import type { ReactNode } from "react"

import { Timestamp } from "@/components/timestamp"

import { StatusClassBadge } from "./StatusClassBadge"
import { errorText } from "./WorkflowTable"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

const time = (value: string | null) => (value ? <Timestamp value={value} /> : "—")

/** The instance row: class and raw status, generation selector, lease, wake times. */
export function WorkflowHeader({
  workflow,
  generation,
  onGeneration,
}: {
  workflow: WorkflowInstance
  /** The generation being viewed; undefined is the current one. */
  generation: number | undefined
  onGeneration: (generation: number | undefined) => void
}) {
  const error = errorText(workflow.last_error)
  const viewing = generation ?? workflow.generation
  return (
    <section aria-label="Instance" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="status">
          <span className="flex items-center gap-2">
            <StatusClassBadge statusClass={workflow.status_class} />
            <span className="text-xs text-muted-foreground">{workflow.status}</span>
          </span>
        </Field>
        <Field label="generation">
          {workflow.generation > 0 ? (
            <Select
              aria-label="Generation"
              value={String(viewing)}
              onChange={(value) => {
                const n = Number(value)
                onGeneration(n === workflow.generation ? undefined : n)
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(
                  { length: workflow.generation + 1 },
                  (_, n) => workflow.generation - n,
                ).map((n) => (
                  <SelectItem key={n} id={String(n)}>
                    {n === workflow.generation ? `${n} (current)` : String(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            "0"
          )}
        </Field>
        <Field label="attempts">{workflow.attempts}</Field>
        <Field label="next attempt">{time(workflow.next_attempt_at)}</Field>
        <Field label="wake after">{time(workflow.wake_after)}</Field>
        <Field label="lease">
          {workflow.leased_by ? (
            <>
              {workflow.leased_by} until {time(workflow.lease_expires_at)}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label="created">{time(workflow.created_at)}</Field>
        <Field label="updated">{time(workflow.updated_at)}</Field>
        <Field label="completed">{time(workflow.completed_at)}</Field>
      </div>
      {error && (
        <pre className="max-h-32 overflow-auto rounded-md bg-destructive/5 p-2 text-xs whitespace-pre-wrap text-destructive">
          {error}
        </pre>
      )}
    </section>
  )
}
