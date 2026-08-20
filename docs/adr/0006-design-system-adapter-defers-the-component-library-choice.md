---
type: Architecture Decision Record
title: A design-system adapter defers the component-library choice
description: Console screens import UI primitives only from a repository-owned adapter package, so the IntentUI-versus-shadcn/ui decision stays open and lands later as exactly one adapter implementation with no screen changes.
docId: ADR-6
status: Accepted
date: 2026-08-19
generated:
  by: human:nadeem
  at: 2026-08-19T00:00:00Z
---

# A design-system adapter defers the component-library choice

## Context

The component library for the keiro runtime console is deliberately undecided between
IntentUI and shadcn/ui — an explicit directive of the founding initiative
(`docs/masterplans/1-keiro-runtime-ui-foundations.md`), which excluded the choice from its
scope. Yet the UI direction (`docs/architecture/ui-direction.md`) must specify screens
concretely enough to plan a build. Specifying screens directly against either library would
make the "open" decision closed in practice: every screen import would be a migration cost
weighing on the eventual choice.

Both candidate libraries cover the primitives the screens need — tables, dialogs, form
controls, toasts, tabs, badges — and charting is a separate later choice regardless. The
variance between them is real but bounded, which is what makes an adapter honest rather than
a lowest-common-denominator trap.

## Decision

The workspace contains a repository-owned adapter package (`packages/ui-adapter`). Screens
import UI primitives exclusively from the adapter's own interface — never from a component
library directly. The adapter's interface is defined by what the screens actually need, kept
small, and grown only on demand. When the component-library decision is made — outside this
initiative — the adapter gains exactly one implementation, and no screen changes.

## Consequences

The library decision stays genuinely open: its cost is one adapter implementation, not a
screen-by-screen migration. Screens are specifiable and buildable now against the adapter
interface. The discipline has a price — every new primitive passes through the adapter, and
library-specific affordances are unavailable until deliberately surfaced through it; that
price is accepted as the cost of keeping an explicitly reserved decision reserved. The
adapter is not a commitment to support multiple libraries simultaneously: one implementation
at a time is the model, and the abstraction may be thinned once the choice is stable.
