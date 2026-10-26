#!/usr/bin/env bash
# Linux + Docker: bash scripts/benchmark-image.sh --output /tmp/image-benchmark
# Apple: APPLE_NIX_CONTAINER=<id> APPLE_NIX_EXCHANGE=<host-path-mounted-at-/exchange> bash scripts/benchmark-image.sh --output <report-dir>
set -euo pipefail
exec python3 "$(dirname "$0")/benchmark-image.py" "$@"
