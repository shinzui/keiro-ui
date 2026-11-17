---
timestamp: 2026-11-17T22:40:00Z
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
| Service Topology           | `/topology`, `/topology/<kind>/<name>`                         | keiro                    |
| Aggregates                 | `/aggregates`, `/aggregates/<type>`, `/aggregates/<type>/<id>` | keiro, kiroku            |
| Workflows                  | `/workflows`, `/workflows/<name>/<id>`                         | keiro, kiroku            |
| Process Managers & Timers  | `/process-managers`, `/process-managers/<name>/<correlation>`, `/timers` | keiro          |
| Projections & Read Models  | `/projections`, `/projections/<group>`, `/shards`              | keiro, kiroku            |
| Streams & Subscriptions    | `/streams`, `/categories`, `/events`, `/subscriptions` and their detail pages | kiroku, optional keiro metadata |
| Queues & Processors        | `/queues`, `/queues/<name>`, `/processors`, `/processors/<id>` | pgmq, shibuya, keiro     |
| Settings                   | `/settings/connections`                                        | none                     |

Notes on what each section shows when a server cannot answer fully:

- **Service Topology** needs a keiro host that mounts a service topology document. Without one
  the section says "This keiro host serves no service topology"; see
  [Service topology](#service-topology).
- **Aggregates** and **Process managers** need a keiro host that mounts its inspection hooks.
  Without them the page says "… inspection is not mounted on this keiro host" and names the
  probed path, instead of showing an error.
- **Aggregates**: an instance shows its registers when the state has them. **Read stored snapshot**
  shows what the snapshot holds beside current values. It is raw persisted data that can include fields
  the application's display omits, so it is read only when pressed and never refreshed by itself. Stored
  values are a cache and can be older; a difference is not an error.
- **Process managers**: the index lists what the host mounts, with each manager's category,
  snapshot configuration, and whether it has timers (`unknown` when keiro cannot say). A host that
  refuses that list, because it has no hooks or predates keiro 0.22, offers the names configured on
  the active connection profile, the ones opened recently, or a typed name.
- **Streams**: a single-stream read does not report global positions, so those rows say "not
  reported"; the event's own page has the real position.
- **Projections**: a group page shows the checkpoints of the subscription keiro says feeds it, with
  a choice when there are several, and the list has a Subscriptions column. Inline-only and unmanaged
  groups have none (`—`). A host that does not report this (`not reported`) offers the durable
  subscriptions kiroku knows, or a typed name.
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
| `processManagerNames` | Names offered by the process-manager index on a host that cannot list its managers. |
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

## Workflow totals and category declarations

Overview shows exact retained workflow totals for all seven statuses. Workflows shows the
same summary scoped only by its exact, case-sensitive workflow name, when selected. Status
and time filters, ordering, and pages affect the list independently. Counts include retained
terminal instance headers, poll every 15 seconds, respect pause/resume, and show the server's
observation time. Hosts without counts say so; errors expose their code and message. A failed
refresh can retain prior values with their original time and a stale notice.

On a category detail, **Declared consumers** shows matching mounted configuration from
Keiro, with projection and durable metadata coverage stated separately. Each declaration
shows every binding, delivery mode and source scope, linking available groups and named
subscriptions to their existing screens in the selected application. These declarations do
not report worker health or delivery progress. No matches in partial metadata is not proof
that no other consumers exist. Use **Refresh consumers** to fetch page one again; consumer
pagination is independent of event pages and live following and does not poll while idle.
A changed inventory or expired cursor restarts only the consumer panel. Missing Keiro
configuration, unavailable discovery routes and read failures leave events usable. A server
result-size refusal is an error, not a truncated inventory.

## Service topology

A keiro service can commit a document that describes how its declared parts connect, written
by `keiro-dsl topology` from the service's specification. A keiro host that mounts the
document (`--topology FILE`, or in code) serves it, and the Service Topology section shows it.
The document's contract is `mori://shinzui/keiro/okf/user-documentation/concepts/DOC-35`.

The section describes the committed specification the host mounted, not the running binary.
The host does not check that the two agree.

**The index, `/topology`.** A header names the service, the schema id, the source file or
workspace manifest, the generator and its version, the language version and runtime semantics
the specification is checked under, the document's digest (shortened; the copy control copies
the whole digest) and size, and the number of declarations and relations. Below it are the
member files with their digests and language versions; a member with no `language` line shows
`none` as its declared version.

Then every declaration, grouped by kind in a fixed order, each group with its count. A row
shows the declaration's name, its stable name when the kind has one (processes, routers and
workflows), its context, and where it is declared as `file:line`. The filter box matches names
and stable names, ignoring case. The kind chips narrow the list to one kind. Both are kept in
the URL (`q` and `kind`), so a filtered view can be shared. A filter that matches nothing says
so and offers to clear it; it never reads as a service with no declarations.

**A declaration, `/topology/<kind>/<name>`.** `<kind>` is the document's own kind name, such
as `aggregate`, `read-model` or `projection-owner`. The page shows:

- **Details**: every field the document carries for the declaration. A field with no value
  shows `none`. Fields the console does not recognise are shown as they are.
- **State machine**, for an aggregate: its states in declared order, marking the initial state
  and terminal states, and a table of transitions with source state, command, emitted events
  in order, target state, mode and edge index. A `replay only` transition serves no new
  commands and exists so past events still replay. The edge index is the transition's position
  among those leaving the same state; it changes when transitions are reordered. When the
  machine's ownership is `legacy-hole`, the transitions are declared but the hand-written
  implementation is not proven to match them, and the page says so. A document from an older
  keiro-dsl has no machine, and the page says that instead.
- **Relations**: outgoing and incoming, each naming the relation, the other declaration with a
  link to its page, and the relation's attributes. The other declaration's page shows the same
  relation from its side.
- **Read models fed**, for an aggregate: the read models its events reach, traced from the
  projection owners that consume the aggregate, through the targets they write, to the read
  models that observe or are backed by those targets. An owner that reads a whole category or
  every stream is not traced to one aggregate.

A name that is not in the mounted document shows "No such declaration in the mounted
document".

**When there is nothing to show**, the section says which of these applies:

| Shown | Meaning | What to do |
| --- | --- | --- |
| Keiro inspection is not configured for this deployment | The selected application has no keiro surface. No request is sent. | Configure keiro for the application. |
| This keiro host serves no service topology | The host mounts no document, or is older than the keiro release that added the route. The two answer identically. | Mount a committed document on the host, or upgrade it. |
| This console does not understand the mounted topology's schema | The document's schema id is not `keiro-dsl/service-topology/1` or `/2`. The document is not fetched. | Use a newer console. |
| The mounted topology was rejected | The document names a declaration kind or relation unknown to its schema id, repeats a declaration, or has a relation to a declaration that is not there. Nothing from it is shown; the reason is quoted. | Regenerate the committed document with `keiro-dsl topology`. |
| The host refused to send the topology: the result is too large | The document or its summary exceeds the host's response limit. | The host's operator raises `inspectionLimits.maxResponseBytes`. |
| The mounted topology is changing | Twice in a row the document received was not the one the host's summary described, which happens while a deployment rolls out. | Retry. |
| The service topology could not be read | Any other failure, with the server's code and message. | Retry. |

The console checks that the document it received is the one the host described, by hashing
the bytes received and comparing with the digest in the host's summary. It reads the summary
about once a minute, which is how it notices a redeploy, and fetches the document itself only
when the digest changes. If a later read fails without a definite answer, the document
verified earlier stays on screen under a notice that it may be out of date.
