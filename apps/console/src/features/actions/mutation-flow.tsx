import type { MutationHandle } from "@keiro-ui/client-keiro/mutations"
import { Button } from "@keiro-ui/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@keiro-ui/ui/components/dialog"
import { Input } from "@keiro-ui/ui/components/input"
import { toast } from "@keiro-ui/ui/components/sonner"
import { Spinner } from "@keiro-ui/ui/components/spinner"
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useEffect, useState } from "react"

import { JsonViewer } from "@/components/JsonViewer"

import { apiErrorOf, RefusalView } from "./refusal"
import { recordAction } from "./session-audit"

export interface PreviewSummary {
  headline: string
  /** Whether executing would change anything; when false, Execute is never offered. */
  changes: boolean
  /** Why nothing would change, shown in place of the confirmation step. */
  reason?: string
}

/** Refusals that mean the console sent something malformed: logged as client bugs. */
const CLIENT_BUGS = new Set([
  "invalid_confirmation",
  "unsupported_media_type",
  "inspection_request_too_large",
])

function logClientBug(error: unknown) {
  const api = apiErrorOf(error)
  if (api && CLIENT_BUGS.has(api.code))
    console.error(`keiro refused the console's request: ${api.code}`, api)
}

/**
 * keiro's preview → typed confirmation → execute → result, in one dialog. The preview runs on
 * open and renders before any confirmation control exists; Execute needs the target typed
 * exactly; refusals render in place; an unknown outcome forces a re-read and locks Execute
 * until the dialog is reopened (ADR-7, ADR-3).
 */
export function MutationFlow<P, R>({
  isOpen,
  onOpenChange,
  title,
  description,
  target,
  handle,
  summarize,
  resultHeadline,
  invalidate,
  audit,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  /** What the operator must retype to confirm (a timer id, a queue name). */
  target: string
  handle: MutationHandle<P, R>
  summarize: (preview: P) => PreviewSummary
  resultHeadline: (result: R) => string
  invalidate: QueryKey[]
  audit: { action: string }
}) {
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState("")
  const [locked, setLocked] = useState(false)
  const reread = () => {
    for (const queryKey of invalidate) void queryClient.invalidateQueries({ queryKey })
  }
  const preview = useMutation({ mutationFn: () => handle.preview(), onError: logClientBug })
  const execute = useMutation({
    mutationFn: () => handle.execute(),
    onSuccess: (executed) => {
      const headline = resultHeadline(executed.result)
      toast.success(`${title}: ${headline}`)
      recordAction({
        surface: "keiro",
        action: audit.action,
        target,
        outcome: headline,
        exitCode: executed.exit_code,
      })
      reread()
    },
    onError: (error) => {
      logClientBug(error)
      if (apiErrorOf(error)?.code === "mutation_outcome_unknown") {
        setLocked(true)
        recordAction({ surface: "keiro", action: audit.action, target, outcome: "outcome unknown" })
        reread()
      }
    },
  })
  const { mutate: runPreview, reset: resetPreview } = preview
  const { reset: resetExecute } = execute

  // The preview is requested whenever the dialog opens; a fresh open starts from scratch.
  useEffect(() => {
    if (!isOpen) return
    resetExecute()
    runPreview()
  }, [isOpen, runPreview, resetExecute])

  const close = () => {
    onOpenChange(false)
    setTyped("")
    setLocked(false)
    resetPreview()
    resetExecute()
  }

  const summary = preview.data ? summarize(preview.data.result) : undefined
  const busy = apiErrorOf(preview.error)?.code === "inspection_busy"
  const executed = execute.data
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => (open ? onOpenChange(true) : close())}
      className="sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div
        className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto text-sm"
        data-testid="mutation-flow"
      >
        {preview.isPending && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Asking keiro what this would do…
          </span>
        )}
        {preview.isError && (
          <>
            <RefusalView error={preview.error} />
            {busy && (
              <Button size="sm" variant="outline" className="w-fit" onPress={() => runPreview()}>
                Retry preview
              </Button>
            )}
          </>
        )}
        {preview.data && summary && !executed && (
          <section aria-label="Preview" className="flex flex-col gap-2">
            <p className="text-base font-semibold" data-testid="preview-headline">
              {summary.headline}
            </p>
            <JsonViewer label="Preview" value={preview.data.result} />
            {typeof preview.data.cli_reinvocation === "string" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">equivalent CLI command</span>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                  {preview.data.cli_reinvocation}
                </code>
              </div>
            )}
            {!summary.changes ? (
              <p className="text-muted-foreground" data-testid="no-change">
                {summary.reason ?? "Executing would change nothing."}
              </p>
            ) : (
              <label className="flex flex-col gap-1">
                <span>
                  Type <code className="font-mono">{target}</code> to confirm
                </span>
                <Input
                  aria-label="Confirmation"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}
          </section>
        )}
        {execute.isError && <RefusalView error={execute.error} />}
        {executed && (
          <section aria-label="Result" className="flex flex-col gap-2">
            <p className="text-base font-semibold" data-testid="result-headline">
              {resultHeadline(executed.result)}
            </p>
            <JsonViewer label="Result" value={executed.result} />
            {executed.exit_code !== undefined && (
              <span className="text-xs text-muted-foreground">exit code {executed.exit_code}</span>
            )}
          </section>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onPress={close}>
          Close
        </Button>
        {summary?.changes && !executed && (
          <Button
            variant="destructive"
            isDisabled={typed !== target || locked || execute.isPending}
            onPress={() => execute.mutate()}
          >
            {execute.isPending ? "Executing…" : "Execute"}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
