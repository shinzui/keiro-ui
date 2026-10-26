import { isApiError } from "@keiro-ui/client-core"
import type { ControlStatus as ControlStatusBody, ProcessorState } from "@keiro-ui/client-shibuya"
import { shibuyaKeys, useShibuyaClient } from "@keiro-ui/client-shibuya"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@keiro-ui/ui/components/alert-dialog"
import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import { toast } from "@keiro-ui/ui/components/sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { RefusalView } from "@/features/actions/refusal"
import { recordAction } from "@/features/actions/session-audit"
import { useConnectionSession } from "@/settings/connection-session"
import { useRegisterCommands } from "@/shell/commands"
import { useSurfaceHealth } from "@/shell/health"

import { useControlStatus } from "./queries"

export const CONTROL_DISABLED =
  "Control operations are disabled on the server (enableControl = False)"
export const PAUSE_MEANING =
  "Intake stops at the adapter source; messages already in flight finish processing."

type Operation = "pause" | "resume"

/** `GET /control` as text: whether the host enabled control, and which operations exist. */
export function ControlStatusView({ status }: { status: ControlStatusBody }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>Control enabled: {status.enabled ? "yes" : "no"}</p>
      <p className="text-muted-foreground">
        Operations: {status.operations.length ? status.operations.join(", ") : "none"}
      </p>
    </div>
  )
}

function availability(
  status: ProcessorState["status"] | undefined,
  enabled: boolean,
): { pause: boolean; resume: boolean; reason?: string } {
  if (!enabled) return { pause: false, resume: false, reason: CONTROL_DISABLED }
  if (status === "failed" || status === "stopped")
    return { pause: false, resume: false, reason: "this processor is terminal" }
  if (status === "paused") return { pause: false, resume: true }
  return { pause: true, resume: false }
}

/**
 * The Control card: the server's gate, and pause/resume when it is on. A disabled gate shows
 * disabled buttons with the reason; a refusal renders as the server said it.
 */
export function ControlStatus({
  processorId,
  status,
  connectionLost,
}: {
  connectionLost?: boolean
  processorId?: string
  status?: ProcessorState["status"]
}) {
  const session = useConnectionSession()
  const health = useSurfaceHealth("shibuya")
  const control = useControlStatus()
  const shibuya = useShibuyaClient()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<Operation | null>(null)
  const action = useMutation({
    mutationFn: (operation: Operation) => {
      if (session && !session.active) throw new Error("Connection session expired")
      return operation === "pause"
        ? shibuya.control.pause(processorId!)
        : shibuya.control.resume(processorId!)
    },
    onSuccess: (result, operation) => {
      const outcome = result.pausedAt ? `${result.state} since ${result.pausedAt}` : result.state
      if (!session || session.active) toast.success(`${result.processor}: ${outcome}`)
      recordAction({
        connection: session?.identity,
        surface: "shibuya",
        action: operation,
        target: result.processor,
        outcome,
      })
      if (session && !session.active) return
      void queryClient.invalidateQueries({ queryKey: shibuyaKeys.processors() })
      void queryClient.invalidateQueries({ queryKey: shibuyaKeys.processor(result.processor) })
    },
    onSettled: () => {
      if (!session || session.active) setConfirming(null)
    },
  })
  const lost = !!connectionLost || health.status === "down" || control.isError
  if (lost && confirming !== null) setConfirming(null)
  const enabled = control.data?.enabled === true && !connectionLost && health.status !== "down"
  const can = availability(status, enabled)
  const commands = useMemo(
    () =>
      processorId && enabled
        ? (["pause", "resume"] as const)
            .filter((op) => (op === "pause" ? can.pause : can.resume))
            .map((op) => ({
              id: `processor:${op}:${processorId}`,
              group: "actions" as const,
              label: `${op === "pause" ? "Pause" : "Resume"} processor ${processorId}`,
              run: () => setConfirming(op),
            }))
        : [],
    [processorId, enabled, can.pause, can.resume],
  )
  useRegisterCommands(commands)
  const noRoute = isApiError(control.error) && control.error.status === 404
  return (
    <Card size="sm" role="region" aria-label="Control">
      <CardHeader>
        <CardTitle>Control</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {noRoute && (
          <p className="text-sm text-muted-foreground">
            This shibuya host has no control surface (its metrics server predates /control).
          </p>
        )}
        {control.isError && !noRoute && (
          <p className="text-sm text-destructive">{control.error.message}</p>
        )}
        {control.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {control.data && <ControlStatusView status={control.data} />}
        {processorId && (control.data || noRoute) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={!can.pause || action.isPending}
                onPress={() => setConfirming("pause")}
              >
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={!can.resume || action.isPending}
                onPress={() => setConfirming("resume")}
              >
                Resume
              </Button>
            </div>
            {(can.reason || noRoute) && (
              <p className="text-xs text-muted-foreground" data-testid="control-reason">
                {noRoute
                  ? "Pause and resume need a shibuya host with control support."
                  : can.reason}
              </p>
            )}
          </div>
        )}
        {action.isError && <RefusalView error={action.error} />}
      </CardContent>
      <AlertDialog
        isOpen={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirming === "pause" ? "Pause" : "Resume"} processor {processorId}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {session && (
              <span className="block font-semibold">
                {session.identity.app} · {session.identity.environment}
                {session.identity.workerId && ` · ${session.identity.workerId}`}
              </span>
            )}
            {confirming === "pause" ? PAUSE_MEANING : "Intake resumes at the adapter source."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={action.isPending}
            onPress={() => confirming && (!session || session.active) && action.mutate(confirming)}
          >
            {confirming === "pause" ? "Pause" : "Resume"}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </Card>
  )
}
