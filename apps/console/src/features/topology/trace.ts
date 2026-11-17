import { topologyNodeKey, type TopologyIndex, type TopologyNode } from "@keiro-ui/client-keiro"

export interface FedReadModel {
  readModel: TopologyNode
  /** The projection owner that consumes the aggregate, and the target it writes. */
  owner: TopologyNode
  target: TopologyNode
  /** How the read model relates to the target: `observes` or `backed-by`. */
  via: "observes" | "backed-by"
}

const keyOf = (ref: { kind: string; name: string }) => topologyNodeKey(ref.kind, ref.name)

/**
 * The read models an aggregate's events reach, as the contract says to trace them: `consumes`
 * back from a projection owner to the aggregate, `writes` from that owner to its targets, and
 * `observes` or `backed-by` from a read model to the same target. One entry per path, in
 * document order. An owner whose source is a category or `all` has no `consumes` edge, so it
 * is not on any path: this is a statement about the document's edges only.
 */
export function readModelsFedBy(index: TopologyIndex, aggregateKey: string): FedReadModel[] {
  const fed: FedReadModel[] = []
  for (const consumes of index.incoming(aggregateKey)) {
    if (consumes.relation !== "consumes") continue
    const owner = index.node(keyOf(consumes.from))
    if (!owner) continue
    for (const writes of index.outgoing(keyOf(consumes.from))) {
      if (writes.relation !== "writes") continue
      const target = index.node(keyOf(writes.to))
      if (!target) continue
      for (const edge of index.incoming(keyOf(writes.to))) {
        if (edge.relation !== "observes" && edge.relation !== "backed-by") continue
        const readModel = index.node(keyOf(edge.from))
        if (readModel) fed.push({ readModel, owner, target, via: edge.relation })
      }
    }
  }
  return fed
}
