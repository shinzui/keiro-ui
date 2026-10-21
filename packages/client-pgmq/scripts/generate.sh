#!/usr/bin/env bash
# Regenerates src/generated/schema.d.ts from openapi/pgmq-inspect.openapi.json.
# openapi-typescript needs TypeScript 5's compiler API, which the workspace's TypeScript 7
# (native) does not provide, so the generator runs from a throwaway install.
set -euo pipefail
cd "$(dirname "$0")/.."
tool="$(mktemp -d)"
trap 'rm -rf "$tool"' EXIT
(cd "$tool" && echo '{"private":true}' > package.json && bun add openapi-typescript@7.13.0 typescript@5.9.3 >/dev/null)
"$tool/node_modules/.bin/openapi-typescript" openapi/pgmq-inspect.openapi.json -o src/generated/schema.d.ts
