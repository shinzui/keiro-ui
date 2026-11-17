#!/usr/bin/env bash
# Writes mori's own service topology to .dev/mori.topology.json for the mori profile's keiro
# host to mount (dev/process-compose.mori.yaml). The document is generated from mori's
# specification workspace by keiro's keiro-dsl, built by `just stack-build keiro`. Nothing is
# written into the mori checkout, and the generated file is git-ignored.
#
# A failure leaves no document: the host then starts without --topology and the console says
# it serves none. The diagnostic is printed here.
. "$(dirname "$0")/lib.sh"
. "$STACK_ROOT/dev/profiles/mori.env"

out="$STACK_ROOT/.dev/mori.topology.json"
workspace="$MORI_REPO/domain/mori.keiro-workspace"
mkdir -p "$STACK_ROOT/.dev"
rm -f "$out"

if [ ! -x "$STACK_ROOT/dev/bin/keiro-dsl" ]; then
  say "mori topology: dev/bin/keiro-dsl is missing; run \`just stack-build keiro\`"
  exit 1
fi
if [ ! -f "$workspace" ]; then
  say "mori topology: $workspace not found; check MORI_REPO in dev/profiles/mori.env"
  exit 1
fi
if "$STACK_ROOT/dev/bin/keiro-dsl" topology "$workspace" --format json >"$out.tmp"; then
  mv "$out.tmp" "$out"
  say "mori topology: wrote .dev/mori.topology.json ($(wc -c <"$out" | tr -d ' ') bytes)"
else
  rm -f "$out.tmp"
  say "mori topology: keiro-dsl refused the specification (diagnostics above)"
  exit 1
fi
