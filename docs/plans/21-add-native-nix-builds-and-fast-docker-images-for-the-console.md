---
id: 21
slug: add-native-nix-builds-and-fast-docker-images-for-the-console
title: "Add native Nix builds and fast Docker images for the console"
kind: exec-plan
created_at: 2026-10-26T16:17:22Z
intention: "intention_01m5wfzzxzec4vdj0tyq8j2dpy"
provenance:
  created_by:
    model: "gpt-6.1-sol"
    harness: "codex-cli"
    at: 2026-10-26T16:17:22Z
---

# Add native Nix builds and fast Docker images for the console

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.
Record friction met while implementing in the friction-log bundle as it occurs (see FRICTION.md).


## Purpose / Big Picture


An operator will be able to run `nix build` from a clean checkout and obtain the production console without first installing JavaScript dependencies. On Linux, `nix build .#docker-image` will describe a runnable Docker-compatible image made from that same console package, and `nix run .#docker-image.copyToDockerDaemon` will import it into Docker. Opening its published port will show the console, including after reloading a deep link.

The optimization target is elapsed time to create and use an image, especially after editing the UI. Downloaded dependencies and the static server must remain reusable across source edits. The normal image path will use `nix2container`, which avoids storing a complete image tarball; measure assembly and Docker import separately from the application build. Bun is the package manager and build tool. The deployed application remains static files served by Caddy, as the existing architecture requires.


## Progress


- [ ] M1: A sandboxed native console package builds from the committed lockfile on the three supported systems; root and `/console/` variants contain production assets and release notices.
- [ ] M2: Linux images consume those exact packages, import into Docker, and serve root and sub-path deployments with working deep links and correct handling of inspection prefixes.
- [ ] M3: Automated artifact/container checks and recorded timing comparisons demonstrate dependency reuse, stable runtime layers, and the chosen image workflow's speed tradeoffs.
- [ ] M4: Operator documentation and architecture records describe the verified commands, customization, dependency updates, and platform limits; required checks pass.

Creation handoff: this document is the deliverable of the current request. Packaging implementation has not started. The linked intention was created with `mina ci --json`; no existing MasterPlan is made this plan's parent.


## Surprises & Discoveries


(None yet.)


## Decision Log


Decision (2026-10-26): Preserve the static bundle deployment model in ADR-5 and ADR-9. Package the Vite output and serve it with Caddy; Bun and Node are build tools. This follows the existing app rather than introducing an application server to obtain a container entrypoint.

Decision (2026-10-26): Use the released `bun2nix` hook with a normal Nix derivation and a checked-in generated dependency expression. Its documentation recommends the hook for React websites; the executable-oriented helper would impose an unnecessary compilation model. Exclude local workspace entries from the fetched registry cache so application edits do not invalidate that cache.

Decision (2026-10-26): Prefer `nix2container` with an explicit stable Caddy layer and a changing bundle layer. Its normal output is image metadata with referenced layers rather than a complete archive. Benchmark it against an uncompressed `dockerTools.streamLayeredImage` control using the same payload; do not claim an elapsed-time improvement from the metadata build alone. If measurements favor the control, record the evidence and consistently revise the public interface before completion.

Decision (2026-10-26): Keep the Seihou-owned nixpkgs revision and Bun 1.4.2 initially. The npm registry and upstream Bun release both report 1.4.4, but the current workspace explicitly selects 1.4.2 and the managed development environment agrees. A toolchain upgrade is unnecessary for this packaging work unless a reproduced compatibility failure proves otherwise. New helper inputs are pinned to verified release commits and follow the project's nixpkgs.

Decision (2026-10-26): Native static packages support `aarch64-darwin`, `aarch64-linux`, and `x86_64-linux`; container packages are exposed only on Linux. A macOS developer uses a Linux Nix builder or a Linux checkout for the image. Declaring an architecture does not turn Darwin packages into Linux binaries. Registry publication, a new CI provider, multi-architecture manifests, and application feature changes are outside this plan.


## Outcomes & Retrospective


(To be filled during and after implementation.)


## Context and Orientation


This repository is a Bun workspace: root `package.json` includes `apps/*` and `packages/*`, declares `bun@1.4.2`, and sends `bun run build` to `apps/console`. `apps/console/package.json` runs `vite build`. Vite produces `apps/console/dist`, containing HTML, JavaScript, CSS, and fonts. There is no Bun server to launch in production. Node 22 is also available in the development shell, and package executables with Node shebangs may require it during packaging.

`apps/console/vite.config.ts` reads `VITE_BASE_PATH` at build time, normalizes leading and trailing slashes, and passes it to Vite. The router uses that same base. `KEIRO_UI_GIT_COMMIT` supplies build identity without requiring a Git checkout. Root `bun.lock` is Bun's textual dependency lock, currently `lockfileVersion: 2`. Its console workspace version is still `0.0.0` while `apps/console/package.json` is `0.1.0`; establish whether frozen installation accepts this metadata before generating the Nix dependency file. If refreshing is needed, use Bun 1.4.2 and review the lock diff without updating unrelated versions. `bunfig.toml` currently specifies only exact dependency versions.

`flake.nix` uses flake-parts, a module system for organizing flake outputs, and declares the three systems above. It imports `nix/bun.nix`, `nix/pre-commit.nix`, and the project-owned `flake.module.nix`. Today it provides a development shell, not a production package. `nix/bun.nix` and `nix/tooling.nix` are managed files; put new package wiring in `flake.module.nix` and project-owned files under `nix/`. The extension contract is `mori://shinzui/seihou-modules/templates/nix-bun-flake`, resolved during creation with Mori. Its README permits project-specific flake inputs while keeping module-owned revisions fixed.

`docs/plans/18-package-the-console-for-deployment.md` delivered base-path support, release archives, and production smoke tests, and explicitly deferred Nix packaging. `scripts/release-pack.sh` builds the app and stages `VERSION`, `NOTICE.md`, `OFL.txt`, and the proxy examples, while omitting `mockServiceWorker.js`. It currently always builds and mutates `release/`, so do not call it unchanged inside the Nix package or run it again to assemble an image. `scripts/check-dist.sh` validates asset base paths and hashed filenames. `packages/ui/src/fonts/OFL.txt` must accompany distributed fonts.

Relevant decisions, discovered by scanning ADR filenames and headings, are [ADR-5](../adr/0005-no-backend-for-frontend.md) and [ADR-9](../adr/0009-a-static-bundle-in-front-of-surfaces-at-composed-prefixes.md). ADR-5 keeps API aggregation out of the console. ADR-9 fixes the bundle's base path at build time and keeps inspection requests at absolute `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` prefixes. The image is another static host for this model. No existing ADR chooses a Nix package builder or container builder.

`docs/user/deployment.md` is the current operator guide. `dev/caddy/Caddyfile` demonstrates a `/console/` bundle plus four loopback upstreams; those loopback addresses are development-specific and must not become container defaults. `apps/console/playwright.production.config.ts` currently builds its own `dist-production` before starting Caddy. Existing tests in `apps/console/e2e/production/production.spec.ts` therefore do not yet prove that a Nix-built artifact works. Add a mode that tests an already running deployment without rebuilding or starting another server, while preserving the existing workflow.

A Nix derivation is a reproducible build recipe. A fixed-output fetch is a download verified against a declared hash. The runtime closure is a package and every dependency it references. An image layer is an independently identified filesystem change; keeping Caddy's layer unchanged allows it to be reused when only the bundle changes. A sandboxed build has no general network access; dependency downloads happen through Nix fetchers, then Bun installs from the prepared local cache.

Mori discovery found no registered source projects for Bun, bun2nix, nix2container, nixpkgs, or Caddy; use authoritative upstream documentation/source for these dependencies rather than searching the Nix store. Research verified `bun2nix` 2.1.2 against both npm and its upstream release tag, commit `0f2a1f0b6f42cebe3b149bf62d38754c5e0e9729`, and `nix2container` v1.1.0 against its release/tag, commit `e503eb81630a0c5d7ec244e08e0733650235d8f1`. The project nixpkgs pin `39ad350a0602fa0a58a544344e3e9187526ea45c` packages Bun 1.4.2. Recheck released versions when implementation starts; record any deliberate change from these choices.

Authoritative API references are the [bun2nix hook guide](https://nix-community.github.io/bun2nix/building-packages/hook.html), [bun2nix helper distinction](https://nix-community.github.io/bun2nix/building-packages/mkDerivation.html), [Nixpkgs manual](https://nixos.org/manual/nixpkgs/unstable/), and [Caddy global options](https://caddyserver.com/docs/caddyfile/options). Upstream source artifacts used during research are `mori://nix-community/bun2nix` with project-relative paths `nix/bun2nix.nix`, `nix/fetch-bun-deps.nix`, `nix/mk-derivation/hook.sh`, and `programs/bun2nix/src/lockfile/package_deserializer.rs`; and `mori://nlewo/nix2container` with `default.nix` and `README.md`. Artifact-level URIs for those source files are pending. Release evidence is [bun2nix 2.1.2](https://github.com/nix-community/bun2nix/releases/tag/2.1.2) and [nix2container v1.1.0](https://github.com/nlewo/nix2container/releases/tag/v1.1.0). The registry absence does not prevent using these intended canonical project identities.


## Plan of Work


### M1: Build the production bundle with Nix


Add revision-pinned `bun2nix` and `nix2container` inputs in `flake.nix`; make their nixpkgs inputs follow the existing pin. For bun2nix also follow the already declared flake-parts input where supported. Lock only the new input graph, preserving existing managed revisions. Obtain the helper from `inputs.bun2nix.packages.${system}.default`; its passthrough attributes expose `hook` and `fetchBunDeps` in release 2.1.2. Add the generator to the project shell through `bunProject.extraDevPackages` and expose `packages.bun2nix` for exact-version regeneration.

Generate root `bun-deps.nix`, avoiding the existing `nix/bun.nix` development module. Add `nix/console.nix` as a `pkgs.callPackage` function accepting `basePath`, `gitCommit`, and the bun2nix helper. Use `stdenvNoCC.mkDerivation`, `strictDeps = true`, the helper hook, and Node 22 as an explicit build tool if the Vite command needs it. Set an explicit build phase running the existing `bun run build`, and an explicit install phase staging files under `$out/share/keiro-ui`. Never inherit the hook's executable build/install defaults or its `bun test` check runner: project tests use Vitest via `bun run test`.

The generated expression includes local `workspace:` packages as `copyPathToStore` entries. Wrap its evaluation with a function accepting the fetchers and use `builtins.removeAttrs` to remove local workspace names before passing the result to `fetchBunDeps`. Derive those names from the workspace manifests. Evaluate the generated expression lazily so removed workspace paths are not copied. The full workspace sources still enter the application derivation and Bun links them during installation; the fetched cache contains registry dependencies only. Keep this wrapper in `nix/console.nix` or a small `nix/console-deps.nix`, not in the generated file. Prove this arrangement with the real workspace before expanding validation variants.

Set explicit frozen install flags, retain build-time development dependencies, and disable lifecycle scripts with the hook's `dontRunLifecycleScripts = true` if the real Vite/Tailwind build passes without them. The hook's initial install already uses `--ignore-scripts`. If a script is necessary, reproduce its failure and provide only the required offline preparation. Do not enable unrestricted scripts or download browsers. Test Bun's frozen/offline install behavior against the pinned version rather than inventing a package-manager flag. Ensure an explicit flag list does not accidentally drop the hook's platform defaults: isolated linking by default, with symlink backend on Darwin. Change linker/backend only for a demonstrated failure and retain frozen installation.

Use a filtered source containing root manifests/configuration, `apps/console` build inputs, all needed workspace sources, font assets, validation/staging scripts, and release notices/examples. Exclude `node_modules`, built output, browser reports, `.git`, `.env*`, `.dev`, and unrelated planning/docs. Source selection must not make every documentation change rebuild the app. Include actual deployment examples needed for notices. Avoid evaluating the whole checkout as an unfiltered application input.

Pass the normalized base path and explicit revision as derivation attributes. Take revision from flake `self.rev` or `self.dirtyRev` where available, with a documented `unknown` fallback for source archives; never use the current clock or invoke Git during the build. Share staging logic with `scripts/release-pack.sh` through a new `scripts/stage-console.sh` accepting the built directory, destination, version, revision, and base path. It must stage an existing build without running Bun. Preserve existing archive behavior. Check the production bundle with `scripts/check-dist.sh`, remove the mock worker, and include the font licence and release identity.

Expose `packages.console`, `packages.default = packages.console`, `packages.console-subpath` built for `/console/`, and `packages.console-deps` for the prepared registry cache. Acceptance is a successful sandboxed build with absent local `node_modules`, valid root/sub-path assets and notices, plus a real serving check of the Nix output. Inspect native Linux bindings such as Rolldown and Tailwind only if their actual build fails; derive any `autoPatchelf` or native-library additions from evidence.


### M2: Construct and run an image from the bundle


Add `nix/container.nix`, accepting the already built console derivation and the nix2container helper. Use `inputs.nix2container.packages.${system}.nix2container` from the pinned release. Put Caddy and its runtime dependencies in an explicit `buildLayer { deps = [ pkgs.caddy ]; }` whose inputs contain no application sources. Use that layer in `buildImage`, and add the console and minimal root/configuration in the changing layer. Keep a small layer count; assigning one layer to every dependency adds work without serving this use case.

The image will be named `keiro-ui-console`, with a documented local tag `dev`; reproducibility is determined by the image content, not that mutable convenience tag. Expose `packages.docker-image` and `packages.docker-image-subpath` only when `pkgs.stdenv.hostPlatform.isLinux`. Give the sub-path image the distinct tag `dev-subpath`. Both must reference their matching M1 output directly. Building an image must never invoke Bun, Vite, `release-pack.sh`, Docker build, a virtual machine, or a second app derivation with different inputs.

Place a symlink to the console package at `/srv/console`. Generate `nix/Caddyfile` or an equivalent project-owned template to listen on HTTP port 8080, disable the admin endpoint, automatic HTTPS, and configuration persistence, and log to standard output/error. Run Caddy as numeric user/group `65532:65532` with an absolute executable path and no shell entrypoint. Use `caddy run --config <generated-config> --adapter caddyfile`. Keep build tools, source trees, `node_modules`, and browser fixtures out of the image's runtime closure. Expose port 8080 in image metadata.

For `/console/`, redirect `/console` to `/console/`, strip the prefix when serving, and supply the SPA fallback (return `index.html` for client-side application routes). Root and sub-path configurations must reserve exact inspection prefixes and their children before the SPA fallback, returning HTTP 404 when no upstream routing is configured. A request for `/keiro/health/live` must never return console HTML. The default image is a static server: an external ingress can route inspection prefixes to the application, or the browser can use an existing separate-origins connection profile. Document a mounted Caddyfile example for proxying surfaces when desired, preserving Host and WebSocket upgrades. Do not bake the development machine's loopback ports into the image.

As the early image integration check, import one image into Docker on Linux, start it, and fetch `/`, a real hashed asset, `/workflows`, and `/keiro/health/live`. Verify that the app shell works in a browser before repeating for `/console/`. This exercises the independently supplied Bun build, Nix closure collection, Caddy, and Docker import together. It must happen before building performance/automation around an assumed interface.


### M3: Verify runtime behavior and image creation speed


Add `scripts/check-nix-package.sh` for use inside Nix checks, verifying the installed tree, notice/version files, base path, mock-worker omission, and hashed asset paths. Expose `checks.console` and `checks.console-subpath`. Add a generator consistency check that regenerates `bun-deps.nix` using the pinned helper and compares bytes without fetching dependency sources during evaluation. Keep flake evaluation free of building imports. Separate the expensive browser/container smoke from ordinary flake checks; flake checks must not need a Docker daemon.

Add `scripts/check-container.sh` taking an image reference and base path. It starts an isolated container on an ephemeral loopback port, waits with a bounded timeout, checks redirect/deep-link/asset/prefix behavior and image metadata, and always cleans up its own container. Add an external-target mode to the production Playwright configuration so the existing shell, navigation, asset, and version assertions can run against that port with no local rebuild. Adapt revision assertions to the documented source-archive fallback as appropriate; do not conceal an unexpected `unknown` for a clean Git build. No backend is required for tier 1; existing live-stack tier 2 remains conditional.

Add `scripts/benchmark-image.sh` and a small `nix/image-benchmark.nix` control using `dockerTools.streamLayeredImage` with the same static output and Caddy configuration. The control streams directly into `docker load`, without gzip compression or a prebuilt tarball. The benchmark must run on one Linux machine and record system architecture, versions, whether tool dependencies were cached, application build time, image assembly time, import time, total elapsed time, and image size. Warm expensive helper builds before the warm comparison and report their first-use cost separately. Do not purge a shared Nix cache or global Docker state to simulate cold runs.

Compare unchanged repeats and one actual UI source edit after the initial build. Also change an unrelated plan/document in an isolated copy to prove source filtering. Set the same explicit revision for baseline and source variants so Git dirty metadata cannot disguise dependency changes. Use temporary source trees or a benchmark-only expression to change a visible label without editing the user's checkout; exclude that control from the normal package interface. Record derivation identities and image layer identifiers through Nix/Docker metadata interfaces. The registry-cache derivation and Caddy layer must stay identical across UI edits, while the bundle and its layer change. A second unchanged build must have no application build work. Changing a locked dependency must invalidate the cache; merely touching timestamps must not.

Run at least three warm samples for each builder and report medians together with the actual commands and host details. Accept the archive-free path if its combined warm assembly/import time is no slower than the control within observed run-to-run variation, and stable runtime/cache identities are demonstrated. If this small static app imports faster through dockerTools, choose the measured faster default and update all affected sections; retain only useful comparison machinery. Do not assert a universal speedup, layer-upload reuse in Docker import, or an arbitrary seconds target. Registry layer skipping is a separate upstream capability and does not prove Docker import skips equivalent work.


### M4: Document and finalize the supported workflow


Update `README.md`, `docs/user/deployment.md`, and `justfile` with native builds, image construction/import, runtime port/path, base-path overrides, exact dependency regeneration, and native versus Linux build requirements. Explain that `nix build .#docker-image` produces an image description, and importing is the step that actually makes an image available to Docker. Include the measured performance evidence in this plan, with concise operator guidance about the fastest verified path. Keep archive generation an optional distribution task outside the normal image workflow.

The documented reusable function accepts `basePath` and `gitCommit`; show how an operator changes `basePath` in `flake.module.nix` to obtain a matching package and image. Environment variables on the container cannot relocate assets already built for another path. Document Linux builder setup as a prerequisite for macOS image work, without inventing a host or configuring credentials. On macOS the native static build remains fully supported; run image acceptance on an actual Linux builder/host before claiming it passed.

Distill the accepted packaging/runtime/cache boundaries into a new ADR under `docs/adr/`, cross-link ADR-9, and update ADR-9 only if its durable contract changes. The ADR bundle is profile-governed: use `okf id next` for allocation and the existing `docs/adr/profile.dhall`, maintain `docs/adr/log.md`, and validate strictly. Update the user-documentation bundle's log/metadata through its established contract. Record the implementation session's provenance with the skill script, triage any recorded friction, and fill Outcomes & Retrospective only after evidence supports completion.


## Concrete Steps


Run commands from the repository root. These are the target interfaces to implement, not claims that they exist yet. Start with discovery and version checks; scope all dependency source reads to Mori-discovered paths or explicitly retrieved upstream sources, never the Nix store.

```bash
mori registry list
mori registry search bun2nix
mori registry search nix2container
mori registry show shinzui/seihou-modules --full
mori registry docs shinzui/seihou-modules
mori path mori://shinzui/seihou-modules/templates/nix-bun-flake
curl -fsSL https://registry.npmjs.org/bun2nix/latest
curl -fsSL https://api.github.com/repos/nix-community/bun2nix/releases/latest
curl -fsSL https://api.github.com/repos/nlewo/nix2container/releases/latest
```

After declaring the new inputs and exposing the generator, use the explicit output path. Check generated workspace path prefixes because the file is at the repository root. If a preliminary frozen install reveals stale workspace metadata, refresh with the pinned shell's Bun and review that diff before generating.

```bash
nix flake lock
nix run .#bun2nix -- --lock-file bun.lock --output-file bun-deps.nix
nix build .#console-deps --no-link --no-write-lock-file
nix build .#console --out-link result-console --no-write-lock-file -L
nix build .#console-subpath --out-link result-console-subpath --no-write-lock-file -L
nix flake check --no-write-lock-file -L
```

New files must be visible to Git-based flakes. Stage only the implementation's intended files as needed before evaluating; do not stage unrelated user changes. A successful native build writes `result-console`, referring to a package with `share/keiro-ui/index.html`, hashed assets, release identity, and licences. Expected check output includes the following pattern; asset counts may vary.

```text
check-dist: 1 html, <count> hashed assets, all under / — OK
check-dist: 1 html, <count> hashed assets, all under /console/ — OK
```

On a Linux host with a running Docker daemon, use these commands after M2. The project shell need not be active for Nix builds; Docker itself is a host prerequisite.

```bash
nix build .#docker-image --out-link result-image --no-write-lock-file -L
nix run .#docker-image.copyToDockerDaemon --no-write-lock-file
bash scripts/check-container.sh keiro-ui-console:dev /
nix run .#docker-image-subpath.copyToDockerDaemon --no-write-lock-file
bash scripts/check-container.sh keiro-ui-console:dev-subpath /console/
bash scripts/benchmark-image.sh
```

For an interactive smoke on that Linux host, the port below is only an example; choose a free local port. The browser should show Overview and retain Workflows after a reload. Cleanup uses the name created here only.

```bash
docker run --detach --name keiro-ui-nix-smoke -p 127.0.0.1:18088:8080 keiro-ui-console:dev
curl --fail http://127.0.0.1:18088/
curl --fail http://127.0.0.1:18088/workflows
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18088/keiro/health/live
CONSOLE_EXTERNAL_URL=http://127.0.0.1:18088/ bun run test:e2e:production
docker stop keiro-ui-nix-smoke
docker container rm keiro-ui-nix-smoke
```

The first two requests return HTML with HTTP 200 and the last curl command prints `404`. The browser smoke then proves that JavaScript loaded before the container is stopped. Implement and document `CONSOLE_EXTERNAL_URL` in M3; it must bypass Playwright's current `webServer` build/start behavior.

Before final acceptance, run workspace regression checks inside the existing Nix shell, and docs checks when the documented OKF tools are installed. Install JavaScript dependencies normally for these developer tests; the separate native package acceptance must still succeed without them.

```bash
nix develop --no-write-lock-file -c bun install --frozen-lockfile
nix develop --no-write-lock-file -c bun run check
nix develop --no-write-lock-file -c bun run test
nix develop --no-write-lock-file -c bun run release:pack
just docs-check
git diff --check
```

The release command must continue producing `release/keiro-ui-console-<version>.tar.gz` using the shared staging helper. Record meaningful results rather than complete routine transcripts.


## Validation and Acceptance


M1 requires actual native builds on the supported Darwin/Linux systems, or explicit remaining platform evidence in Progress until those builds are performed. A clean source tree with no `node_modules` must succeed with the sandbox enabled. Default and `/console/` packages must pass their artifact checks. Installation must remain frozen; no ordinary build phase may contact the registry. Verify generation consistency and that the package emits the expected version/revision and font notice. Use Nix build checks for output inspection rather than manually exploring store paths.

M2 requires a working browser against each Docker image on Linux: Overview loads, Workflows deep-link reload works, and scripts/CSS load under the matching base path. Missing backend prefixes return 404 rather than console HTML. Image metadata selects Linux and the correct CPU architecture, user `65532:65532`, and port 8080. Inspect the declared runtime dependency graph using Nix metadata and confirm build tools/cache/source dependencies have not leaked into it; do not search the store filesystem. Reuse of the exact native console derivation is mandatory.

M3 requires passing automated artifact and container checks, the external-target browser smoke against the imported image, and actual performance evidence from unchanged and source-edited builds. The prepared registry cache and explicit Caddy layer identities must survive source edits; the application output must change. A docs-only edit excluded from the source, with fixed revision input, must leave the app derivation unchanged. The selected default must be justified against the same-payload streamed, uncompressed control using total assembly/import time, not just a fast metadata derivation. If Docker/Linux is unavailable locally, continue native and source work, then record the missing evidence without marking container/performance milestones complete.

M4 requires runnable documented commands, the correct base-path customization explanation, a validated ADR, the existing release archive still working, and passing relevant workspace/docs/flake checks. This request authorizes planning; do not claim these implementation criteria were run while creating the plan.


## Idempotence and Recovery


Nix builds and generator runs are repeatable. Generated `bun-deps.nix` is replaced only by the pinned generator, and is committed together with lock changes. If installation reports missing cache entries or frozen-lock mismatches, correct the lock/generation/manifest relationship and rerun in the sandbox; disabling isolation or fetching from the build phase is not recovery. Preserve the managed nixpkgs pin unless a recorded reproduced incompatibility requires a coordinated toolchain decision.

Container smoke scripts own uniquely named containers and clean them on success or failure. The benchmark owns temporary directories and labels and never prunes global Docker resources, deletes the shared Nix store, or edits the active checkout. Repeat source-change experiments using explicit revision inputs. Do not interpret timestamp-only changes as a meaningful rebuild experiment.

If an interrupted import leaves a local convenience tag, rerunning import replaces that tag with the selected image. No command in this plan pushes to a registry. Existing Bun development and release commands remain available during implementation. On failure, preserve useful logs and rerun the failed stage; do not reset unrelated working-tree changes. Commits stay on the current branch, use Conventional Commits, and include both `ExecPlan: docs/plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md` and the frontmatter's `Intention:` value as trailers.


## Interfaces and Dependencies


`nix/console.nix` is the reusable package function with `basePath ? "/"` and explicit revision input `gitCommit`; `pkgs.callPackage` supplies the pinned Bun/Node tools and helper. Its only runtime product is a static distribution at `share/keiro-ui`. `scripts/stage-console.sh` stages an existing Vite output with identity/licence files, and is shared by Nix and the current release script. `bun-deps.nix` is generated at the repository root and consumed through the registry-only wrapper described above.

`flake.module.nix` owns package/check wiring and shell additions. Native outputs are `console`, `default`, `console-subpath`, `console-deps`, and the pinned `bun2nix` executable. Linux adds `docker-image` and `docker-image-subpath`, including nix2container's `copyToDockerDaemon` passthrough programs. `nix/container.nix` accepts a console package and the pinned nix2container API; it must not build application sources independently. Base-path variants use the same function and dependency cache. Their distinct image tags permit validation without replacing each other.

New third-party inputs are bun2nix 2.1.2 and nix2container v1.1.0 at the verified commits recorded above, following the existing nixpkgs input. Inspect the released source when reconciling an API difference; their internal helpers are version-sensitive. Caddy and Node 22 come from that same nixpkgs revision. No new npm runtime dependency is necessary. Flake input hashes and generated npm fetch hashes are committed, and ordinary builds do not use `--impure` or read user package caches.

`scripts/check-container.sh` accepts `<image-reference> <base-path>` and leaves no running container. `scripts/benchmark-image.sh` emits phase timings and cache/layer identity evidence for the same payload under both builders. `CONSOLE_EXTERNAL_URL` selects an already running deployment in `apps/console/playwright.production.config.ts`, whose `webServer` is then omitted. Backend-dependent tests continue to use their existing availability probe.
