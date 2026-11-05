import { isRouteUnavailable, type ProcessManagerType } from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { PageHeader } from "@/components/page-header"
import { useKnownManagerNames, useProcessManagerTypes } from "@/features/process-managers/queries"
import { links } from "@/lib/links"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/process-managers/")({
  validateSearch: shellSearchSchema,
  component: ProcessManagersPage,
})

function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {names.map((name) => (
          <li key={name}>
            <Link {...links.processManager(name)} className="underline-offset-2 hover:underline">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A host older than keiro 0.22 can serve `pm list` yet refuse `pm types` exactly as a host with no
 * hooks does, so this must not claim either cause: opening a manager by name is what tells them apart.
 */
function OpenByName() {
  const navigate = useNavigate()
  const { configured, recent } = useKnownManagerNames()
  const [name, setName] = useState("")
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-sm" data-testid="catalog-unavailable">
        This keiro host does not list its process managers. Open one by name.
      </p>
      <form
        aria-label="Open a process manager"
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = name.trim()
          if (value) void navigate(links.processManager(value))
        }}
      >
        <Input
          aria-label="Process manager name"
          placeholder="Process manager name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="sm" variant="outline" isDisabled={name.trim() === ""}>
          Open
        </Button>
      </form>
      <NameList title="Configured for this connection" names={configured} />
      <NameList title="Recently opened" names={recent} />
      {configured.length === 0 && recent.length === 0 && (
        <p className="text-sm text-muted-foreground">No process manager names known yet.</p>
      )}
      <p className="text-xs text-muted-foreground">
        <Link {...links.settingsConnections()} className="underline-offset-2 hover:underline">
          Settings → Connections
        </Link>
      </p>
    </div>
  )
}

/** `null` means keiro does not know, which must not read as "no". */
function timersLabel(timers: ProcessManagerType["timers_configured"]): string {
  if (timers === null) return "unknown"
  return timers ? "yes" : "no"
}

function ProcessManagersPage() {
  const types = useProcessManagerTypes()
  return (
    <>
      <PageHeader
        title="Process managers"
        description="Each manager's instances are its correlations; open one to see what it is waiting for."
      />
      <div className="flex flex-col gap-3 p-6">
        {isRouteUnavailable(types.error) ? (
          <OpenByName />
        ) : (
          <>
            {types.isError && <p className="text-sm text-destructive">{types.error.message}</p>}
            <Table aria-label="Process managers">
              <TableHeader>
                <TableHead isRowHeader>Manager</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Snapshots</TableHead>
                <TableHead>Snapshot policy</TableHead>
                <TableHead>Timers</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {types.isPending
                      ? "Loading…"
                      : types.isError
                        ? "The catalog could not be read."
                        : "This host mounts no process managers."}
                  </p>
                )}
              >
                {(types.data?.items ?? []).map((manager) => (
                  <TableRow key={manager.name} id={manager.name}>
                    <TableCell>
                      <Link
                        {...links.processManager(manager.name)}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {manager.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link {...links.category(manager.category)}>
                        <Badge variant="outline">{manager.category}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={manager.snapshots_configured ? "secondary" : "outline"}>
                        {manager.snapshots_configured ? "configured" : "off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{manager.snapshot_policy}</TableCell>
                    <TableCell data-testid={`timers-${manager.name}`}>
                      {timersLabel(manager.timers_configured)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </>
  )
}
