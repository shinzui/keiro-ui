---
type: Reference
title: Console reference
description: Every section of the keiro runtime console with its URLs and the surfaces it reads, plus keyboard shortcuts and connection-profile fields.
docId: DOC-2
tags: [console, screens, routes, shortcuts, connection-profiles]
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:30:00Z
---

# Console reference

## Sections

Every route is relative to the base path the bundle was built for. List screens keep their
filters, sort, and tabs in the URL, so a link reopens the same view.

| Section                    | Routes                                                         | Surfaces read            |
| -------------------------- | -------------------------------------------------------------- | ------------------------ |
| Overview                   | `/`                                                            | all four                 |
| Aggregates                 | `/aggregates`, `/aggregates/<type>`, `/aggregates/<type>/<id>` | keiro, kiroku            |
| Workflows                  | `/workflows`, `/workflows/<name>/<id>`                         | keiro, kiroku            |
| Process Managers & Timers  | `/process-managers`, `/process-managers/<name>/<correlation>`, `/timers` | keiro          |
| Projections & Read Models  | `/projections`, `/projections/<group>`, `/shards`              | keiro, kiroku            |
| Streams & Subscriptions    | `/streams`, `/categories`, `/events`, `/subscriptions` and their detail pages | kiroku    |
| Queues & Processors        | `/queues`, `/queues/<name>`, `/processors`, `/processors/<id>` | pgmq, shibuya, keiro     |
| Settings                   | `/settings/connections`                                        | none                     |

Notes on what each section shows when a server cannot answer fully:

- **Aggregates** and **Process managers** need a keiro host that mounts its inspection hooks.
  Without them the page says "… inspection is not mounted on this keiro host" and names the
  probed path, instead of showing an error.
- **Process managers** have no discovery read in keiro. The index offers the names configured
  on the active connection profile, the ones opened recently, or a typed name.
- **Streams**: a single-stream read does not report global positions, so those rows say "not
  reported"; the event's own page has the real position.
- **Projections**: keiro does not say which subscription feeds a projection group, so a group
  page offers kiroku's durable subscriptions as choices and never assumes the mapping.
- **Queues**: messages and the archive are peeked, never leased. The dead-letter panel reads
  payloads written by shibuya-pgmq-adapter. A dead-letter queue is redriven through keiro, so
  redrive needs a keiro host that allows mutations.

## Operator actions

Pause and resume a processor (shibuya's `enableControl`), requeue or cancel a timer, and redrive
a dead-letter queue (keiro-ops-http's `--enable-mutations`). Each is off unless its server's gate
is open; a closed gate shows the action disabled with the server's reason. keiro actions preview
first and execute only after you type the target. Executed actions are listed in the session
audit ("N actions this session" in the bottom bar), held in this browser tab only. The host
settings are in [Deploying the console](deployment.md#operator-actions).

## Keyboard shortcuts

| Keys            | Action                                  |
| --------------- | --------------------------------------- |
| `⌘K` / `Ctrl+K` | Open the command palette                |
| `[`             | Toggle the sidebar                      |
| `?`             | Show the shortcut help                  |
| `Esc`           | Close the inspector sheet               |
| `g` then `o`    | Go to Overview                          |
| `g` then `a`    | Go to Aggregates                        |
| `g` then `w`    | Go to Workflows                         |
| `g` then `p`    | Go to Process Managers                  |
| `g` then `r`    | Go to Projections (read models)         |
| `g` then `s`    | Go to Streams                           |
| `g` then `q`    | Go to Queues                            |

Apart from `⌘K`, shortcuts do not fire while you type in the palette or a form field, or while
a dialog is open. The palette also jumps to
an entity by its identifier, switches connection profile, and cycles the theme.

## Connection profiles

Settings → Connections holds the profiles, stored in this browser. The default "Same origin"
profile reaches each surface at its absolute prefix on the page's own origin.

| Field                   | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Name                    | Shown in the bottom bar and the palette.                                                 |
| Mode                    | "Same origin" (`/kiroku`, `/shibuya`, `/pgmq`, `/keiro` on this origin) or "Separate origins". |
| `<surface>` origin      | Separate origins only: `http(s)://host:port`, with no path, query, fragment, or credentials. |
| Dead-letter queue suffix | How dead-letter queues are recognised by name; default `_dlq`.                          |
| Process manager names   | One per line; the Process managers index offers these.                                   |

With separate origins, every server must list the console's origin; the settings for each
server are in [Deploying the console](deployment.md#recipe-c--separate-origins).
