#!/bin/sh
# Local-only image build and smoke. Never contacts Kubernetes; cleans only unique resources.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
runtime=${CONTAINER_RUNTIME:-docker}
command -v "$runtime" >/dev/null
"$runtime" info >/dev/null
sh scripts/check-dist.sh apps/console/dist /console/
mkdir -p "$root/.dev"
task_dir=$(mktemp -d "$root/.dev/keiro-console-smoke.XXXXXX")
task_id=$(basename "$task_dir" | tr '[:upper:].' '[:lower:]-')
task_image="$task_id:local"
task_container=""
task_negative=""
cleanup() {
  [ -z "$task_container" ] || "$runtime" rm -f "$task_container" >/dev/null 2>&1 || true
  [ -z "$task_negative" ] || "$runtime" rm -f "$task_negative" >/dev/null 2>&1 || true
  "$runtime" image rm "$task_image" >/dev/null 2>&1 || true
  rm -rf "$task_dir"
}
trap cleanup EXIT INT TERM
cp docs/deployment/kubernetes/base/Caddyfile "$task_dir/Caddyfile"
cp docs/deployment/kubernetes/base/console-config.json "$task_dir/console-config.json"
chmod 755 "$task_dir"
chmod 644 "$task_dir"/*
"$runtime" build -f docs/deployment/kubernetes/Dockerfile -t "$task_image" .
task_container=$("$runtime" run -d --read-only --cap-drop ALL --security-opt no-new-privileges --user 10001:10001 --tmpfs /data:uid=10001 --tmpfs /config:uid=10001 --tmpfs /tmp:uid=10001 --mount "type=bind,src=$task_dir,dst=/etc/keiro-console,readonly" -p 127.0.0.1::8080 "$task_image")
sleep 1
if [ "$("$runtime" inspect --format '{{.State.Running}}' "$task_container")" != true ]; then "$runtime" logs "$task_container"; exit 1; fi
port=$("$runtime" port "$task_container" 8080/tcp | sed 's/.*://')
url="http://127.0.0.1:$port"
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$url/readyz" > /dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || { "$runtime" logs "$task_container"; exit 1; }
curl -fsS "$url/console/" > "$task_dir/index"
curl -fsS "$url/console/workflows?target=prod-orders" > "$task_dir/deep"
cmp "$task_dir/index" "$task_dir/deep"
curl -fsS -D "$task_dir/headers" "$url/console/console-config.json" > "$task_dir/catalog"
cmp "$task_dir/catalog" "$task_dir/console-config.json"
grep -qi 'content-type: application/json' "$task_dir/headers"
grep -qi 'cache-control: no-store' "$task_dir/headers"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$url/inspection/unknown/keiro/health")" = 404 ]
mv "$task_dir/console-config.json" "$task_dir/catalog.saved"
# VM file sharing can publish the directory change asynchronously.
for attempt in 1 2 3 4 5; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$url/console/console-config.json")" = 503 ] && break
  sleep 1
done
[ "$(curl -s -o /dev/null -w '%{http_code}' "$url/console/console-config.json")" = 503 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$url/readyz")" = 503 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "$url/livez")" = 200 ]
"$runtime" stop --time 10 "$task_container" >/dev/null
[ "$("$runtime" inspect --format '{{.State.ExitCode}}' "$task_container")" = 0 ]
# The same image must refuse startup if the mandatory catalog is missing.
task_negative=$("$runtime" run -d --read-only --mount "type=bind,src=$task_dir,dst=/etc/keiro-console,readonly" "$task_image")
[ "$("$runtime" wait "$task_negative")" != 0 ]
echo "Container smoke passed: non-root/read-only, assets, deep link, JSON/no-store, probes, missing-config refusal and clean shutdown."
