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

import { links } from "@/lib/links"

import { kindLabel, kindPluralLabel, stableNameOf } from "./labels"

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

/** Every declaration grouped by kind in the contract's order, filtered through the URL. */
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
  const present = TOPOLOGY_NODE_KINDS.filter((k) => index.byKind(k).length > 0)
  const groups = present
    .filter((k) => selected === undefined || k === selected)
    .map((k) => ({ kind: k, nodes: index.byKind(k).filter((node) => matchesText(node, q ?? "")) }))
    .filter((group) => group.nodes.length > 0)
  const shown = groups.reduce((total, group) => total + group.nodes.length, 0)
  const total = index.document.nodes.length
  const filtered = Boolean(q?.trim()) || selected !== undefined

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
                {kindPluralLabel(k)} {index.byKind(k).length}
              </Badge>
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground" data-testid="topology-shown">
          {filtered ? `${shown} of ${total} declarations match` : `${total} declarations`}
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
      {groups.map((group) => (
        <section
          key={group.kind}
          aria-label={kindPluralLabel(group.kind)}
          className="flex flex-col gap-1"
        >
          <h3 className="text-sm font-medium">
            {kindPluralLabel(group.kind)}{" "}
            <span className="text-muted-foreground" data-testid={`topology-count-${group.kind}`}>
              {group.nodes.length}
            </span>
          </h3>
          <Table aria-label={kindPluralLabel(group.kind)}>
            <TableHeader>
              <TableHead isRowHeader>{kindLabel(group.kind)}</TableHead>
              <TableHead>Stable name</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Declared at</TableHead>
            </TableHeader>
            <TableBody>
              {group.nodes.map((node) => (
                <TableRow key={node.name} id={node.name}>
                  <TableCell>
                    <Link
                      {...links.topologyNode(node.kind, node.name)}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {node.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {stableNameOf(node.details) ?? ""}
                  </TableCell>
                  <TableCell>{node.context}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {node.member}:{node.line}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </section>
  )
}
