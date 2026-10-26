#!/usr/bin/env bash
# Shared HTTP acceptance for a running native artifact or container.
set -euo pipefail
url=${1:?usage: check-console-http.sh <deployment-url>}
url=${url%/}/
origin=$(printf '%s' "$url" | sed -E 's#(https?://[^/]+).*#\1#')
base=${url#"$origin"}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
request() {
  local path=$1 expected=$2
  local code
  code=$(curl --silent --show-error --max-time 10 -D "$tmp/headers" -o "$tmp/body" -w '%{http_code}' "$origin$path")
  [[ "$code" == "$expected" ]] || { echo "$path: expected $expected, got $code" >&2; exit 1; }
}
request "$base" 200
grep -qi 'content-type: text/html' "$tmp/headers"
grep -qi 'cache-control: no-cache' "$tmp/headers"
cp "$tmp/body" "$tmp/index"
request "${base}workflows" 200
cmp "$tmp/index" "$tmp/body"
grep -qi 'cache-control: no-cache' "$tmp/headers"
for ext in js css woff2; do
  if [[ "$ext" == woff2 ]]; then
    # Fonts are referenced by CSS, rather than index.html.
    asset=$(grep -oE '[^"() /]+\.woff2' "$tmp/css" | head -1)
    asset="${base}assets/$asset"
  else
    asset=$(grep -oE "${base}assets/[^\"]+\.$ext" "$tmp/index" | head -1)
  fi
  [[ -n "$asset" ]]
  request "$asset" 200
  grep -qi 'cache-control: public, max-age=31536000, immutable' "$tmp/headers"
  case "$ext" in
    js) grep -qiE 'content-type: (application|text)/javascript' "$tmp/headers" ;;
    css) grep -qi 'content-type: text/css' "$tmp/headers"; cp "$tmp/body" "$tmp/css" ;;
    woff2) grep -qi 'content-type: font/woff2' "$tmp/headers" ;;
  esac
done
request "${base}assets/does-not-exist.js" 404
! grep -qi '<!doctype html' "$tmp/body"
for prefix in kiroku shibuya pgmq keiro; do
  for suffix in '' / /health/live; do
    request "/$prefix$suffix" 404
    ! grep -qi '<!doctype html' "$tmp/body"
  done
done
if [[ "$base" != / ]]; then
  request "${base%/}" 308
  grep -qi "location: $base" "$tmp/headers"
  request / 404
  request /outside-console/workflows 404
fi
echo "check-console-http: $url routes, assets, MIME, cache and reserved prefixes — OK"
