# Project customizations that survive Seihou upgrades (see flake.module.nix.example).
{ inputs, ... }:
{
  perSystem = { pkgs, system, lib, ... }:
    let
      bun2nix = import ./nix/bun2nix.nix { bun2nix = inputs.bun2nix.packages.${system}.default; };
      gitCommit = inputs.self.rev or inputs.self.dirtyRev or "unknown";
      console = pkgs.callPackage ./nix/console.nix { inherit bun2nix gitCommit; };
      container = pkgs.callPackage ./nix/container.nix {
        nix2container = inputs.nix2container.packages.${system}.nix2container;
      };
      packageCheck = package: pkgs.runCommand "check-${package.name}" { } ''
        sh ${./scripts}/check-nix-package.sh ${package} ${lib.escapeShellArg package.basePath} \
          ${lib.escapeShellArg package.version} ${lib.escapeShellArg package.gitCommit}
        touch $out
      '';
      consoleSubpath = console.override { basePath = "/console/"; };
    in {
    # Node 22 runs vitest and Playwright (bun installs packages and runs scripts);
    # process-compose supervises the local runtime stack (dev/process-compose.yaml); caddy
    # serves the composed-origin smoke test of docs/plans/18-package-the-console-for-deployment.md.
    # On NixOS, Playwright's downloaded Chromium does not start; set
    # PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}" in a devShell override here.
    bunProject.extraDevPackages = [ pkgs.nodejs_22 pkgs.caddy pkgs.process-compose pkgs.python3 bun2nix ];
    packages = {
      inherit bun2nix console;
      default = console;
      console-subpath = consoleSubpath;
      console-deps = console.console-deps;
    } // lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
      docker-image = container { inherit console; };
      docker-image-subpath = container { console = consoleSubpath; tag = "dev-subpath"; };
    };
    checks = {
      console = packageCheck console;
      console-subpath = packageCheck consoleSubpath;
      caddy-root = pkgs.callPackage ./nix/caddy-config.nix { } { basePath = console.basePath; };
      caddy-subpath = pkgs.callPackage ./nix/caddy-config.nix { } { basePath = consoleSubpath.basePath; };
      bun-deps = pkgs.runCommand "check-bun-deps" { nativeBuildInputs = [ bun2nix ]; } ''
        bun2nix --lock-file ${./bun.lock} --output-file bun-deps.nix
        diff -u ${./bun-deps.nix} bun-deps.nix
        touch $out
      '';
    };
  };
}
