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
