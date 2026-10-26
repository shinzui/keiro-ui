---
okf_version: "0.2"
---

# Files

- [profile.dhall](profile.dhall)

# Friction Entry

- [Released bun2nix rejects Bun lockfile version 2](1-released-bun2nix-rejects-bun-lockfile-version-2.md) - bun2nix 2.1.2 rejects the committed Bun 1.4.2 lockfile before generation, requiring a verified compatibility patch.
- [Path flakes inflate benchmark evaluation with ignored checkout files](2-path-flakes-inflate-benchmark-evaluation-with-ignored-checkout-files.md) - Repeated Linux path-flake evaluation spent about seven seconds on cache-hit commands because ignored checkout dependencies were included in the snapshot.
- [Patched Skopeo fails Nix rebuild byte comparison](3-patched-skopeo-fails-nix-rebuild-byte-comparison.md) - The importer timing probe using nix build --rebuild completed compilation but failed the helper output determinism comparison, interrupting the benchmark.
- [Colima cannot bind the host temporary directory](4-colima-cannot-bind-the-host-temporary-directory.md) - The local Colima runtime does not share arbitrary host /tmp paths, so the container smoke test could not mount its temporary configuration.
- [Official Caddy image retains a privileged executable capability](5-official-caddy-image-retains-a-privileged-executable-capability.md) - The official Caddy image executable has cap_net_bind_service, which prevents it running with all Linux capabilities dropped until that file capability is removed.
- [Existing Apple container shadows the production smoke IPv4 port](6-existing-apple-container-shadows-the-production-smoke-ipv4-port.md) - A pre-existing Apple container forwards 127.0.0.1:8080 while Caddy can bind IPv6, so the production suite waits indefinitely on the shadowed IPv4 address.
