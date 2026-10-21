import { Button } from "@keiro-ui/ui/components/button"
import { Input } from "@keiro-ui/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { Timestamp } from "@/components/timestamp"
import { links } from "@/lib/links"

import { useQueueBindings, useRoutingTest } from "./queries"

/** The queue's topic bindings and a routing-key tester over every binding. */
export function BindingsTab({ queue }: { queue: string }) {
  const bindings = useQueueBindings(queue)
  return (
    <div className="flex flex-col gap-6">
      {bindings.isError && <p className="text-sm text-destructive">{bindings.error.message}</p>}
      <Table aria-label="Topic bindings">
        <TableHeader>
          <TableHead isRowHeader>Pattern</TableHead>
          <TableHead>Compiled regex</TableHead>
          <TableHead>Bound</TableHead>
        </TableHeader>
        <TableBody
          renderEmptyState={() => (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {bindings.isPending ? "Loading…" : "No topic bindings route to this queue."}
            </p>
          )}
        >
          {(bindings.data ?? []).map((binding) => (
            <TableRow key={binding.pattern} id={binding.pattern}>
              <TableCell className="font-mono text-xs">{binding.pattern}</TableCell>
              <TableCell className="font-mono text-xs">{binding.compiled_regex}</TableCell>
              <TableCell>
                <Timestamp value={binding.bound_at} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <RoutingTest />
    </div>
  )
}

/** Which queues a routing key would reach (`/routing/test`); a read, nothing is sent. */
export function RoutingTest() {
  const [draft, setDraft] = useState("")
  const [key, setKey] = useState("")
  const matches = useRoutingTest(key)
  return (
    <section aria-label="Routing test" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Routing test</h2>
      <form
        className="flex max-w-md items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setKey(draft.trim())
        }}
      >
        <Input
          aria-label="Routing key"
          placeholder="orders.created"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          Test
        </Button>
      </form>
      {matches.isError && (
        <p className="text-sm text-destructive">
          {matches.error.code === "invalid_routing_key"
            ? `Invalid routing key: ${matches.error.message}`
            : matches.error.message}
        </p>
      )}
      {matches.data &&
        (matches.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No binding matches “{key}”.</p>
        ) : (
          <ul aria-label="Matching queues" className="flex flex-col gap-1 text-sm">
            {matches.data.map((match) => (
              <li key={`${match.queue_name} ${match.pattern}`}>
                <Link
                  {...links.queue(match.queue_name)}
                  className="underline-offset-2 hover:underline"
                >
                  {match.queue_name}
                </Link>{" "}
                <span className="font-mono text-xs text-muted-foreground">via {match.pattern}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
