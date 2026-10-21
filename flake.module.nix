# Project customizations that survive Seihou upgrades (see flake.module.nix.example).
{ ... }:
{
  perSystem = { pkgs, ... }: {
    # Node 22 runs vitest and Playwright (bun installs packages and runs scripts);
    # process-compose supervises the local runtime stack (dev/process-compose.yaml); caddy
    # serves the composed-origin smoke test of docs/plans/18-package-the-console-for-deployment.md.
    # On NixOS, Playwright's downloaded Chromium does not start; set
    # PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}" in a devShell override here.
    bunProject.extraDevPackages = [ pkgs.nodejs_22 pkgs.caddy pkgs.process-compose ];
  };
}
