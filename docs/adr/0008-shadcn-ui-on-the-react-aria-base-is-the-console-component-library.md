---
type: Architecture Decision Record
title: shadcn/ui on the React Aria base is the console component library
description: The console's UI primitives are shadcn/ui components generated from its official React Aria base into the repository-owned packages/ui, which is the only module screens import primitives from; Paper Mono is the single typeface; the design-system adapter of ADR-6 is retired.
docId: ADR-8
status: Accepted
date: 2026-10-21
supersedes: [ADR-6]
generated:
  by: claude-code/claude-fable-5-1
  at: 2026-10-21T15:07:47Z
---

# shadcn/ui on the React Aria base is the console component library

## Context

[ADR-6](0006-design-system-adapter-defers-the-component-library-choice.md) kept the
component-library choice open between IntentUI and shadcn/ui by routing every screen import
through a repository-owned adapter package, so that the eventual choice would cost one
adapter implementation rather than a screen-by-screen migration. The "build the console"
initiative (`docs/masterplans/2-build-the-keiro-runtime-console.md`) now makes the choice,
on the owner's directive: shadcn/ui, with React Aria rather than Radix as the accessibility
primitive layer.

Two facts changed since ADR-6 was written. shadcn/ui 4.21 ships an official `aria` base —
every registry component has a React Aria Components implementation, including the
primitives the console shell needs (sidebar, sheet, a command palette built on React Aria's
`Autocomplete` and `Menu`, data table, resizable panels, toast via sonner, kbd) — so
"shadcn with React Aria" is a supported configuration, not a fork. And shadcn's model is
copy-owned source: the CLI generates component files into a package this repository owns
and edits. That package is already the single import boundary ADR-6's adapter was meant to
provide; an adapter over it would be a second abstraction with no decision left to defer.

The sibling console `mori://shinzui/keiro-runtime-kenshou-insights` already runs this
toolchain (shadcn `aria-vega` style, TanStack Router, Tailwind 4, Vite 8), so the choice
also keeps the keiro family's frontends on one stack.

## Decision

1. The console's UI primitives are shadcn/ui components generated from the official React
   Aria base into `packages/ui` (published name `@keiro-ui/ui`), using the `nova` style
   (`components.json` style `aria-nova`, chosen for its reduced padding, which suits a
   dense operations console). `react-aria-components` is a dependency of `packages/ui`
   alone.
2. Screens and the application shell import primitives only from
   `@keiro-ui/ui/components/<name>`. A screen that needs a primitive not yet present adds it
   with the shadcn CLI inside `packages/ui` and commits the generated source; it never
   imports `react-aria-components` or any other component library directly.
3. Paper Mono (SIL Open Font License 1.1, no Reserved Font Name) is the console's only
   typeface. The variable WOFF2 is vendored into `packages/ui` with its license text, declared
   once via `@font-face`, and both the sans and mono font tokens resolve to it.
4. The design-system adapter of ADR-6 is retired. `packages/ui` is the import boundary;
   there is no second abstraction over it.

## Consequences

The library decision is closed, and the cost of closing it is zero screens: no screen had
been written against the adapter. The discipline ADR-6 imposed — one import boundary, grown
on demand — survives as rule 2, enforced by the package boundary rather than by an interface
file. Library-specific affordances of React Aria Components (render props, collection
virtualization, the `Autocomplete` filtering model) are available to `packages/ui` and
surface to screens through generated components, which is cheaper than surfacing them
through an adapter. The price is that a future move away from shadcn or React Aria is a
migration of `packages/ui`'s generated source, not a one-file swap; that price is accepted
because the choice was made deliberately and the sibling console shares it. A single
monospaced typeface makes identifiers, positions, and JSON align everywhere at the cost of
denser prose; the console is an operator tool and the trade is intentional.
