#!/usr/bin/env bash
# Start the two socket-only PostgreSQL clusters the stack reads (both no-ops when running).
. "$(dirname "$0")/lib.sh"

say "keiro PostgreSQL ($STACK_PG_SOCKET_DIR)"
in_repo "$KEIRO_REPO" just postgres-start
in_repo "$KEIRO_REPO" just jitsurei-db-create

say "pgmq-hs PostgreSQL ($STACK_PGMQ_SOCKET_DIR)"
in_repo "$PGMQ_HS_REPO" bash -c '
  set -euo pipefail
  mkdir -p "$PGHOST"
  [ -d "$PGDATA" ] || initdb --auth=trust --no-locale --encoding=UTF8 >/dev/null
  pg_ctl status -D "$PGDATA" >/dev/null 2>&1 ||
    pg_ctl start -w -D "$PGDATA" -l "$PGLOG" \
      -o "--unix_socket_directories='"'"'$PGHOST'"'"'" -o "-c listen_addresses='"''"'"
  createdb -h "$PGHOST" "'"$STACK_PGMQ_DATABASE"'" 2>/dev/null || true
'
