#!/bin/sh
# Stage an existing build; never installs dependencies or runs the bundler.
# Usage: stage-console.sh <dist> <destination> <version> <revision> <base-path>
set -eu
[ "$#" -eq 5 ] || { echo "usage: $0 <dist> <destination> <version> <revision> <base-path>" >&2; exit 2; }
root=$(cd "$(dirname "$0")/.." && pwd)
dist=$1
out=$2
version=$3
commit=$4
base=$(sh "$root/scripts/normalize-base-path.sh" "$5")
sh "$root/scripts/check-dist.sh" "$dist" "$base"
[ ! -e "$out" ] || { echo "stage-console: destination already exists: $out" >&2; exit 1; }
mkdir -p "$out/deployment"
cp -R "$dist"/. "$out/"
rm -f "$out/mockServiceWorker.js"
printf '%s+%s\n' "$version" "$commit" >"$out/VERSION"
cp "$root/packages/ui/src/fonts/OFL.txt" "$out/OFL.txt"
cp "$root/docs/deployment/"*.example "$out/deployment/"
cp "$root/docs/deployment/console-config.example.json" "$out/deployment/"
cp -R "$root/docs/deployment/kubernetes" "$out/deployment/"
cat >"$out/NOTICE.md" <<NOTICE
# keiro runtime console $version

Built from commit $commit with base path \`$base\`. Deployment: docs/user/deployment.md in the
keiro-ui repository; the proxy examples are in \`deployment/\`.

## Third-party notices

- **Paper Mono** (the files \`assets/PaperMono*.woff2\`) is licensed under the SIL Open Font
  License, Version 1.1; the licence text is in \`OFL.txt\` beside this file.
NOTICE
