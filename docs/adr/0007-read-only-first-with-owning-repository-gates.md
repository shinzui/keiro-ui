---
type: Architecture Decision Record
title: Read-only first, with owning-repository gates
description: The console ships without mutations; every mutation it ever offers rides an owning-repository endpoint that is itself gated, the UI renders gates and previews honestly, and payload visibility is an axis independent of action rights.
docId: ADR-7
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# Read-only first, with owning-repository gates

## Context

An operations console is judged by what it cannot be tricked into doing. The prior-art survey
(`docs/architecture/ui-prior-art-survey.md`) found a consistent consensus in the strongest
tools: the UI never does anything the public API cannot, gates live server-side so every
client inherits them (Restate's typed verbs, Temporal's write-gating), the strongest
deployments put policy in a host-owned seam (Oban's resolver), and payload visibility is
managed separately from action rights (Temporal's codec server, AxonIQ's dlq-mode).

The runtime repositories already have safety disciplines of their own: keiro-ops classifies
every command via `isMutation`, returns previews, and requires explicit force
(`mori://shinzui/keiro/okf/adrs/concepts/ADR-28` lineage); the improvement requests this
initiative filed extend those disciplines to HTTP —
`mori://shinzui/keiro/okf/improvement-requests/concepts/IR-26` (preview/confirm mutations,
disabled by default), `mori://shinzui/shibuya/okf/improvement-requests/concepts/IR-4` (gated
pause/resume), `mori://shinzui/shibuya-pgmq-adapter/okf/improvement-requests/concepts/IR-3`
(gated dead-letter redrive). A UI that bypassed or softened any of these would be the most
dangerous component in the stack.

## Decision

The console's first release is read-only. Thereafter:

1. Every mutation the console offers rides an owning-repository endpoint that is itself
   gated; the console adds honesty, never capability. A disabled server-side gate renders as
   a visibly disabled action with the reason — not a hidden feature, not a client-side
   workaround.
2. Preview-then-confirm flows are rendered faithfully: the preview is always shown before
   confirmation is offered, refusals (schema drift, gate off) are rendered as refusals, and
   anything replay-shaped follows the guardrail sequence — pause, typed confirmation stating
   irreversibility, explicit reset-point choice, live progress.
3. Destructive bulk operations are deferred until they can be first-class jobs with
   pre-flight impact estimates and progress, never fire-and-forget buttons.
4. Payload visibility is an axis independent of action rights: the client packages carry
   redaction/opt-in hooks at the render boundary, so a deployment can grant triage access
   without payload plaintext.

Who may act is the deployment's concern, per the conventions' recorded auth posture (trusted
network or authenticating reverse proxy); the console adds no authentication of its own.

## Consequences

The console is safe to point at production from day one, and stays exactly as dangerous as
the surfaces it fronts — no more. Mutation features land at the pace of the owning
repositories' gated endpoints, which is slower than a UI-side shortcut and deliberately so.
The redaction hooks cost a little client complexity before anyone demands them; retrofitting
payload privacy after payloads are rendered everywhere is the expensive order, so the seam is
built first. If per-action authorization ever lands in the surfaces, the resolver-style seam
extends this decision rather than replacing it.
