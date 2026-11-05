import { isApiError } from "@keiro-ui/client-core"
import type { StoredSnapshot } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Button } from "@keiro-ui/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@keiro-ui/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { useState } from "react"

import { JsonValue, JsonViewer, toJsonText } from "@/components/JsonViewer"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"

import { useStoredSnapshot } from "./queries"
import { type Registers, registersOf } from "./registers"
import { Hash } from "./SnapshotCard"

const same = (a: unknown, b: unknown) => toJsonText(a, 0) === toJsonText(b, 0)

function Comparison({
  current,
  stored,
  stateVersion,
  storedVersion,
}: {
  current: Registers
  stored: Registers
  stateVersion: bigint | null
  storedVersion: bigint
}) {
  const names = [...new Set([...Object.keys(current), ...Object.keys(stored)])].toSorted((a, b) =>
    a.localeCompare(b),
  )
  return (
    <section aria-label="Register comparison" className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground" data-testid="comparison-versions">
        current at state version {stateVersion?.toString() ?? "—"}, stored at stream version{" "}
        {storedVersion.toString()}
      </h3>
      <Table aria-label="Register comparison">
        <TableHeader>
          <TableHead isRowHeader>Register</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>Stored</TableHead>
          <TableHead>Difference</TableHead>
        </TableHeader>
        <TableBody>
          {names.map((name) => (
            <TableRow key={name} id={name}>
              <TableCell className="font-mono text-xs">{name}</TableCell>
              <TableCell>{name in current ? <JsonValue value={current[name]} /> : "—"}</TableCell>
              <TableCell>{name in stored ? <JsonValue value={stored[name]} /> : "—"}</TableCell>
              <TableCell data-testid={`difference-${name}`}>
                {name in current && name in stored && same(current[name], stored[name]) ? (
                  ""
                ) : (
                  <Badge variant="outline">changed</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Stored values are an advisory cache and can be older than current ones, and the two were
        read at different times.
      </p>
    </section>
  )
}

function Contents({
  snapshot,
  currentState,
  stateVersion,
}: {
  snapshot: StoredSnapshot
  currentState: unknown
  stateVersion: bigint | null
}) {
  const current = registersOf(currentState)
  const stored = registersOf(snapshot.state)
  return (
    <div className="flex flex-col gap-3" data-testid="stored-snapshot">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">stream version</dt>
        <dd>
          <PositionBadge value={snapshot.stream_version} label="stored stream version" />
        </dd>
        <dt className="text-muted-foreground">updated</dt>
        <dd>
          <Timestamp value={snapshot.updated_at} />
        </dd>
        <dt className="text-muted-foreground">codec version</dt>
        <dd>{snapshot.state_codec_version}</dd>
        <dt className="text-muted-foreground">regfile shape hash</dt>
        <dd>{snapshot.regfile_shape_hash ? <Hash value={snapshot.regfile_shape_hash} /> : "—"}</dd>
        <dt className="text-muted-foreground">state shape hash</dt>
        <dd>{snapshot.state_shape_hash ? <Hash value={snapshot.state_shape_hash} /> : "—"}</dd>
        <dt className="text-muted-foreground">bytes</dt>
        <dd className="tabular-nums">{snapshot.state_bytes}</dd>
      </dl>
      {current && stored && (
        <Comparison
          current={current}
          stored={stored}
          stateVersion={stateVersion}
          storedVersion={snapshot.stream_version}
        />
      )}
      <JsonViewer label="Stored state" value={snapshot.state} />
    </div>
  )
}

/**
 * What the snapshot actually holds. `/snapshot/show` returns raw persistence JSON that can include
 * fields the application's display omits and has no server-side gate to render, so nothing is
 * read until the operator asks and it is never polled (ADR-7). Keyed by stream, so moving to
 * another aggregate withdraws the answer and asks again.
 */
export function StoredSnapshotCard({
  stream,
  currentState,
  stateVersion,
}: {
  stream: string
  currentState: unknown
  stateVersion: bigint | null
}) {
  const [pressed, setPressed] = useState(false)
  const stored = useStoredSnapshot(stream, pressed)
  return (
    <Card size="sm" role="region" aria-label="Stored snapshot">
      <CardHeader>
        <CardTitle>Stored snapshot</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Shows the raw persisted JSON, which can include fields this application&apos;s display
          omits.
        </p>
        {pressed && stored.isError && (
          <p className="text-destructive" role="alert" data-testid="stored-snapshot-error">
            {stored.error.message}
            {isApiError(stored.error) && stored.error.code && ` (${stored.error.code})`}
          </p>
        )}
        {pressed && stored.isSuccess && stored.data === null && (
          <p data-testid="stored-snapshot-none">No stored snapshot for this stream.</p>
        )}
        {pressed && stored.data && (
          <Contents
            snapshot={stored.data}
            currentState={currentState}
            stateVersion={stateVersion}
          />
        )}
        <div>
          <Button
            size="sm"
            variant="outline"
            isDisabled={pressed && stored.isFetching}
            onPress={() => {
              if (pressed) void stored.refetch()
              else setPressed(true)
            }}
          >
            {pressed ? "Read again" : "Read stored snapshot"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
