import { topologyNodeKey, type TopologyEdge, type TopologyIndex } from "@keiro-ui/client-keiro"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { Link } from "@tanstack/react-router"

import { links } from "@/lib/links"

import { incomingRelationLabel, kindLabel, relationLabel } from "./labels"
import { DetailFields } from "./NodeDetails"

/** Rows grouped by relation, keeping the document's order inside and between groups. */
function byRelation(edges: readonly TopologyEdge[]): TopologyEdge[] {
  const order = [...new Set(edges.map((edge) => edge.relation))]
  return order.flatMap((relation) => edges.filter((edge) => edge.relation === relation))
}

function Direction({
  title,
  edges,
  direction,
}: {
  title: string
  edges: readonly TopologyEdge[]
  direction: "out" | "in"
}) {
  const rows = byRelation(edges)
  return (
    <section aria-label={`${title} relations`} className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None declared.</p>
      ) : (
        <Table aria-label={`${title} relations`}>
          <TableHeader>
            <TableHead isRowHeader>Relation</TableHead>
            <TableHead>{direction === "out" ? "To" : "From"}</TableHead>
            <TableHead>Attributes</TableHead>
          </TableHeader>
          <TableBody>
            {rows.map((edge, i) => {
              const other = direction === "out" ? edge.to : edge.from
              return (
                // Edges have no identity of their own; the document lists identical ones once.
                // oxlint-disable-next-line react/no-array-index-key
                <TableRow key={i} id={`${direction}-${i}`}>
                  <TableCell>
                    {direction === "out"
                      ? relationLabel(edge.relation)
                      : incomingRelationLabel(edge.relation)}{" "}
                    <code className="font-mono text-xs text-muted-foreground">{edge.relation}</code>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{kindLabel(other.kind)}</span>{" "}
                    <Link
                      {...links.topologyNode(other.kind, other.name)}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {other.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DetailFields record={edge.attributes} empty="none" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

/** A declaration's relations in both directions; each row links to the other declaration. */
export function NodeRelations({
  index,
  kind,
  name,
}: {
  index: TopologyIndex
  kind: string
  name: string
}) {
  const key = topologyNodeKey(kind, name)
  return (
    <section aria-label="Relations" className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">Relations</h2>
      <Direction title="Outgoing" edges={index.outgoing(key)} direction="out" />
      <Direction title="Incoming" edges={index.incoming(key)} direction="in" />
    </section>
  )
}
