# Shared helpers for the dev stack scripts. Sourced, never executed.
set -euo pipefail

STACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$STACK_ROOT/dev/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$STACK_ROOT/dev/.env"
  set +a
else
  echo "dev/.env is missing: cp dev/.env.example dev/.env and adjust the paths" >&2
  exit 1
fi

# Run a command inside an owning repository's Nix dev shell (its PostgreSQL, cabal, ...).
in_repo() {
  local repo="$1"
  shift
  (cd "$repo" && nix develop --quiet -c "$@")
}

say() { printf '%s\n' "$*"; }

# The PIDs listening on a TCP port, one per line; empty when the port is free.
stack_port_holders() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

# A PID's full command line.
stack_pid_command() {
  ps -o command= -p "$1" 2>/dev/null || echo "(exited)"
}

# Whether a PID belongs to this checkout's stack: it or an ancestor is the process-compose that
# `just stack-up` started (on .dev/process-compose.sock), or a dev/bin executable started by hand.
stack_owns_pid() {
  local pid="$1" command
  while [ -n "$pid" ] && [ "$pid" -gt 1 ]; do
    command="$(ps -o command= -p "$pid" 2>/dev/null)" || return 1
    case "$command" in
    *process-compose*.dev/process-compose.sock* | dev/bin/* | "$STACK_ROOT"/dev/bin/*) return 0 ;;
    esac
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  done
  return 1
}
