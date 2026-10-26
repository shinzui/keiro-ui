#!/bin/sh
# Print a path safe for both Vite and Caddy. Keep nix/base-path.nix in sync.
set -eu
raw=${1:-/}
base="/$(printf '%s' "$raw" | sed 's:^/::; s:/$::')/"
[ "$base" != // ] || base=/
case "$base" in
  *[!a-zA-Z0-9_./~-]* | *//* | */./* | */../* | /keiro/* | /kiroku/* | /pgmq/* | /shibuya/*)
    echo "invalid console base path: $raw" >&2; exit 1 ;;
esac
printf '%s\n' "$base"
