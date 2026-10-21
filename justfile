# Task runner for the keiro runtime console workspace.
# Tools (bun, node, oxlint, oxfmt, tsc, caddy) are provided by the Nix dev shell.

# List available recipes
default:
    @just --list

# Install workspace dependencies with bun
install:
    bun install

# Start the console dev server on http://localhost:5173 (proxies the four surfaces)
dev:
    bun run dev

# Build the console for production into apps/console/dist
build:
    bun run build

# Type-check every workspace package
typecheck:
    bun run typecheck

# Lint sources with oxlint
lint:
    bun run lint

# Lint and auto-fix where possible
lint-fix:
    bun run lint:fix

# Format sources in place
format:
    bun run format

# Verify formatting without writing (CI mode)
format-check:
    bun run format:check

# Run all checks: typecheck, lint, and formatting
check:
    bun run check

# Run the vitest suites (always through bun run: a bare `bun test` starts bun's own runner)
test:
    bun run test

# Run the Playwright end-to-end suites against a production build
test-e2e:
    bun run test:e2e

# --- Local runtime stack (dev/README.md) ---

# Start keiro's and pgmq-hs's socket-only dev PostgreSQL clusters
stack-db-up:
    bash dev/db-up.sh

# Seed jitsurei (keiro's demo scenarios) and the pgmq demo queues
stack-seed: stack-db-up
    bash dev/seed.sh

# Build the inspection executables in their checkouts and link them into dev/bin
stack-build target="all":
    bash dev/build.sh {{target}}

# Run all four surfaces under process-compose (foreground; Ctrl-C stops them).
# `just stack-up mori` points them at the mori dev database and runs mori's daemon.
stack-up profile="jitsurei": stack-db-up
    mkdir -p .dev
    if [ "{{profile}}" = "mori" ]; then \
      bash dev/mori.sh db-up && \
      process-compose --unix-socket .dev/process-compose.sock up --tui=false \
        -f dev/process-compose.yaml -f dev/process-compose.mori.yaml -e dev/.env -e dev/profiles/mori.env; \
    else \
      process-compose --unix-socket .dev/process-compose.sock up --tui=false -f dev/process-compose.yaml -e dev/.env; \
    fi

# Seed the mori profile: mori's fixture repositories, registered and ingested
stack-seed-mori:
    bash dev/mori.sh db-up
    bash dev/mori.sh seed

# Push one change through mori's automations (signals, reactions, timers, job queues)
stack-drive-mori:
    bash dev/mori.sh drive

# Stop a stack started by stack-up from another terminal
stack-down:
    process-compose --unix-socket .dev/process-compose.sock down || true

# Probe every surface over HTTP and attempt every WebSocket upgrade
stack-check profile="jitsurei":
    bash dev/check.sh {{profile}}

# Build the console for a base path (default /).
build-console base="/":
    VITE_BASE_PATH={{base}} bun run build

# Pack the release tarball into release/ (VITE_BASE_PATH selects the base path).
release-pack:
    bun run release:pack

# The production smoke: build for /console/, serve with dev/caddy/Caddyfile, run both tiers.
smoke-production port="8080":
    CONSOLE_PORT={{port}} bun run test:e2e:production
