#!/usr/bin/env bash
# Build the inspection executables in their own checkouts (inside each repository's Nix dev
# shell) and link them into dev/bin. Re-running relinks; cabal skips up-to-date targets.
. "$(dirname "$0")/lib.sh"

mkdir -p "$STACK_ROOT/dev/bin"

build_and_link() {
  local repo="$1" target="$2" name="$3"
  say "build $name ($repo)"
  in_repo "$repo" cabal build "$target"
  local bin
  bin="$(in_repo "$repo" cabal list-bin "$target" | tail -n 1)"
  ln -sf "$bin" "$STACK_ROOT/dev/bin/$name"
  say "  -> dev/bin/$name"
}

only="${1:-all}"
case "$only" in all | kiroku) build_and_link "$KIROKU_REPO" exe:kiroku-inspect kiroku-inspect ;; esac
case "$only" in all | pgmq) build_and_link "$PGMQ_HS_REPO" pgmq-inspect:exe:pgmq-inspect pgmq-inspect ;; esac
case "$only" in all | keiro) build_and_link "$KEIRO_REPO" exe:keiro-ops-http keiro-ops-http ;; esac
case "$only" in
  all | shibuya)
    build_and_link "$SHIBUYA_PGMQ_ADAPTER_REPO" exe:shibuya-pgmq-consumer shibuya-pgmq-consumer
    build_and_link "$SHIBUYA_PGMQ_ADAPTER_REPO" exe:shibuya-pgmq-simulator shibuya-pgmq-simulator
    ;;
esac
