import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

import { fixtureText } from "../src/fixtures"
import {
  syntheticTopologySummary,
  topologyGolden,
  topologyGoldenNames,
  topologySha256,
} from "../src/topology"

const root = join(import.meta.dirname, "../topology")
const source = readFileSync(join(root, "SOURCE.md"), "utf8")

test("every golden is served as its exact bytes and matches the digest SOURCE.md records", () => {
  expect(topologyGoldenNames).toHaveLength(5)
  for (const name of topologyGoldenNames) {
    const bytes = topologyGolden(name)
    const row = new RegExp(`\\| \`([^\`]+)\` \\| \`${name}\` \\| [^|]+ \\| \`([0-9a-f]{64})\` \\|`)
    const match = row.exec(source)
    expect(match, name).not.toBeNull()
    expect(Buffer.from(bytes).equals(readFileSync(join(root, match![1]!))), name).toBe(true)
    expect(topologySha256(bytes), name).toBe(`sha256:${match![2]}`)
    expect(bytes.at(-1), name).toBe(0x0a)
  }
})

test("the recorded show fixture is the hospital golden, byte for byte", () => {
  const recorded = new TextEncoder().encode(fixtureText("keiro/topology-show.json"))
  expect(Buffer.from(recorded).equals(Buffer.from(topologyGolden("hospital-capacity")))).toBe(true)
})

test("the synthetic summary of the hospital golden equals the recorded one", () => {
  expect(syntheticTopologySummary(topologyGolden("hospital-capacity"))).toBe(
    fixtureText("keiro/topology-summary.json"),
  )
  const other = JSON.parse(
    syntheticTopologySummary(topologyGolden("incident-command-sourced"), { service: "renamed" }),
  ) as Record<string, unknown>
  expect(other.schema_id).toBe("keiro-dsl/service-topology/2")
  expect(other.service).toBe("renamed")
  expect((other.edge_counts as Record<string, number>).feeds).toBeGreaterThan(0)
})
