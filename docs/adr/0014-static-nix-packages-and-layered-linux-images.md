---
type: Architecture Decision Record
title: Static Nix packages and layered Linux images
description: Nix packages build the static console from a frozen Bun lock and shared staging logic, while Linux images reuse that package and an independent Caddy runtime layer.
docId: ADR-14
status: Accepted
date: 2026-10-26
timestamp: 2026-10-26T17:24:00Z
generated:
  by: codex-cli/gpt-6.1-sol
  at: 2026-10-26T17:03:00Z
---

# Static Nix packages and layered Linux images

## Context

[ADR-5](0005-no-backend-for-frontend.md) and
[ADR-9](0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md) make the console a
static application with a build-time asset base. Operators also need native Nix packages and
images whose source-edit builds reuse downloaded dependencies and the static server. The
existing release archive already stages licences and identity files; image creation should
consume the same assets without another bundle build.

## Decision

`nix/console.nix` builds the bundle with the pinned Bun toolchain and a frozen offline install
from a hash-verified bun2nix registry cache. Workspace package entries are removed lazily from
the fetched cache; current workspace sources remain application build inputs. No lifecycle
scripts are needed. The generated dependency expression and lockfile change together.
Release 2.1.2's generator requires a narrow compatibility patch to accept lockfile version 2;
generation consistency and sandbox builds validate that patch without downgrading the lock.

A named filtered source contains application/workspace build inputs and staging assets.
Image-only configuration and unrelated documentation are excluded. An explicit Git revision
is a real input, shared by the app, `VERSION`, and notices. Git flakes use the clean or dirty
revision; path flakes and source archives honestly fall back to `unknown`. Consequently a
new docs-only commit can rebuild the bundle even though a docs edit with a fixed revision
preserves its derivation. `scripts/stage-console.sh` stages an existing build for both native
packages and release archives without invoking the bundler.

The matched Apple comparison retains nix2container: source-edit medians were 5.77 seconds
versus 6.03 seconds for the corrected stream control, with host-specific variation. Linux
images use nix2container with one stable Caddy runtime layer and a changing package and
configuration layer. Caddy runs as `65532:65532` on HTTP port 8080, with admin, automatic HTTPS,
and configuration persistence disabled. It needs no writable runtime directory. The served
symlink targets `share/keiro-ui` in the exact native package. Inspection prefixes return 404
before the SPA fallback, as do missing assets and out-of-base requests. Hashed assets are
immutable; HTML revalidates. Upstream routing belongs in an ingress or a mounted Caddyfile.

The normal source-edit build retains the registry-cache install hook. A reusable installed
workspace tree was measured but rejected: on ARM64 Linux restoration took 525–683 ms while
installation took 180–207 ms, and Darwin showed only a small, variable total-build difference.
The comparison prototype lives only under the internal benchmark harness.

Native packages target Apple Silicon Darwin and ARM64/x86-64 Linux. Image outputs exist only
on Linux. On macOS, a Linux coordinator inside Apple containers performs image assembly and
Skopeo export; the host imports an OCI archive and runs it read-only. This explicitly adds an
archive export/load step, unlike direct Linux Docker import. A generic remote Nix builder
setting alone does not execute locally preferred Linux metadata/import steps on Darwin.

## Consequences

Normal image builds do not depend on release archives, browser tests, or generation checks.
Native output checks and generator consistency belong in flake checks; imported-image HTTP
and browser smoke are separate. Benchmarks hold the revision fixed, build three distinct UI
edits once each, reuse each exact package in both builders, alternate builder order, and retain
cache/layer identities and phase logs. Cache-hit repeats are reported separately. Apple OCI
export/load timings cannot substantiate Docker-daemon import speed claims.

The helper source identities are `mori://nix-community/bun2nix` and
`mori://nlewo/nix2container`; their source-file artifact URIs are pending. Pins, the compatibility
patch, and the image/runtime boundary are project-owned extensions to the managed development
flake. The implementation and measured evidence are in
[Plan 21](../plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md).
