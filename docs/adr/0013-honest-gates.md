---
type: Architecture Decision Record
title: Honest gates
description: The console renders every server-side gate as the server states it — a closed gate is a disabled control with the server's reason, a missing capability is named, a keiro mutation is previewed before any confirmation exists, and refusals are shown verbatim with an unknown outcome forcing a re-read.
docId: ADR-13
status: Accepted
date: 2026-10-21
timestamp: 2026-11-04T20:00:00Z
generated:
  by: claude-code/claude-opus-5-5
  at: 2026-10-21T23:00:00Z
---

# Honest gates

## Context

[ADR-7](0007-read-only-first-with-owning-repository-gates.md) admits mutations only behind
owning-repository gates and requires the UI to render gates and previews honestly. The console
now has three actions (shibuya processor pause/resume; keiro timer requeue/cancel and
dead-letter redrive) and several read capabilities that exist only on some hosts (keiro's
aggregate and process-manager reads; shibuya's `/control`). Each can be closed, absent, or
refused in ways an operator must be able to tell apart.

## Decision

1. **A closed gate is a disabled control plus the server's reason**, never a hidden one: shibuya
   `enableControl = False` and keiro without `--enable-mutations` (or under schema drift) render
   the actions disabled with that sentence. A capability the host does not mount is named as
   such ("… is not mounted on this keiro host", "this shibuya host has no control surface"),
   never shown as an error or an empty list.
2. **A keiro preview renders before any confirmation control exists.** The preview's own
   headline (a timer's disposition, a redrive's counts) comes first; a no-change preview never
   offers Execute; otherwise Execute needs the target typed exactly.
3. **Refusals render verbatim**: the server's message, its code, and the context its envelope
   carried (ADR-11). `mutation_outcome_unknown` re-reads the target and locks Execute until the
   operator starts again.
4. **Server rules are documented, not worked around.** shibuya refuses a control POST whose
   `Origin` is not in `corsAllowedOrigins`, even on one origin; the console sends the browser's
   request unchanged and `docs/deployment.md` says to list the console's origin.
5. **Absence is not a fact about the application.** One console can face hosts at different
   versions ([ADR-15](0015-target-identity-and-disposable-connection-sessions.md)), so a field an
   older host omits, or a route it refuses, is a missing capability. It is never rendered as an
   empty or negative fact. keiro's `feeding_subscriptions` absent means "this host does not report
   it", and empty means "none recorded". `timers_configured: null` reads "unknown", not "no". When a
   refusal cannot tell the causes apart, as `/pm/types` cannot between an older host and one with no
   hooks, the sentence claims neither. Such a sentence must not name a release unless one is known.

## Consequences

- An operator can always tell "not allowed here", "not available on this host", and "the server
  refused" apart, and sees what keiro would do before being able to do it.
- Every new action reuses `MutationFlow`, `useKeiroMutationsGate`, and `RefusalView`, and adds its
  refusal codes to the matrix tests.
