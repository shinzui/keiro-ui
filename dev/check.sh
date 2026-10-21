#!/usr/bin/env bash
# Probe every surface over HTTP and attempt every WebSocket upgrade; one line per check.
. "$(dirname "$0")/lib.sh"
set +e

status=0
probe() {
  local label="$1" url="$2" body code
  body="$(curl -sS --max-time 5 -w $'\n%{http_code}' "$url" 2>&1)"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [ "$code" = "200" ]; then
    printf 'ok    %-26s %s\n' "$label" "$(printf '%s' "$body" | head -c 160)"
  else
    printf 'FAIL  %-26s HTTP %s %s\n' "$label" "$code" "$(printf '%s' "$body" | head -c 160)"
    status=1
  fi
}
upgrade() {
  local label="$1" url="$2" code
  code="$(curl -s -o /dev/null --max-time 3 -w '%{http_code}' \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H "Origin: $STACK_CONSOLE_ORIGIN" "$url")"
  if [ "$code" = "101" ]; then
    printf 'ok    %-26s 101\n' "$label"
  else
    printf 'FAIL  %-26s %s\n' "$label" "$code"
    status=1
  fi
}

probe "kiroku /capabilities" "http://127.0.0.1:$STACK_KIROKU_PORT/capabilities"
probe "pgmq /" "http://127.0.0.1:$STACK_PGMQ_PORT/"
probe "keiro /health" "http://127.0.0.1:$STACK_KEIRO_PORT/health"
probe "shibuya /health/live" "http://127.0.0.1:$STACK_SHIBUYA_PORT/health/live"
upgrade "ws kiroku /ws/events" "http://127.0.0.1:$STACK_KIROKU_PORT/ws/events"
upgrade "ws kiroku /ws/metrics" "http://127.0.0.1:$STACK_KIROKU_PORT/ws/metrics"
upgrade "ws pgmq /ws" "http://127.0.0.1:$STACK_PGMQ_PORT/ws"
upgrade "ws keiro /ws" "http://127.0.0.1:$STACK_KEIRO_PORT/ws"
upgrade "ws shibuya /ws" "http://127.0.0.1:$STACK_SHIBUYA_PORT/ws"
if [ "${1:-jitsurei}" = "mori" ]; then
  . "$STACK_ROOT/dev/profiles/mori.env"
  probe "mori daemon /subscriptions" "http://127.0.0.1:$STACK_MORI_METRICS_PORT/subscriptions"
fi
exit $status
