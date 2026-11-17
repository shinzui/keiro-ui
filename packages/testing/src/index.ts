// Recorded fixtures and mock handlers for the console's tests; see
// docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md. Entry points:
// "@keiro-ui/testing/node" (vitest), "@keiro-ui/testing/browser" (VITE_MOCK=1, Playwright),
// "@keiro-ui/testing/scenario" (useScenario, feedScript, pins, kirokuLog).
export { fixtureMeta, fixtureText, manifests } from "./fixtures"
export type { FileMeta, Manifest, MetaFile, Surface } from "./types"
export { joinedAggregateTypes, joinedProcessManagerTypes } from "./joined"
export {
  syntheticTopologySummary,
  topologyGolden,
  topologyGoldenNames,
  topologyGoldenText,
  topologySha256,
  type TopologyGoldenName,
} from "./topology"
