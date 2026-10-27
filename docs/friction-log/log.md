# Bundle Update Log

## 2026-10-27
* **Update**: FRIC-4 resolved: Verified sh scripts/smoke-kubernetes-container.sh on Apple Container; replace the previous Colima workaround with Apple-only local execution and reject other runtimes.

## 2026-10-26
* **Update**: FRIC-6 accepted: Run production acceptance on port 18082; retain configurable ports as the recovery path.
* **Update**: FRIC-5 resolved: Remove the unneeded bind-port file capability and document the constraint in ADR-9 and the runbook.
* **Update**: FRIC-4 resolved: Use a checkout-local disposable bind source; the container smoke passes under Colima.
* **Addition**: FRIC-6 records detour environment friction with mori://shinzui/keiro-ui: Existing Apple container shadows the production smoke IPv4 port
* **Addition**: FRIC-5 records detour environment friction with https://github.com/caddyserver/caddy-docker: Official Caddy image retains a privileged executable capability
* **Addition**: FRIC-4 records detour environment friction with https://github.com/abiosoft/colima: Colima cannot bind the host temporary directory
* **Update**: FRIC-3 accepted: The normal cached importer and produced static images remain unchanged; upstream helper determinism is outside this plan.
* **Addition**: FRIC-3 records detour tooling friction with https://github.com/nlewo/nix2container: Patched Skopeo fails Nix rebuild byte comparison
* **Update**: FRIC-2 resolved: Use the explicit Git flake interface in measurement harnesses.
* **Addition**: FRIC-2 records detour tooling friction with https://nixos.org/nix: Path flakes inflate benchmark evaluation with ignored checkout files
* **Update**: FRIC-1 accepted: Keep the compatibility patch until an upstream release accepts v2 lockfiles.
* **Addition**: FRIC-1 records detour tooling friction with https://github.com/nix-community/bun2nix: Released bun2nix rejects Bun lockfile version 2
* **Adoption**: Adopt the `friction-log` profile (`coordination.frictionLog`) from https://raw.githubusercontent.com/shinzui/okf-profiles/v0.23.0/package.dhall.
