import { topologyNodeKey, type TopologyIndex, type TopologyNode } from "@keiro-ui/client-keiro"
import { Link } from "@tanstack/react-router"

import { links } from "@/lib/links"

import { readModelsFedBy } from "./trace"

const linkClass = "font-medium underline-offset-2 hover:underline"

/** The read models an aggregate's events reach through projection owners and targets. */
export function ReadModelsFed({ index, node }: { index: TopologyIndex; node: TopologyNode }) {
  const fed = readModelsFedBy(index, topologyNodeKey(node.kind, node.name))
  return (
    <section aria-label="Read models fed" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Read models fed</h2>
      {fed.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="read-models-none">
          No projection owner consumes this aggregate in the mounted document. An owner that reads a
          whole category or every stream is not traced to a single aggregate.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {fed.map((path) => (
            <li key={`${path.owner.name}/${path.target.name}/${path.readModel.name}/${path.via}`}>
              <Link
                {...links.topologyNode(path.readModel.kind, path.readModel.name)}
                className={linkClass}
              >
                {path.readModel.name}
              </Link>{" "}
              <span className="text-muted-foreground">
                {path.via === "observes" ? "observes" : "is backed by"} target
              </span>{" "}
              <Link
                {...links.topologyNode(path.target.kind, path.target.name)}
                className={linkClass}
              >
                {path.target.name}
              </Link>
              <span className="text-muted-foreground">, written by owner</span>{" "}
              <Link {...links.topologyNode(path.owner.kind, path.owner.name)} className={linkClass}>
                {path.owner.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
