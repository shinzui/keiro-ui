# Service topology golden documents

These five files are unchanged copies of keiro's own golden service topology documents, the
output of `keiro-dsl topology` that keiro's test suite compares against. They are test data for
the console's topology client and screens. Their contract is
`mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`.

Source: `mori://shinzui/keiro`, directory `keiro-dsl/test/fixtures/topology/` (artifact-level URI
pending), at keiro commit `43c9cdcb`, copied 2026-11-17. The directory was last changed by keiro
commit `4ee99457`.

| File here | Name in `topologyGolden` | Schema id | sha256 |
| --- | --- | --- | --- |
| `hospital-capacity.topology.golden.json` | `hospital-capacity` | `keiro-dsl/service-topology/1` | `d34a4e1580e7af6e4a9dab8984419048b737230c88b47536925d75bb6ed914d0` |
| `incident-command.topology.golden.json` | `incident-command` | `keiro-dsl/service-topology/1` | `38bcc76ce0f8f0c4a6101c609462bf3978c7ddae764b082959c3c1a8c22c1066` |
| `incident-command-sourced.topology.golden.json` | `incident-command-sourced` | `keiro-dsl/service-topology/2` | `b5848506e23e420375e6b29240edd763069d89022d09ddd67e467c6401c3e741` |
| `projection-catalog.topology.golden.json` | `projection-catalog` | `keiro-dsl/service-topology/1` | `999151ea80627d0020010416e3114021f5b85a1e4e4c50c4c2c4e56eafeeb26b` |
| `workspace/service.topology.golden.json` | `workspace` | `keiro-dsl/service-topology/1` | `1ffe2624a3839ab0551c8f0515bec48b4780c6f82a950beb3a2a4b33c2e0bc11` |

Never edit or reformat these files: digest verification is tested against their exact bytes, and
`packages/testing/test/topology.test.ts` fails when a digest above no longer matches. The
formatter ignores this directory (`.oxfmtrc.json`). Their `generator.version` is the literal
text `<version>`, which keiro's test suite substitutes so the goldens survive version bumps.

The recorded fixture `packages/testing/fixtures/keiro/topology-show.json` is the hospital
document as served by `jitsurei-ops-http --topology` and is byte-identical to the copy here.

To refresh after keiro changes its goldens, copy the five files again, update the commit and
digests above, and re-record the two keiro topology fixtures (see `dev/README.md`).
