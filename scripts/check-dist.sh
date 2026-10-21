#!/bin/sh
# Fails when a built index.html references an asset outside the base path, or when an emitted
# asset's filename carries no content hash.
#   sh scripts/check-dist.sh apps/console/dist /console/
set -eu

dist=${1:-apps/console/dist}
base=${2:-/}
html="$dist/index.html"
[ -f "$html" ] || { echo "check-dist: $html not found" >&2; exit 1; }

status=0
# Every src/href in index.html that is a local asset must start with the base path.
for ref in $(grep -oE '(src|href)="[^"]+"' "$html" | sed -E 's/^(src|href)="([^"]+)"$/\2/'); do
  case "$ref" in
    http://* | https://* | data:* | "#"*) ;;
    "$base"*) ;;
    *) echo "check-dist: $ref is not under $base" >&2; status=1 ;;
  esac
done

# Every emitted asset under assets/ carries a hash: name-<hash>.ext (Vite's default).
count=0
for file in "$dist"/assets/*; do
  [ -e "$file" ] || continue
  count=$((count + 1))
  name=$(basename "$file")
  echo "$name" | grep -qE -- '-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$' || {
    echo "check-dist: $name has no content hash" >&2
    status=1
  }
done

[ "$status" -eq 0 ] && echo "check-dist: 1 html, $count hashed assets, all under $base — OK"
exit "$status"
