{ lib, stdenvNoCC, bun, nodejs_22, bun2nix
, basePath ? "/", gitCommit ? "unknown", sourceRoot ? ../.
}:
let
  base = import ./base-path.nix { inherit lib; } basePath;
  manifest = builtins.fromJSON (builtins.readFile (sourceRoot + "/apps/console/package.json"));
  deps = import ./console-deps.nix { inherit lib bun2nix sourceRoot; };
  inherit (deps) bunDeps;

in
stdenvNoCC.mkDerivation {
  pname = "keiro-ui-console";
  version = manifest.version;
  src = import ./console-source.nix { inherit lib; } sourceRoot;
  strictDeps = true;
  nativeBuildInputs = [ bun nodejs_22 bun2nix.hook ];
  inherit bunDeps;
  bunInstallFlags = [ "--frozen-lockfile" "--linker=isolated" ]
    ++ lib.optional stdenvNoCC.hostPlatform.isDarwin "--backend=symlink";
  dontRunLifecycleScripts = true;
  dontUseBunPatch = true;
  dontUseBunCheck = true;
  dontFixup = true;
  VITE_BASE_PATH = base;
  KEIRO_UI_GIT_COMMIT = gitCommit;
  preBunSetInstallCacheDirPhase = "keiro_cache_start=$(date +%s%N)";
  postBunSetInstallCacheDirPhase = ''echo "keiro-timing cache_ms=$(( ($(date +%s%N) - keiro_cache_start) / 1000000 ))"'';
  preBunNodeModulesInstallPhase = "keiro_install_start=$(date +%s%N)";
  postBunNodeModulesInstallPhase = ''echo "keiro-timing install_ms=$(( ($(date +%s%N) - keiro_install_start) / 1000000 ))"'';
  buildPhase = ''
    runHook preBuild
    keiro_build_start=$(date +%s%N)
    bun run build
    echo "keiro-timing vite_ms=$(( ($(date +%s%N) - keiro_build_start) / 1000000 ))"
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    keiro_stage_start=$(date +%s%N)
    sh scripts/stage-console.sh apps/console/dist "$out/share/keiro-ui" \
      ${lib.escapeShellArg manifest.version} "$KEIRO_UI_GIT_COMMIT" "$VITE_BASE_PATH"
    echo "keiro-timing staging_ms=$(( ($(date +%s%N) - keiro_stage_start) / 1000000 ))"
    runHook postInstall
  '';
  passthru = { basePath = base; inherit gitCommit; console-deps = bunDeps; };
  meta.description = "Static keiro runtime console";
}
