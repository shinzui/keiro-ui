import { isInspectionReadUnavailable, StatusClass } from "@keiro-ui/client-keiro"
import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"

import { Timestamp } from "@/components/timestamp"
import { formatInt } from "@/lib/format"
import { useLiveness } from "@/shell/liveness"

import { useWorkflowCounts } from "../queries"

export function WorkflowCountsSummary({ workflowName }: { workflowName?: string }) {
  const query = useWorkflowCounts(workflowName)
  const unavailable = isInspectionReadUnavailable(query.error, "workflow-counts")
  const { paused } = useLiveness()
  return (
    <Card role="region" aria-label="Workflow status totals" size="sm">
      <CardHeader>
        <CardTitle>Workflow status totals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          {workflowName === undefined
            ? "All retained workflows"
            : `Retained workflows named ${workflowName}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Status and time filters apply to the list below, not these totals.
        </p>
        {query.data && (
          <>
            <dl className="flex flex-wrap gap-4">
              {StatusClass.options.map((status) => (
                <div key={status}>
                  <dt>{status}</dt>
                  <dd className="tabular-nums" data-testid={`workflow-count-${status}`}>
                    {formatInt(query.data.counts[status])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              as of <Timestamp value={query.data.observed_at} />
              {paused && " · paused"}
            </p>
          </>
        )}
        {query.isPending && <p>Loading exact workflow counts…</p>}
        {query.error && (
          <p role="status" className="text-destructive">
            {query.data && "Stale counts: "}
            {unavailable
              ? "Exact workflow counts unavailable on this host"
              : `${query.error.code ?? "read_failed"}: ${query.error.message}`}
          </p>
        )}
        {query.error && (
          <Button size="xs" variant="outline" onPress={() => void query.refetch()}>
            Retry counts
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
