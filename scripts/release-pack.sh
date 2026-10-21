#!/bin/sh
# Builds the console (base path VITE_BASE_PATH, default /) and writes
# release/keiro-ui-console-<version>.tar.gz with the bundle, VERSION, NOTICE.md, the Paper Mono
# licence, and the two proxy examples. Rerunning overwrites the outputs.
#   bun run release:pack
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

version=$(node -p 'require("./apps/console/package.json").version')
commit=${KEIRO_UI_GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}
base=${VITE_BASE_PATH:-/}
name="keiro-ui-console-$version"
out="release/$name"

echo "release-pack: building (base $base) ..."
VITE_BASE_PATH="$base" KEIRO_UI_GIT_COMMIT="$commit" bun run build >/dev/null
sh scripts/check-dist.sh apps/console/dist "$base"

rm -rf "$out" "release/$name.tar.gz"
mkdir -p "$out/deployment"
cp -R apps/console/dist/. "$out/"
# The mock service worker only serves recorded fixtures in development.
rm -f "$out/mockServiceWorker.js"
printf '%s+%s\n' "$version" "$commit" >"$out/VERSION"
cp packages/ui/src/fonts/OFL.txt "$out/OFL.txt"
cp docs/deployment/Caddyfile.example "$out/deployment/Caddyfile.example"
cp docs/deployment/nginx.conf.example "$out/deployment/nginx.conf.example"
cat >"$out/NOTICE.md" <<NOTICE
# keiro runtime console $version

Built from commit $commit with base path \`$base\`. Deployment: docs/deployment.md in the
keiro-ui repository; the proxy examples are in \`deployment/\`.

## Third-party notices

- **Paper Mono** (the files \`assets/PaperMono*.woff2\`) is licensed under the SIL Open Font
  License, Version 1.1; the licence text is in \`OFL.txt\` beside this file.
NOTICE

# A stable listing and metadata, so two packs of the same commit list the same files.
(cd release && find "$name" -type f | LC_ALL=C sort >"$name.files" &&
  tar -czf "$name.tar.gz" -T "$name.files" && rm "$name.files")
echo "release-pack: wrote release/$name.tar.gz"
if command -v shasum >/dev/null; then shasum -a 256 "release/$name.tar.gz"; else sha256sum "release/$name.tar.gz"; fi
