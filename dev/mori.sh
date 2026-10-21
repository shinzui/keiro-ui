#!/usr/bin/env bash
# The mori profile's database and seed, run inside mori's own Nix dev shell.
#   bash dev/mori.sh db-up   start mori's socket-only PostgreSQL 18, create and migrate `mori`
#   bash dev/mori.sh seed    bootstrap mori's fixture repositories, register and ingest them
#   bash dev/mori.sh drive   commit a version bump in mori-test-source and ingest it (signals,
#                            reactions, timers, and job queues run in the daemon)
. "$(dirname "$0")/lib.sh"
. "$STACK_ROOT/dev/profiles/mori.env"

MORI_BIN() { in_repo "$MORI_REPO" cabal list-bin -v0 exe:mori | tail -n 1; }

case "${1:-}" in
  db-up)
    in_repo "$MORI_REPO" bash -c '
      set -euo pipefail
      mkdir -p "$PGHOST"
      [ -d "$PGDATA" ] || initdb --auth=trust --no-locale --encoding=UTF8 >/dev/null
      pg_ctl status -D "$PGDATA" >/dev/null 2>&1 ||
        pg_ctl start -w -D "$PGDATA" -l "$PGLOG" \
          -o "--unix_socket_directories='"'"'$PGHOST'"'"'" -o "-c listen_addresses='"''"'"
      just create-database
      just migrate up
    '
    ;;
  seed)
    in_repo "$MORI_REPO" bash -c '
      set -euo pipefail
      just bootstrap-test-repos
      cabal build -v0 exe:mori
      mori_bin="$(cabal list-bin -v0 exe:mori)"
      for repo in source target target-broken; do
        "$mori_bin" automate register --path "../mori-test-$repo"
        "$mori_bin" automate ingest git --path "../mori-test-$repo"
      done
    '
    ;;
  drive)
    bin="$(MORI_BIN)"
    source_repo="$(dirname "$MORI_REPO")/mori-test-source"
    version="0.$(date +%s)"
    sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$version\"/" "$source_repo/openapi.json"
    rm -f "$source_repo/openapi.json.bak"
    git -C "$source_repo" commit -qam "test: emit schema-ready for $version"
    in_repo "$MORI_REPO" "$bin" automate ingest git --path "$source_repo"
    ;;
  *)
    echo "usage: dev/mori.sh db-up|seed|drive" >&2
    exit 2
    ;;
esac
