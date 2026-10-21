#!/usr/bin/env bash
# Seed keiro's jitsurei demo scenarios. Safe to repeat. The pgmq demo queues are seeded by the
# stack itself (process `pgmq-seed`) once the shibuya consumer has installed the pgmq schema.
. "$(dirname "$0")/lib.sh"

say "jitsurei: migrate and run every demo scenario"
in_repo "$KEIRO_REPO" just jitsurei-all

if psql -h "$STACK_PG_SOCKET_DIR" -d "$STACK_PG_DATABASE" -Atc \
  "select 1 from pg_namespace where nspname = 'pgmq'" | grep -q 1; then
  say "note: jitsurei now carries a pgmq schema; the stack still reads pgmq from $STACK_PGMQ_DATABASE"
fi
