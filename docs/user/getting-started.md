---
type: Tutorial
title: Getting started with the keiro runtime console
description: Run the console against its recorded fixtures, then against a local stack of the four inspection servers.
docId: DOC-4
tags: [console, quickstart, local-stack, fixtures]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:30:00Z
---

# Getting started with the keiro runtime console

This walks you from a fresh checkout to the console reading live data. The first part needs
nothing but the repository; the second runs the four inspection servers locally.

## Before you start

Enter the dev shell with `nix develop` (or `direnv allow` with the bundled `.envrc`). It
provides bun, Node, Caddy, and process-compose. Without Nix, bun 1.4 and Node 22 on the path
are enough for the first part. Then install the workspace:

```bash
bun install
```

## Part 1: the console on recorded fixtures

The repository records real responses from each server in `packages/testing/fixtures/`.
`VITE_MOCK=1` serves them from a service worker inside the page, so no server is needed:

```bash
VITE_MOCK=1 bun run dev
```

Open http://localhost:5173. The Overview shows one card per concern, and the bottom bar has a
health dot for each of the four surfaces. Try:

1. Press `g` then `s` to open Streams, and open a stream's event; the event opens in a sheet
   on the right, and its URL survives a reload.
2. Press `⌘K` (`Ctrl+K`) and type a workflow or queue name to jump straight to it.
3. Press `?` for every keyboard shortcut.

Production builds never include the fixture worker; the flag only applies to `bun run dev`.

## Part 2: the console on a local stack

The local stack runs kiroku-inspect, pgmq-inspect, a shibuya consumer, and keiro-ops-http
against seeded PostgreSQL databases. It builds those executables from your own checkouts of
the owning repositories, so first tell it where they are:

```bash
cp dev/.env.example dev/.env   # then set the checkout paths
just stack-build               # build the four servers and link them into dev/bin/
just stack-seed                # seed keiro's demo scenarios and the pgmq demo queues
just stack-up                  # foreground; Ctrl-C or `just stack-down` stops it
```

In another terminal, confirm every surface answers, then start the console without the mock
flag:

```bash
just stack-check               # every probe and WebSocket upgrade prints `ok`
bun run dev
```

The Vite dev server proxies `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` to the servers, so
the console's default "Same origin" connection profile needs no configuration. A simulator
sends a small batch of orders every 30 seconds, so the Queues and Processors screens move on
their own.

If keiro reports `schema_drift` or a port is busy, the troubleshooting section of
`dev/README.md` covers both. `just stack-up mori` runs the same surfaces against a local mori
database for a busier, real application.

## Where next

- [Console reference](console-reference.md) lists every screen and what it needs from each
  server.
- [Deploying the console](deployment.md) serves a built bundle in front of real servers.
