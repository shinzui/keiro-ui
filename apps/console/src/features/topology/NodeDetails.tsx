import type { TopologyNode } from "@keiro-ui/client-keiro"
import type { ReactNode } from "react"

import { JsonViewer } from "@/components/JsonViewer"

const isScalar = (value: unknown): value is string | number | bigint | boolean =>
  ["string", "number", "bigint", "boolean"].includes(typeof value)

const NO_FIELDS: readonly string[] = []
const MACHINE_ONLY: readonly string[] = ["machine"]
const NONE = <span className="text-muted-foreground">none</span>

function Scalar({ value }: { value: string | number | bigint | boolean }) {
  return typeof value === "string" ? (
    <>{value}</>
  ) : (
    <code className="font-mono">{String(value)}</code>
  )
}

/**
 * One value of a `details` or `attributes` record: `null` as "none", a scalar as itself, a
 * list of scalars inline, anything nested as JSON. Nothing is hidden or reinterpreted.
 */
export function DetailValue({ name, value }: { name: string; value: unknown }): ReactNode {
  if (value === null || value === undefined) return NONE
  if (isScalar(value)) return <Scalar value={value} />
  if (Array.isArray(value) && value.every(isScalar)) {
    if (value.length === 0) return NONE
    return (
      <ul className="flex flex-wrap gap-x-2 gap-y-1">
        {value.map((item, i) => (
          // A list in declaration order may repeat a value.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {String(item)}
          </li>
        ))}
      </ul>
    )
  }
  return <JsonViewer value={value} label={name} />
}

/** Every field of a record as a labelled value, in the document's own (sorted) key order. */
export function DetailFields({
  record,
  omit = NO_FIELDS,
  empty = "No details.",
}: {
  record: Record<string, unknown>
  omit?: readonly string[]
  empty?: string
}) {
  const entries = Object.entries(record).filter(([key]) => !omit.includes(key))
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
          <dd className="min-w-0" data-testid={`detail-${key}`}>
            <DetailValue name={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A declaration's `details`, generically: keiro may add fields within a schema id, so every
 * field is shown, recognised or not. An aggregate's machine has its own section.
 */
export function NodeDetails({ node }: { node: TopologyNode }) {
  return (
    <section aria-label="Details" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Details</h2>
      <DetailFields
        record={node.details}
        omit={node.kind === "aggregate" ? MACHINE_ONLY : NO_FIELDS}
        empty="This declaration has no details."
      />
    </section>
  )
}
