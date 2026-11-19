import {
  TOPOLOGY_NODE_KINDS,
  type TopologyIndex,
  type TopologyNode,
  type TopologyNodeKind,
} from "@keiro-ui/client-keiro"
import { Badge } from "@keiro-ui/ui/components/badge"
import { Input } from "@keiro-ui/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"

import { links } from "@/lib/links"

import {
  GROUP_ACCENT,
  KIND_GROUPS,
  kindGroupOf,
  kindLabel,
  kindPluralLabel,
  stableNameOf,
} from "./labels"

const isKind = (value: string | undefined): value is TopologyNodeKind =>
  (TOPOLOGY_NODE_KINDS as readonly string[]).includes(value ?? "")

/** A declaration matches when its name or stable name contains the text, ignoring case. */
export function matchesText(node: TopologyNode, text: string): boolean {
  const needle = text.trim().toLowerCase()
  if (!needle) return true
  return (
    node.name.toLowerCase().includes(needle) ||
    (stableNameOf(node.details)?.toLowerCase().includes(needle) ?? false)
  )
}

/**
 * Every declaration, filtered through the URL, under the map's five kind groups and then by
 * kind in the contract's order. Every kind's table shares one column layout, so the columns
 * line up down the page.
 */
export function Inventory({
  index,
  q,
  kind,
}: {
  index: TopologyIndex
  q: string | undefined
  kind: string | undefined
}) {
  const navigate = useNavigate()
  const selected = isKind(kind) ? kind : undefined
  // Kinds in the order the page draws them: by group, then in the contract's order.
  const present = KIND_GROUPS.flatMap((group) =>
    TOPOLOGY_NODE_KINDS.filter((k) => kindGroupOf(k).id === group.id && index.byKind(k).length > 0),
  )
  const groups = KIND_GROUPS.map((group) => {
    const kinds = present
      .filter((k) => kindGroupOf(k).id === group.id && (selected === undefined || k === selected))
      .map((k) => ({
        kind: k,
        nodes: index.byKind(k).filter((node) => matchesText(node, q ?? "")),
      }))
      .filter((entry) => entry.nodes.length > 0)
    return { group, kinds, count: kinds.reduce((n, entry) => n + entry.nodes.length, 0) }
  }).filter((entry) => entry.kinds.length > 0)
  const shown = groups.reduce((total, group) => total + group.count, 0)
  const total = index.document.nodes.length
  const filtered = Boolean(q?.trim()) || selected !== undefined
  // A context shared by every declaration is said once, not repeated on every row.
  const contexts = new Set(index.document.nodes.map((node) => node.context))
  const sharedContext = contexts.size === 1 ? [...contexts][0] : undefined

  return (
    <section aria-label="Declarations" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Declarations</h2>
        <Input
          aria-label="Filter declarations by name"
          placeholder="Filter by name or stable name"
          className="max-w-sm"
          value={q ?? ""}
          onChange={(event) =>
            void navigate({
              ...links.topology({ q: event.target.value || undefined, kind: selected }),
              replace: true,
            } as never)
          }
        />
        <nav aria-label="Filter declarations by kind" className="flex flex-wrap gap-1.5">
          <Link {...links.topology({ q: q || undefined })} data-selected={selected === undefined}>
            <Badge variant={selected === undefined ? "default" : "outline"}>All {total}</Badge>
          </Link>
          {present.map((k) => (
            <Link
              key={k}
              {...links.topology({ q: q || undefined, kind: k })}
              data-selected={selected === k}
            >
              <Badge variant={selected === k ? "default" : "outline"}>
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", GROUP_ACCENT[kindGroupOf(k).id].dot)}
                />
                {kindPluralLabel(k)} {index.byKind(k).length}
              </Badge>
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          <span data-testid="topology-shown">
            {filtered ? `${shown} of ${total} declarations match` : `${total} declarations`}
          </span>
          {sharedContext !== undefined && (
            <>
              {" "}
              in context <span className="font-mono text-foreground">{sharedContext}</span>
            </>
          )}
        </p>
      </div>
      {kind !== undefined && selected === undefined && (
        <p className="text-sm text-muted-foreground" data-testid="topology-unknown-kind">
          "{kind}" is not a declaration kind this console knows, so the kind filter is ignored.
        </p>
      )}
      {groups.length === 0 && (
        <p className="text-sm" data-testid="topology-no-match">
          No declarations match the filter. The service has declarations; clear the filter to see
          them.{" "}
          <Link {...links.topology()} className="underline-offset-2 hover:underline">
            Clear the filter
          </Link>
        </p>
      )}
      <div className="flex flex-col gap-8">
        {groups.map(({ group, kinds, count }) => (
          <section
            key={group.id}
            aria-label={group.label}
            className={cn("flex flex-col gap-5 border-l-2 pl-4", GROUP_ACCENT[group.id].band)}
          >
            <h3 className="flex items-baseline gap-2 text-base font-semibold">
              {group.label}
              <span className="text-xs font-normal text-muted-foreground">
                {count} {count === 1 ? "declaration" : "declarations"}
              </span>
            </h3>
            {kinds.map(({ kind: k, nodes }) => (
              <section key={k} aria-label={kindPluralLabel(k)} className="flex flex-col gap-1">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {kindPluralLabel(k)}{" "}
                  <span className="text-foreground" data-testid={`topology-count-${k}`}>
                    {nodes.length}
                  </span>
                </h4>
                <Table aria-label={kindPluralLabel(k)} className="table-fixed">
                  {/* The h4 names the kind; the column names are for assistive technology. */}
                  <TableHeader className="sr-only">
                    <TableHead isRowHeader>{kindLabel(k)}</TableHead>
                    {sharedContext === undefined ? <TableHead>Context</TableHead> : null}
                    <TableHead>Declared at</TableHead>
                  </TableHeader>
                  <TableBody>
                    {nodes.map((node) => {
                      const stableName = stableNameOf(node.details)
                      return (
                        <TableRow key={node.name} id={node.name}>
                          <TableCell className="truncate">
                            <Link
                              {...links.topologyNode(node.kind, node.name)}
                              className="font-medium underline-offset-2 hover:underline"
                            >
                              {node.name}
                            </Link>
                            {stableName && (
                              <span
                                className="ml-3 font-mono text-xs text-muted-foreground"
                                title="Stable name"
                              >
                                {stableName}
                              </span>
                            )}
                          </TableCell>
                          {sharedContext === undefined ? (
                            <TableCell className="w-48 truncate">{node.context}</TableCell>
                          ) : null}
                          <TableCell className="w-72 truncate text-right font-mono text-xs text-muted-foreground">
                            {node.member}:{node.line}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </section>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
