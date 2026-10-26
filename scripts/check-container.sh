#!/usr/bin/env bash
# Start and remove only our own read-only container, including on failure.
# CONTAINER_RUNTIME=apple uses Apple's container CLI; default: docker.
set -euo pipefail
image=${1:?usage: check-container.sh <image> <base-path>}
base=$(sh scripts/normalize-base-path.sh "${2:?base path required}")
runtime=${CONTAINER_RUNTIME:-docker}
id=''
cleanup() {
  if [[ -n "$id" ]]; then
    if [[ "$runtime" == apple ]]; then
      container logs "$id" >&2 || true
      container stop "$id" >/dev/null || true
      container delete "$id" >/dev/null
    else
      docker logs "$id" >&2 || true
      docker rm -f "$id" >/dev/null
    fi
  fi
}
trap cleanup EXIT
if [[ "$runtime" == apple ]]; then
  container image inspect "$image" | python3 -c '
import json,sys
x=json.load(sys.stdin)[0]["variants"][0]["config"]
assert x["os"] == "linux"
assert x["architecture"] in ("amd64", "arm64")
assert x["config"]["User"] == "65532:65532"
assert x["config"]["Entrypoint"][0].endswith("/bin/caddy")
'
  port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
  id="keiro-ui-smoke-$$"
  container run --detach --name "$id" --read-only --cap-drop ALL \
    -p "127.0.0.1:$port:8080" "$image"
elif [[ "$runtime" == docker ]]; then
  docker image inspect "$image" | python3 -c '
import json,sys
x=json.load(sys.stdin)[0]
assert x["Os"] == "linux"
assert x["Architecture"] in ("amd64", "arm64")
assert x["Config"]["User"] == "65532:65532"
assert "8080/tcp" in x["Config"]["ExposedPorts"]
assert x["Config"]["Entrypoint"][0].endswith("/bin/caddy")
'
  id=$(docker run --detach --read-only --cap-drop ALL --security-opt no-new-privileges \
    -p 127.0.0.1::8080 "$image")
  port=$(docker port "$id" 8080/tcp | sed 's/.*://')
else
  echo "unsupported CONTAINER_RUNTIME: $runtime" >&2; exit 2
fi
url="http://127.0.0.1:$port$base"
ready=false
for ((i=0; i<60; i++)); do
  if curl --fail --silent --max-time 1 "$url" >/dev/null; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]] || { echo 'container did not become ready within 30 seconds' >&2; exit 1; }
bash scripts/check-console-http.sh "$url"
revision=$(curl --fail --silent "${url}VERSION")
CONSOLE_EXTERNAL_URL="$url" CONSOLE_EXPECTED_REVISION="${revision#*+}" bun run test:e2e:production
