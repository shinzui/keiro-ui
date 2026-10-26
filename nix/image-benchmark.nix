# Internal measurement harness; deliberately absent from normal flake outputs.
{ flake, sourceRoot, system ? builtins.currentSystem, gitCommit ? "benchmark-fixed"
, basePath ? "/", reuseNodeModules ? false }:
let
  pkgs = flake.inputs.nixpkgs.legacyPackages.${system};
  bun2nix = flake.packages.${system}.bun2nix;
  baseConsole = pkgs.callPackage ./console.nix {
    inherit bun2nix sourceRoot gitCommit basePath;
  };
  deps = import ./console-deps.nix { inherit (pkgs) lib; inherit bun2nix sourceRoot; };
  nodeModules = pkgs.callPackage ./benchmarks/console-node-modules.nix {
    inherit bun2nix;
    inherit (deps) dependencySource bunDeps;
  };
  # Rejected optimization kept only in this measurement harness for reproduction.
  console = if !reuseNodeModules then baseConsole else baseConsole.overrideAttrs (_: {
    nativeBuildInputs = [ pkgs.bun pkgs.nodejs_22 ];
    configurePhase = ''
      keiro_restore_start=$(date +%s%N)
      cp -R ${nodeModules}/. .
      echo "keiro-timing restore_ms=$(( ($(date +%s%N) - keiro_restore_start) / 1000000 ))"
    '';
  });
  image = pkgs.callPackage ./container.nix {
    nix2container = flake.inputs.nix2container.packages.${system}.nix2container;
  } { inherit console; tag = "benchmark"; };
  control = pkgs.callPackage ./benchmarks/stream-container.nix { } {
    inherit (image) console caddyConfig config;
  };
  runtime = control.runtimeArchive;
in {
  inherit console image control runtime;
  skopeo = flake.inputs.nix2container.packages.${system}.skopeo-nix2container;
  nativeConfig = pkgs.callPackage ./caddy-config.nix { } {
    inherit (console) basePath;
    root = "${console}/share/keiro-ui";
    port = "18088";
  };
  identities = {
    console = console.drvPath;
    cache = console.console-deps.drvPath;
    nodeModules = nodeModules.drvPath;
    runtime = image.runtimeLayer.drvPath;
    image = image.drvPath;
  };
}
