import type { ControlStatus as ControlStatusBody } from "@keiro-ui/client-shibuya"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"

import { useControlStatus } from "./queries"

/** `GET /control` as text: whether the host enabled control, and which operations exist. */
export function ControlStatusView({ status }: { status: ControlStatusBody }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>Control enabled: {status.enabled ? "yes" : "no"}</p>
      <p className="text-muted-foreground">
        Operations: {status.operations.length ? status.operations.join(", ") : "none"}
      </p>
      <p className="text-xs text-muted-foreground">Operator actions arrive in a later release.</p>
    </div>
  )
}

/** The read-only Control card; no buttons until the gated-actions release. */
export function ControlStatus() {
  const control = useControlStatus()
  return (
    <Card size="sm" role="region" aria-label="Control">
      <CardHeader>
        <CardTitle>Control</CardTitle>
      </CardHeader>
      <CardContent>
        {control.isError && <p className="text-sm text-destructive">{control.error.message}</p>}
        {control.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {control.data && <ControlStatusView status={control.data} />}
      </CardContent>
    </Card>
  )
}
