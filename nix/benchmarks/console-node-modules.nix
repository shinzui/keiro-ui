# Manifest-only install. Workspace symlinks remain relative to the consuming tree.
{ stdenvNoCC, lib, bun, bun2nix, dependencySource, bunDeps }:
stdenvNoCC.mkDerivation {
  pname = "console-node-modules";
  version = "1";
  src = dependencySource;
  strictDeps = true;
  nativeBuildInputs = [ bun bun2nix.hook ];
  inherit bunDeps;
  bunInstallFlags = [ "--frozen-lockfile" "--linker=isolated" ]
    ++ lib.optional stdenvNoCC.hostPlatform.isDarwin "--backend=symlink";
  dontRunLifecycleScripts = true;
  dontUseBunPatch = true;
  dontUseBunCheck = true;
  dontFixup = true;
  buildPhase = "true";
  installPhase = ''
    mkdir -p $out
    # Rebase any links into the writable skeleton; never retain build-directory links.
    bun --no-install -e '
      const fs = require("fs"), path = require("path");
      function walk(dir) {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
          const name = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) {
            const target = fs.readlinkSync(name);
            if (target.startsWith(process.cwd() + "/")) {
              fs.unlinkSync(name);
              fs.symlinkSync(path.relative(path.dirname(path.resolve(name)), target), name);
            }
          } else if (entry.isDirectory()) walk(name);
        }
      }
      walk(".");
    '
    while IFS= read -r -d "" dir; do
      mkdir -p "$out/$(dirname "$dir")"
      cp -a "$dir" "$out/$dir"
    done < <(find . -type d -name node_modules -prune -print0)
  '';
}
