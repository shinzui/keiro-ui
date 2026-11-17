import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"

// keiro's golden service topology documents, copied unchanged (topology/SOURCE.md). Vite
// inlines each as raw text; they are ASCII, so encoding the text reproduces the file's bytes.
const rawFiles = import.meta.glob("../topology/**/*.golden.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const GOLDEN_FILES = {
  "hospital-capacity": "hospital-capacity.topology.golden.json",
  "incident-command": "incident-command.topology.golden.json",
  /** The only `keiro-dsl/service-topology/2` document: it has `feeds` edges. */
  "incident-command-sourced": "incident-command-sourced.topology.golden.json",
  "projection-catalog": "projection-catalog.topology.golden.json",
  workspace: "workspace/service.topology.golden.json",
} as const

export type TopologyGoldenName = keyof typeof GOLDEN_FILES
export const topologyGoldenNames = Object.keys(GOLDEN_FILES) as TopologyGoldenName[]

/** A golden document's text, exactly as keiro committed it (one trailing newline). */
export function topologyGoldenText(name: TopologyGoldenName): string {
  const text = rawFiles[`../topology/${GOLDEN_FILES[name]}`]
  if (text === undefined) throw new Error(`no topology golden ${name}`)
  return text
}

/** A golden document's exact bytes. */
export function topologyGolden(name: TopologyGoldenName): Uint8Array {
  return new TextEncoder().encode(topologyGoldenText(name))
}

/** `sha256:` and the lowercase hex SHA-256 of the bytes, as keiro writes digests. */
export function topologySha256(bytes: Uint8Array): string {
  return `sha256:${bytesToHex(sha256(bytes))}`
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values.toSorted()) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

/**
 * SYNTHETIC: the `/topology/summary` body a keiro host would serve for these document bytes,
 * computed here and never recorded from a host. Field names and key order follow the recorded
 * `fixtures/keiro/topology-summary.json`. `overrides` replaces top-level fields, for example
 * a `document_sha256` that disagrees with the bytes or a `schema_id` the client rejects.
 */
export function syntheticTopologySummary(
  bytes: Uint8Array,
  overrides: Record<string, unknown> = {},
): string {
  const document = JSON.parse(new TextDecoder().decode(bytes)) as {
    schema: string
    service: string
    source?: { kind?: unknown; path?: unknown }
    generator: { version: string }
    members: { path: string; sha256: string }[]
    nodes: { kind: string }[]
    edges: { relation: string }[]
  }
  const source = document.source
  const summary: Record<string, unknown> = {
    document_bytes: bytes.byteLength,
    document_sha256: topologySha256(bytes),
    edge_counts: countBy(document.edges.map((edge) => edge.relation)),
    generator_version: document.generator.version,
    members: document.members.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
    node_counts: countBy(document.nodes.map((node) => node.kind)),
    schema_id: document.schema,
    service: document.service,
    ...((source?.kind === "source" || source?.kind === "workspace") &&
    typeof source.path === "string"
      ? { source: { kind: source.kind, path: source.path } }
      : {}),
    ...overrides,
  }
  return JSON.stringify(summary)
}
