#!/bin/sh
# Builds the console (base path VITE_BASE_PATH, default /) and writes
# release/keiro-ui-console-<version>.tar.gz with the bundle, VERSION, NOTICE.md, the Paper Mono
# licence, deployment examples, and the Kubernetes recipe. Rerunning overwrites the outputs.
#   bun run release:pack
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

version=$(node -p 'require("./apps/console/package.json").version')
commit=${KEIRO_UI_GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}
base=$(sh scripts/normalize-base-path.sh "${VITE_BASE_PATH:-/}")
name="keiro-ui-console-$version"
out="release/$name"

echo "release-pack: building (base $base) ..."
VITE_BASE_PATH="$base" KEIRO_UI_GIT_COMMIT="$commit" bun run build >/dev/null
rm -rf "$out" "release/$name.tar.gz"
sh scripts/stage-console.sh apps/console/dist "$out" "$version" "$commit" "$base"

# A stable listing and metadata, so two packs of the same commit list the same files.
(cd release && find "$name" -type f | LC_ALL=C sort >"$name.files" &&
  tar -czf "$name.tar.gz" -T "$name.files" && rm "$name.files")
echo "release-pack: wrote release/$name.tar.gz"
if command -v shasum >/dev/null; then shasum -a 256 "release/$name.tar.gz"; else sha256sum "release/$name.tar.gz"; fi
