#!/usr/bin/env bash
# Run by `just stack-up` before anything starts: every port the profile binds must be free.
# A port held by another program would otherwise leave that surface dead with a bind failure,
# and `just stack-check` would probe the other program instead (FRIC-12 in docs/friction-log/).
# Usage: dev/preflight.sh [jitsurei|mori]
. "$(dirname "$0")/lib.sh"

profile="${1:-jitsurei}"
ports=(
  "shibuya STACK_SHIBUYA_PORT $STACK_SHIBUYA_PORT"
  "kiroku STACK_KIROKU_PORT $STACK_KIROKU_PORT"
  "pgmq STACK_PGMQ_PORT $STACK_PGMQ_PORT"
  "keiro STACK_KEIRO_PORT $STACK_KEIRO_PORT"
)
if [ "$profile" = "mori" ]; then
  ports+=("mori-daemon STACK_MORI_METRICS_PORT ${STACK_MORI_METRICS_PORT:-9191}")
fi

busy=0
for entry in "${ports[@]}"; do
  read -r surface variable port <<<"$entry"
  holders="$(stack_port_holders "$port")"
  [ -z "$holders" ] && continue
  busy=1
  while read -r pid; do
    printf 'port %s (%s, %s) is held by pid %s: %s\n' \
      "$port" "$surface" "$variable" "$pid" "$(stack_pid_command "$pid")" >&2
  done <<<"$holders"
done

if [ "$busy" = 1 ]; then
  cat >&2 <<EOF
just stack-up: not starting. If that is this stack from an earlier \`just stack-up\`, run
\`just stack-down\`. Otherwise stop that program, or move the stack's port by setting the
variable above in dev/.env (dev/README.md, "Moving a port").
EOF
  exit 1
fi
say "preflight: ports free (${profile})"
