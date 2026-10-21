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
