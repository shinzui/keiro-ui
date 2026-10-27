#!/bin/sh
# Local-only image build and smoke. Never contacts Kubernetes; cleans only unique resources.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
case "${CONTAINER_RUNTIME:-apple}" in
  apple|container) ;;
  *) echo 'This smoke requires Apple Container (CONTAINER_RUNTIME=apple).' >&2; exit 2 ;;
esac
command -v container >/dev/null
container system status >/dev/null
sh scripts/check-dist.sh apps/console/dist /console/
mkdir -p "$root/.dev"
task_dir=$(mktemp -d "$root/.dev/keiro-console-smoke.XXXXXX")
task_id=$(basename "$task_dir" | tr '[:upper:].' '[:lower:]-')
task_image="$task_id:local"
task_container=""
task_negative=""
task_pid=""
negative_pid=""
cleanup() {
  [ -z "$task_container" ] || container delete --force "$task_container" >/dev/null 2>&1 || true
  [ -z "$task_negative" ] || container delete --force "$task_negative" >/dev/null 2>&1 || true
  container image delete "$task_image" >/dev/null 2>&1 || true
  [ -z "$task_pid" ] || wait "$task_pid" 2>/dev/null || true
  [ -z "$negative_pid" ] || wait "$negative_pid" 2>/dev/null || true
  rm -rf "$task_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cp docs/deployment/kubernetes/base/Caddyfile "$task_dir/Caddyfile"
cp docs/deployment/kubernetes/base/console-config.json "$task_dir/console-config.json"
chmod 755 "$task_dir"
chmod 644 "$task_dir"/*
container build -f docs/deployment/kubernetes/Dockerfile -t "$task_image" .
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
task_container="$task_id"
# Attached execution lets the shell collect the actual process exit status after stop.
container run --name "$task_container" --read-only --cap-drop ALL --user 10001:10001 \
  --tmpfs /data:uid=10001 --tmpfs /config:uid=10001 --tmpfs /tmp:uid=10001 \
  --mount "type=bind,source=$task_dir,target=/etc/keiro-console,readonly" \
  -p "127.0.0.1:$port:8080" "$task_image" >"$task_dir/run.log" 2>&1 &
task_pid=$!
url="http://127.0.0.1:$port"
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --max-time 5 -fsS "$url/readyz" > /dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || { cat "$task_dir/run.log" >&2; container logs "$task_container"; exit 1; }
curl --max-time 5 -fsS "$url/console/" > "$task_dir/index"
curl --max-time 5 -fsS "$url/console/workflows?target=prod-orders" > "$task_dir/deep"
cmp "$task_dir/index" "$task_dir/deep"
curl --max-time 5 -fsS -D "$task_dir/headers" "$url/console/console-config.json" > "$task_dir/catalog"
cmp "$task_dir/catalog" "$task_dir/console-config.json"
grep -qi 'content-type: application/json' "$task_dir/headers"
grep -qi 'cache-control: no-store' "$task_dir/headers"
[ "$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$url/inspection/unknown/keiro/health")" = 404 ]
mv "$task_dir/console-config.json" "$task_dir/catalog.saved"
# VM file sharing can publish the directory change asynchronously.
for attempt in 1 2 3 4 5; do
  [ "$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$url/console/console-config.json")" = 503 ] && break
  sleep 1
done
[ "$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$url/console/console-config.json")" = 503 ]
[ "$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$url/readyz")" = 503 ]
[ "$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$url/livez")" = 200 ]
container stop --time 10 "$task_container" >/dev/null
wait "$task_pid"
task_pid=""
container logs "$task_container" > "$task_dir/shutdown.log"
grep -q 'shutdown complete' "$task_dir/shutdown.log"
# The same image must refuse startup if the mandatory catalog is missing.
task_negative="$task_id-negative"
container run --name "$task_negative" --read-only --cap-drop ALL --user 10001:10001 \
  --mount "type=bind,source=$task_dir,target=/etc/keiro-console,readonly" \
  "$task_image" >"$task_dir/negative.log" 2>&1 &
negative_pid=$!
stopped=0
for attempt in $(seq 1 30); do
  if container inspect "$task_negative" 2>/dev/null | python3 -c 'import json,sys; sys.exit(json.load(sys.stdin)[0]["status"]["state"] != "stopped")' 2>/dev/null; then
    stopped=1; break
  fi
  sleep 1
done
[ "$stopped" -eq 1 ] || { cat "$task_dir/negative.log" >&2; exit 1; }
if wait "$negative_pid"; then
  negative_pid=""
  echo 'Container unexpectedly accepted missing configuration' >&2; exit 1
fi
negative_pid=""
echo "Apple Container smoke passed: non-root/read-only, assets, deep link, JSON/no-store, probes, missing-config refusal and clean shutdown."
