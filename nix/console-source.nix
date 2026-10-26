{ lib }:
root:
builtins.path {
  path = root;
  name = "console-source";
  filter = path: type:
    let
      rel = lib.removePrefix (toString root + "/") (toString path);
      parts = lib.splitString "/" rel;
      excluded = builtins.any (p: builtins.elem p [
        "node_modules" "dist" "dist-production" ".git" ".dev" ".tanstack"
        ".vite" "test-results" "playwright-report"
      ] || lib.hasPrefix ".env" p) parts;
      roots = [ "package.json" "bun.lock" "bunfig.toml" "tsconfig.base.json" ];
      needed = builtins.elem rel roots
        || rel == "apps" || rel == "apps/console" || lib.hasPrefix "apps/console/" rel
        || rel == "packages" || lib.hasPrefix "packages/" rel
        || rel == "scripts" || builtins.elem rel [
          "scripts/stage-console.sh" "scripts/check-dist.sh" "scripts/normalize-base-path.sh"
        ]
        || rel == "docs" || rel == "docs/deployment"
        || lib.hasPrefix "docs/deployment/" rel;
    in !excluded && needed;
}
