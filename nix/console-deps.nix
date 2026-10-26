{ lib, bun2nix, sourceRoot ? ../. }:
let
  workspacePaths = lib.concatMap (dir:
    map (name: "${dir}/${name}")
      (builtins.attrNames (lib.filterAttrs (_: type: type == "directory") (builtins.readDir (sourceRoot + "/${dir}"))))
  ) [ "apps" "packages" ];
  workspaceNames = map (path: (builtins.fromJSON (builtins.readFile (sourceRoot + "/${path}/package.json"))).name) workspacePaths;
  # Drop lazy local entries before fetchBunDeps examines their values.
  registryOnly = { copyPathToStore, fetchFromGitHub, fetchgit, fetchurl, ... }@args:
    builtins.removeAttrs (import (sourceRoot + "/bun-deps.nix") args) workspaceNames;
  dependencySource = lib.fileset.toSource {
    root = sourceRoot;
    fileset = lib.fileset.unions (map (p: sourceRoot + "/${p}")
      ([ "package.json" "bun.lock" "bunfig.toml" ] ++ map (p: "${p}/package.json") workspacePaths));
  };
in {
  inherit dependencySource;
  bunDeps = bun2nix.fetchBunDeps { bunNix = registryOnly; };
}
