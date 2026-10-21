import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"

/** The inputs the instance's current state accepts, each with the state it moves to. */
export function WaitingForPanel({
  waitingFor,
}: {
  waitingFor: { input: string; target_state: string }[]
}) {
  return (
    <Card size="sm" role="region" aria-label="Waiting for">
      <CardHeader>
        <CardTitle>Waiting for</CardTitle>
      </CardHeader>
      <CardContent>
        {waitingFor.length === 0 ? (
          <p className="text-sm text-muted-foreground">not waiting on any input</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {waitingFor.map((w) => (
              <li key={`${w.input}→${w.target_state}`} className="font-mono text-xs">
                {w.input} <span className="text-muted-foreground">→</span> {w.target_state}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
