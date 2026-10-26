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

## Application connections

The bottom bar's Application selector groups deployments by environment. Selecting a different
application opens Overview and clears old entity filters, cursors and sheets. The Worker
selector identifies one logical worker replica within that app and opens the processor list.
Back/Forward restores the previous selection. A processor URL can include both parameters:
`/console/processors/detailed?target=prod-orders&worker=jobs-1`. Native Open Link in New Tab,
copied links and reloads preserve selection. Another tab's last-used setting cannot retarget
an explicit URL. An unknown target or worker never falls back to another app or process.

Settings → Connections shows read-only managed entries from the runtime catalog and editable
browser-local targets. Use New local target, edit the JSON fields, then Save target. Import
accepts v2 target exports and legacy v1 profiles; Export includes local targets only, without
credentials. Managed IDs cannot be overwritten. To recover invalid storage, Export its raw
value before Reset local connections. A managed target is shareable with any browser using
the same catalog; a local target missing in another browser shows unavailable.

| Field | Meaning |
| --- | --- |
| `id` | Stable target selection ID; never reuse for another deployment. |
| `label`, `app`, `environment` | Display label and application/environment identity. |
| `surfaces` | Optional `keiro`, `kiroku`, `pgmq`, `shibuya` HTTP(S) base URLs, with paths allowed. Root-relative paths use the page origin. |
| `workers` | Named entries with `id`, `label`, `shibuyaBaseUrl`; mutually exclusive with a direct Shibuya URL. |
| `defaultWorkerId` | Worker to choose when a URL does not specify one. Multiple workers without a default require selection. |
| `processManagerNames` | Configured names offered by the process-manager index. |
| `deadLetterQueueSuffix` | Dead-letter name suffix, default `_dlq`. |

The built-in Same origin target retains `/kiroku`, `/shibuya`, `/pgmq`, `/keiro` only when no
managed catalog is installed. Legacy profiles migrate to `keiro-ui.connection-targets.v2`
without altering their IDs or deleting v1. Legacy unscoped recent/pinned links remain in v1
storage for rollback; revisit and pin them within a selected app to recreate scoped entries.
Recent/sidebar links stay with their app; cross-app palette results show app and environment.
Actions display their originating app/environment and worker. Switching discards unsubmitted
confirmations; a submitted action remains on its original endpoint and reports to that tab's
attributed audit, even after switching. The audit is memory only and clears on reload.

Missing surfaces show “Not configured for this application” and send no requests. A configured
but unreachable surface shows connectivity failure instead. Only the selected app is polled.
For runtime loading, gateway policy and separate-origin CORS, see
[Deploying the console](deployment.md).
