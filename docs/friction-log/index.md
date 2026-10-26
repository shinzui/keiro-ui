---
okf_version: "0.2"
---

# Files

- [profile.dhall](profile.dhall)

# Friction Entry

- [Released bun2nix rejects Bun lockfile version 2](1-released-bun2nix-rejects-bun-lockfile-version-2.md) - bun2nix 2.1.2 rejects the committed Bun 1.4.2 lockfile before generation, requiring a verified compatibility patch.
- [Path flakes inflate benchmark evaluation with ignored checkout files](2-path-flakes-inflate-benchmark-evaluation-with-ignored-checkout-files.md) - Repeated Linux path-flake evaluation spent about seven seconds on cache-hit commands because ignored checkout dependencies were included in the snapshot.
- [Patched Skopeo fails Nix rebuild byte comparison](3-patched-skopeo-fails-nix-rebuild-byte-comparison.md) - The importer timing probe using nix build --rebuild completed compilation but failed the helper output determinism comparison, interrupting the benchmark.
