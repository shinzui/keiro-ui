import type { TopologyIndex } from "@keiro-ui/client-keiro"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { useAggregateTypes } from "@/features/aggregates/queries"
import { links } from "@/lib/links"

import { catalogueOf, compareAggregates } from "./joins"
import { describeFailure } from "./queries"

const linkClass = "font-medium underline-offset-2 hover:underline"
const code = (text: string) => <code className="font-mono text-xs">{text}</code>

function Names({ label, children }: { label: string; children: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">
        {label} <span>{children.length}</span>
      </h3>
      <ul aria-label={label} className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {children}
      </ul>
    </div>
  )
}

/**
 * Whether the mounted document and the running host agree, as far as the console can see:
 * declared aggregate categories against mounted aggregate type names. The host never checks
 * this itself. Disagreement is a finding to show, not an error, and "cannot compare" is never
 * reported as agreement or as an empty host.
 */
export function Agreement({ index }: { index: TopologyIndex }) {
  const types = useAggregateTypes()
  const catalogue = catalogueOf(types)
  const declared = index.byKind("aggregate")
  const heading = <h2 className="text-sm font-semibold">Document and host</h2>

  if (catalogue.status !== "ready") {
    return (
      <section aria-label="Document and host" className="flex flex-col gap-2">
        {heading}
        {catalogue.status === "pending" && (
          <p className="text-sm text-muted-foreground" data-testid="agreement-pending">
            Reading the aggregate types the host mounts…
          </p>
        )}
        {catalogue.status === "not-mounted" && (
          <p className="text-sm" data-testid="agreement-cannot-compare">
            Cannot compare: this host does not mount aggregate inspection, so the console cannot see
            which aggregates it runs. It probed {code("/keiro/aggregate/types")} and the host
            refused the command. This is not a statement that the host runs none.
          </p>
        )}
        {catalogue.status === "failed" && (
          <p className="text-sm" data-testid="agreement-failed">
            Cannot compare: the aggregate types the host mounts could not be read.{" "}
            {describeFailure(catalogue.error).code && (
              <>{code(describeFailure(catalogue.error).code!)} </>
            )}
            {describeFailure(catalogue.error).message}
          </p>
        )}
      </section>
    )
  }

  const result = compareAggregates(index, catalogue.items)
  const withoutCategory = result.withoutCategory.length > 0 && (
    <Names label="Declared without a category, so not comparable">
      {result.withoutCategory.map((node) => (
        <li key={node.name}>
          <Link {...links.topologyNode(node.kind, node.name)} className={linkClass}>
            {node.name}
          </Link>
        </li>
      ))}
    </Names>
  )

  if (declared.length === 0 && catalogue.items.length === 0) {
    return (
      <section aria-label="Document and host" className="flex flex-col gap-2">
        {heading}
        <p className="text-sm" data-testid="agreement-nothing">
          The document declares no aggregates and the host mounts none, so there is nothing to
          compare.
        </p>
      </section>
    )
  }

  if (result.agrees) {
    return (
      <section aria-label="Document and host" className="flex flex-col gap-2">
        {heading}
        <p className="text-sm" data-testid="agreement-agrees">
          The mounted aggregates match the document: {result.matched.length} declared{" "}
          {result.matched.length === 1 ? "aggregate is" : "aggregates are"} mounted under{" "}
          {result.matched.length === 1 ? "its category" : "their categories"}, and the host mounts
          no others. This compares aggregate names only; it does not show that the binary was built
          from this specification.
        </p>
        {withoutCategory}
      </section>
    )
  }

  return (
    <section
      aria-label="Document and host"
      className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4"
    >
      {heading}
      <p className="text-sm" data-testid="agreement-disagrees">
        <span className="font-medium">Document and host disagree.</span> The document describes a
        committed specification, and it may be for a different build of this service or for another
        service. The host does not check this, so nothing has failed; what is declared here may not
        be what is running.
      </p>
      {result.declaredOnly.length > 0 && (
        <Names label="Declared but not mounted">
          {result.declaredOnly.map(({ node, category }) => (
            <li key={node.name}>
              <Link {...links.topologyNode(node.kind, node.name)} className={linkClass}>
                {node.name}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">category {category}</span>
            </li>
          ))}
        </Names>
      )}
      {result.mountedOnly.length > 0 && (
        <Names label="Mounted but not declared">
          {result.mountedOnly.map((type) => (
            <li key={type.name}>
              <Link {...links.aggregateType(type.name)} className={linkClass}>
                {type.name}
              </Link>
            </li>
          ))}
        </Names>
      )}
      {result.matched.length > 0 && (
        <Names label="Declared and mounted">
          {result.matched.map(({ node, type }) => (
            <li key={node.name}>
              <Link {...links.topologyNode(node.kind, node.name)} className={linkClass}>
                {node.name}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">as</span>{" "}
              <Link {...links.aggregateType(type.name)} className={linkClass}>
                {type.name}
              </Link>
            </li>
          ))}
        </Names>
      )}
      {withoutCategory}
    </section>
  )
}
