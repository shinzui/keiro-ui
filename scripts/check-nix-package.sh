#!/bin/sh
# Inspect a realized package from inside a check derivation.
set -eu
[ "$#" -eq 4 ] || { echo "usage: $0 <package> <base-path> <version> <revision>" >&2; exit 2; }
dist=$1/share/keiro-ui
base=$2
version=$3
revision=$4
sh "$(dirname "$0")/check-dist.sh" "$dist" "$base"
[ "$(cat "$dist/VERSION")" = "$version+$revision" ]
grep -F "Built from commit $revision with base path \`$base\`" "$dist/NOTICE.md"
grep -F 'SIL OPEN FONT LICENSE' "$dist/OFL.txt" >/dev/null
[ ! -e "$dist/mockServiceWorker.js" ]
[ -s "$dist/deployment/Caddyfile.example" ]
[ -s "$dist/deployment/nginx.conf.example" ]
# Require both identity fields in the emitted JS, not only the notice.
grep -Fl -- "$revision" "$dist"/assets/*.js >/dev/null
grep -Fl -- "$version" "$dist"/assets/*.js >/dev/null
[ -n "$(find "$dist/assets" -name '*.woff2' -print -quit)" ]
[ -z "$(find "$dist" -name node_modules -o -name bun.lock -o -name '*.ts')" ]
echo 'check-nix-package: assets, identity, notices and runtime tree — OK'
