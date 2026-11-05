---
okf_version: "0.2"
---

# Files

- [profile.dhall](profile.dhall)

# Friction Entry

- [Released bun2nix rejects Bun lockfile version 2](1-released-bun2nix-rejects-bun-lockfile-version-2.md) - bun2nix 2.1.2 rejects the committed Bun 1.4.2 lockfile before generation, requiring a verified compatibility patch.
- [Strict capability validation requires previously absent reviews](10-strict-capability-validation-requires-previously-absent-reviews.md) - The plan-required strict capability check refused all eleven existing concepts because their recommended reviews metadata was absent, requiring a bounded catalog-metadata review.
- [Path flakes inflate benchmark evaluation with ignored checkout files](2-path-flakes-inflate-benchmark-evaluation-with-ignored-checkout-files.md) - Repeated Linux path-flake evaluation spent about seven seconds on cache-hit commands because ignored checkout dependencies were included in the snapshot.
- [Patched Skopeo fails Nix rebuild byte comparison](3-patched-skopeo-fails-nix-rebuild-byte-comparison.md) - The importer timing probe using nix build --rebuild completed compilation but failed the helper output determinism comparison, interrupting the benchmark.
- [Colima cannot bind the host temporary directory](4-colima-cannot-bind-the-host-temporary-directory.md) - The local Colima runtime does not share arbitrary host /tmp paths, so the container smoke test could not mount its temporary configuration.
- [Official Caddy image retains a privileged executable capability](5-official-caddy-image-retains-a-privileged-executable-capability.md) - The official Caddy image executable has cap_net_bind_service, which prevents it running with all Linux capabilities dropped until that file capability is removed.
- [Existing Apple container shadows the production smoke IPv4 port](6-existing-apple-container-shadows-the-production-smoke-ipv4-port.md) - A pre-existing Apple container forwards 127.0.0.1:8080 while Caddy can bind IPv6, so the production suite waits indefinitely on the shadowed IPv4 address.
- [Production smoke silently tests whatever already answers on port 8080](7-production-smoke-silently-tests-whatever-already-answers-on-port-8080.md) - playwright.production.config.ts reuses any server on its port, so another local service on 8080 produced 11 misleading failures with no sign the console was not under test.
- [Re-recording fixtures needs freshly seeded databases, which nothing said](8-re-recording-fixtures-needs-freshly-seeded-databases-which-nothing-said.md) - The recording workflow documented a repeatable seed, but tests depend on exactly one seed run and an unaged pgmq_dev, so recording over existing data failed 8 tests.
- [Fixture derivation rewrites unrelated surface fixtures](9-fixture-derivation-rewrites-unrelated-surface-fixtures.md) - The all-surface derivation command changed Kiroku fixtures and manifest formatting during a targeted Keiro recording, requiring restoration of unrelated bytes.

