import { formatInt64 } from "@keiro-ui/client-core"
import type { LoadedTopology } from "@keiro-ui/client-keiro"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import type { ReactNode } from "react"

import { CopyText } from "./CopyText"
import { shortDigest } from "./labels"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

const NONE = <span className="text-muted-foreground">none</span>
const NOT_STATED = <span className="text-muted-foreground">not stated</span>

/** What the host mounted: the document's own header fields, its digest, size and members. */
export function TopologyHeader({ topology }: { topology: LoadedTopology }) {
  const { document, summary, digest } = topology
  const contract = document.effectiveSemanticContract
  return (
    <section aria-label="Mounted document" className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-4 md:grid-cols-4">
        <Field label="Service">
          <span className="font-medium" data-testid="topology-service">
            {document.service}
          </span>
        </Field>
        <Field label="Schema id">
          <code className="font-mono text-xs" data-testid="topology-schema">
            {document.schema}
          </code>
        </Field>
        <Field label="Source">
          {document.source.kind} <code className="font-mono text-xs">{document.source.path}</code>
        </Field>
        <Field label="Generator">
          {document.generator.tool}{" "}
          <code className="font-mono text-xs">{document.generator.version}</code>
        </Field>
        <Field label="Language version">
          {contract.languageVersion ?? NOT_STATED}
          {contract.languageSupport && (
            <span className="text-muted-foreground"> ({contract.languageSupport})</span>
          )}
        </Field>
        <Field label="Runtime semantics">
          {contract.runtimeSemantics ? (
            <code className="font-mono text-xs">{contract.runtimeSemantics}</code>
          ) : (
            NOT_STATED
          )}
        </Field>
        <Field label="Document digest">
          <span data-testid="topology-digest">
            <CopyText shown={shortDigest(digest)} value={digest} label="document digest" />
          </span>
        </Field>
        <Field label="Document size">
          {formatInt64(summary.document_bytes, { grouping: true })} bytes
        </Field>
        <Field label="Declarations">
          <span data-testid="topology-node-total">{document.nodes.length}</span>
        </Field>
        <Field label="Relations">
          <span data-testid="topology-edge-total">{document.edges.length}</span>
        </Field>
      </dl>
      <p className="text-sm text-muted-foreground" data-testid="topology-caption">
        This describes the committed specification the host mounted, not the running binary. The
        host does not check that they agree.
      </p>
      <Table aria-label="Members">
        <TableHeader>
          <TableHead isRowHeader>Member</TableHead>
          <TableHead>Digest</TableHead>
          <TableHead>Declared language version</TableHead>
          <TableHead>Effective language version</TableHead>
        </TableHeader>
        <TableBody>
          {document.members.map((member) => (
            <TableRow key={member.path} id={member.path}>
              <TableCell className="font-mono text-xs">{member.path}</TableCell>
              <TableCell>
                <CopyText
                  shown={shortDigest(member.sha256)}
                  value={member.sha256}
                  label={`digest of ${member.path}`}
                />
              </TableCell>
              <TableCell>
                {member.declaredLanguageVersion === null
                  ? NONE
                  : (member.declaredLanguageVersion ?? NOT_STATED)}
              </TableCell>
              <TableCell>{member.effectiveLanguageVersion ?? NOT_STATED}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
