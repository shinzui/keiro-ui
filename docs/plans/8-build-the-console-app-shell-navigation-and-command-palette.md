---
id: 8
slug: build-the-console-app-shell-navigation-and-command-palette
title: "Build the console app shell, navigation, and command palette"
kind: exec-plan
created_at: 2026-10-21T14:52:33Z
master_plan: "docs/masterplans/2-build-the-keiro-runtime-console.md"
provenance:
  created_by:
    model: "claude-fable-5-1"
    harness: "claude-code"
    at: 2026-10-21T14:52:33Z
  revisions:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T15:56:48Z
      mode: "update"
      note: "Switch workspace tooling from pnpm to bun; vitest and Playwright kept on Node 22"
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      mode: "update"
      note: "Round 2: align to owning-plan spellings, correct audited upstream facts, e2e layout, light theme where applicable"
    - model: "claude-opus-5-5"
      harness: "claude-code"
      at: 2026-10-21T19:46:56Z
      mode: "implement"
      note: "Implemented M1-M5: shell layout, right sheet, palette and shortcuts, profiles/health/liveness, links/format and suites"
  reviews:
    - model: "claude-fable-5-1"
      harness: "claude-code"
      at: 2026-10-21T18:42:29Z
      verdict: "changes-requested"
      note: "Round 2 review against upstream trees and the owning plans; findings applied in the same pass"
---

# Build the console app shell, navigation, and command palette

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

The keiro runtime console (`docs/masterplans/2-build-the-keiro-runtime-console.md`) has
seven top-level sections and, underneath them, roughly twenty pages: stream browsers,
queue dashboards, workflow journals, aggregate state, timers, projection status. Before any
of those screens is built, an operator needs a frame to hold them: a way to move between
sections, a way to drill into an entity without losing the page they came from, a way to
jump anywhere by typing, and a place that always says which deployment they are looking
at and whether the numbers on screen are live.

This plan builds that frame. After it is complete, running `bun run dev` in this repository and
opening `http://localhost:5173` shows the console shell: a narrow left **rail** with one
icon per section, a **sidebar** listing the section's pages and recently visited entities
that collapses to icons with one keypress, a **bottom bar** showing the active connection
profile, a health dot per runtime surface, a pause/resume toggle for live updates, and the
app version, and a **right sheet** that any page can open to inspect an entity while the
URL records that it is open. Pressing ⌘K (Ctrl+K on Linux and Windows) opens a **command
palette** that navigates to any page, re-opens any recently visited entity, or parses a
typed identifier such as `workflow order-fulfillment/ord-42` into a jump. The pages
themselves are placeholders ("Coming in a later plan") — the point of this plan is that
every later screen plan drops its components into a finished, tested shell and inherits
navigation, links, formatting, and liveness for free.

Nothing in this plan talks to a runtime surface except two tiny probes (a health check per
surface and, later, the store head), and nothing here can mutate anything; see
[ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md).


## Progress

- [x] M1 — Shell layout: rail, collapsible sidebar, bottom bar, theme switching, and
  placeholder routes for every page in the MasterPlan's link map render at
  `http://localhost:5173`; sidebar state survives reload. (2026-10-21: `e2e/shell/layout.spec.ts`
  visits all 28 placeholder paths with no console error; collapse persists under
  `keiro-ui.sidebar.v1`.)
- [x] M2 — Right sheet: `registerSheet` / `useRightSheet` open a registered sheet kind, the
  URL gains `?sheet=<kind>:<ref>`, reloading restores the open sheet, Escape closes it.
  (2026-10-21: `e2e/shell/sheet.spec.ts` — About sheet via the palette, `sheet=about%3Aconsole`,
  reload restores, Escape clears, section change closes, `nonsense` explains itself.)
- [x] M3 — Command palette, recent-entity store, and keyboard shortcuts: ⌘K navigates to
  any page or recent entity and parses typed entity identifiers; `[`, `?`, and the `g`
  chords work; typing inside inputs never triggers them. (2026-10-21: `palette.spec.ts`,
  `shortcuts.spec.ts`; all twelve parsers unit-tested in `commands.test.ts`.)
- [x] M4 — Connection profiles, health probes, liveness toggle: the settings page creates and
  selects profiles, the bottom bar shows one health dot per surface for the active profile,
  pause/resume flips every polling query that reads `useLiveness()`. (2026-10-21:
  `connections.spec.ts` asserts the four same-origin probe URLs, the "Origin must not contain
  a path" rejection, and `waitForRequest("http://127.0.0.1:9095/health/live")` after selecting
  a separate profile; `liveness.test.tsx` proves a `refetchIntervalFor` query stops while
  paused and refetches once on resume.)
- [x] M5 — Link builders, formatting helpers, and the Playwright suite: every route in the
  link map has a typed builder; `format.ts` never emits "lag"; `bun run test` and
  `bun run test:e2e --project shell` pass. (2026-10-21: 115 vitest tests and 16 `shell`
  specs pass; `bun run check` and `bun run build` clean.)
- [ ] Integration check with plan 10: `liveness.tsx` becomes a re-export of the client core's
  `LivenessProvider`/`useLiveness` and the pause toggle stops a real `useSurfaceQuery` poll.
  Performed by docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md
  when it lands (the MasterPlan's second early producer/consumer check).


## Surprises & Discoveries

- 2026-10-21: TanStack Router's default search serializer JSON-parses every value, so
  `?from=9007199254740993` would arrive as a lossy number (and fail every `z.string()`
  search schema), and it writes the string `"41"` as `%2241%22`. The router now uses
  `apps/console/src/lib/search.ts`: scalar values stay exact strings; only values starting
  with `[` or `{` are JSON (e.g. `status_class=["running"]`). Every screen plan's search
  schemas therefore see positions and ids as decimal strings, as the link-map rule intends.
- 2026-10-21: React 19 treats a `ref` prop on a function component specially, so registered
  sheet components receive `{ entityRef, close }` (`SheetProps`), not `{ ref }`;
  `useRightSheet().open({ kind, ref })` is unchanged.
- 2026-10-21: React Aria links (`SidebarMenuButton href`) do full page loads unless wrapped in
  React Aria's `RouterProvider`. `packages/ui/src/components/router-provider.tsx` re-exports it
  (hand-written, so the console still never imports `react-aria-components`), and
  `__root.tsx` wires it to TanStack Router through `apps/console/src/lib/href.ts`, which
  splits internal hrefs into `{to, search}` so the router applies any base path.
- 2026-10-21: React Aria's `Autocomplete` keeps virtual focus on an item that is still
  visible after the query changes, so typing "subs" left focus on "Streams" (first after
  "s"). The palette ranks commands whose keywords or hint match ahead of label-only
  matches, remounts the list per query, and runs the first ranked visible command when
  Enter is pressed with nothing focused.
- 2026-10-21: the shadcn sidebar container is `position: fixed; left: 0`; with the 48 px
  rail beside it the container takes `md:left-12!`. The rail is in normal flow, so the
  sidebar's gap element still offsets the page correctly.
- 2026-10-21: bun's isolated installs do not expose `packages/ui`'s dependencies to the
  console, so `lucide-react` and `cn` are also direct dependencies of `@keiro-ui/console`
  (same pinned versions).
- 2026-10-21: keystrokes sent right after `page.goto` can arrive before the lazily split
  shell has attached its listeners; the e2e helpers `gotoShell` and `openPalette` in
  `apps/console/e2e/shell/fixtures.ts` wait for the page header and the focused search box.
  Health probes against unstarted surfaces log "Failed to load resource" console errors,
  which the console-error fixture ignores.


## Decision Log

- Decision: The right sheet is scoped to the current route. Its state is the `sheet` search
  parameter declared on the shell layout route; navigating to another page drops it unless
  the link explicitly carries it forward.
  Rationale: a sheet shows an entity in the context of the page that opened it; retaining it
  across sections would render, for example, an event inspector over the Queues list. The
  URL still records the open sheet, which is what makes it bookmarkable.
  Date: 2026-10-21

- Decision: This plan creates placeholder route files for every detail page in the
  MasterPlan's link map, not only the section indexes.
  Rationale: TanStack Router types `Link` targets from the route files that exist. Creating
  the full tree now means `src/lib/links.ts` is fully typed from day one, the command
  palette's parsed jumps land somewhere, and each later screen plan replaces a placeholder
  component instead of inventing a path.
  Date: 2026-10-21

- Decision: Health probes keep polling while live updates are paused.
  Rationale: the pause toggle exists so an operator can freeze the *data* they are reading;
  the bottom bar's health dots describe the console's own connectivity and are cheap. The
  "paused since" text makes the distinction visible.
  Date: 2026-10-21

- Decision: Liveness is consumed through `apps/console/src/shell/liveness.tsx`, which this
  plan implements locally and later turns into a re-export of `@keiro-ui/client-core`'s
  `LivenessProvider` and `useLiveness` without changing any consumer import; the health
  probe in `apps/console/src/shell/health.ts` stays shell-owned permanently.
  Rationale: the client core (`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`)
  may land after this plan; the shell must be verifiable alone, and screens must never
  depend on which of the two shipped first. The probe is a plain `fetch` plus one TanStack
  Query and needs nothing from the client core.
  Date: 2026-10-21

- Decision: The theme is light by default. `ThemeProvider` and `useTheme()` come from
  `apps/console/src/shell/theme.tsx`, created by plan 7; this plan adds only the palette
  action and passes the resolved theme to the `Toaster`.
  Rationale: user directive on 2026-10-21 (no dark mode by default; prioritize the light
  theme); one provider in one place.
  Date: 2026-10-21


- Decision: `apps/console/src/lib/links.ts` gains `links.timer(id)` (the timers page with
  `?sheet=timer:<id>`), so the `timer <id>` jump parser and the process-manager screens have
  a typed target for a single timer; every other builder is exactly as specified.
  Rationale: there is no timer detail route, and the timer inspector is a sheet
  (`registerSheet("timer", …)` in docs/plans/16-build-the-aggregates-process-managers-and-timers-screens.md).
  Date: 2026-10-21

- Decision: The command registry, recent/pinned stores, palette open state, and profile
  store are module-level `useSyncExternalStore` stores (`shell/local-store.ts` for the
  persisted ones), so `registerFeature` can register commands at module scope; there is no
  `CommandRegistryProvider`. `StatusSlotProvider`, `ConnectionProfileProvider`, and
  `LivenessProvider` remain providers in `__root.tsx`. Modules that render components use
  `.tsx` (`settings/connection-profiles.tsx`, `shell/shortcuts.tsx`); import paths are
  unchanged.
  Rationale: a context-held registry cannot receive module-scope registrations, which the
  `registerFeature` contract requires.
  Date: 2026-10-21

- Decision: The right sheet's width handle is a small pointer- and keyboard-driven
  separator in `shell/right-sheet.tsx`, not `@keiro-ui/ui/components/resizable`.
  Rationale: `react-resizable-panels` sizes panels inside a panel group; the sheet is a
  fixed modal, so a group would have to span the viewport behind the overlay. The handle
  clamps to 360 px – 60 vw and persists under `keiro-ui.sheet-width.v1` as specified.
  Date: 2026-10-21


## Outcomes & Retrospective

2026-10-21 — Milestones 1–5 complete. The console now runs inside the full shell: rail,
icon-collapsible sidebar with Pages/Pinned/Recent, bottom bar (profile switcher, four health
dots, page and store-head slots, liveness toggle, version, palette hint), URL-addressed right
sheet, ⌘K palette with pages, recents, twelve jump parsers, and actions, global shortcuts, the
Connections settings page with export/import, typed link builders, formatters, and
`registerFeature`. Evidence: `bun run check` clean; `bun run test` 115 passed; `bun run test:e2e`
17 passed (16 `shell`, 1 `smoke`); `bun run build` clean. The remaining item is the
integration check with plan 10, which that plan performs when the client core lands.

For screen plans: register sheets with components taking `{ entityRef, close }`; search
values arrive as strings (arrays as JSON); use `gotoShell`/`openPalette` from
`e2e/shell/fixtures.ts` in Playwright specs; `useStatusSlot` content should be memoized or
cheap, since it re-registers whenever its element identity changes.


## Context and Orientation

**What exists when this plan starts.** The workspace plan
(`docs/plans/7-scaffold-the-console-workspace-and-design-system.md`) must be Complete. It
provides a bun workspace with `apps/console` (a Vite 8 + React 19 + TypeScript 7
application using `@tanstack/router-plugin` for file-based routing, with
`src/routes/__root.tsx`, `src/router.tsx`, `src/main.tsx`, and a generated
`src/routeTree.gen.ts`), `packages/ui` (published as `@keiro-ui/ui`: the shadcn/ui
components generated on the React Aria base in the `aria-nova` style, Paper Mono declared
via `@font-face`, and the theme tokens in `src/styles/globals.css`), a Vite dev proxy that
forwards `/kiroku`, `/shibuya`, `/pgmq`, and `/keiro` to local ports 9091, 9090, 9095, and
9093 with the prefix stripped and WebSockets enabled, and the toolchain scripts `bun run dev`,
`bun run build`, `bun run check`, `bun run test` (vitest with jsdom and React Testing Library), and
`bun run test:e2e` (Playwright). If any of those is missing, stop and finish plan 7 first.

**Terms.** A *section* is one of the console's top-level areas (Overview, Aggregates,
Workflows, Process Managers & Timers, Projections & Read Models, Streams & Subscriptions,
Queues & Processors, Settings). A *surface* is one of the four runtime HTTP/WebSocket
servers the console reads: `kiroku` (the event store), `shibuya` (queue processors),
`pgmq` (queues), `keiro` (the framework: workflows, aggregates, timers, projections). A
*connection profile* is the console's record of where those four surfaces live. A *sheet*
is a panel that slides in from the right edge over the current page. *Liveness* is whether
the console is polling the surfaces for fresh data right now. A *pathless layout route* is a
TanStack Router route file whose name starts with `_`; it wraps its child routes in a
component without adding a URL segment. *Search parameters* are the `?key=value` part of
the URL; TanStack Router validates them with a schema per route and exposes them typed.

**The component library.** Every UI primitive comes from `@keiro-ui/ui/components/<name>`
(for example `@keiro-ui/ui/components/sidebar`, `.../sheet`, `.../command`, `.../dialog`,
`.../tooltip`, `.../kbd`, `.../button`, `.../separator`, `.../badge`, `.../dropdown-menu`,
`.../scroll-area`, `.../resizable`, `.../sonner`, `.../input`, `.../select`, `.../field`,
`.../switch`, `.../skeleton`). The console never imports `react-aria-components` directly.
If a primitive this plan needs is absent from `packages/ui/src/components/`, add it from
inside `packages/ui` with `bunx shadcn@latest add <name>` and commit the generated
file; that is the discipline recorded in
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md).
The shadcn `sidebar` component on the aria base exports `SidebarProvider`, `Sidebar`
(props `side`, `variant`, `collapsible: "offcanvas" | "icon" | "none"`), `SidebarTrigger`,
`SidebarRail`, `SidebarInset`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`,
`SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`,
and friends; the `sheet` component exports `Sheet`, `SheetTrigger`, `SheetHeader`,
`SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose` with a `side` prop; the
`command` component wraps React Aria's `Autocomplete` + `Menu` in a dialog as `Command`,
`CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`,
`CommandEmpty`, `CommandSeparator`, `CommandShortcut`.

**Architecture decisions that bind this plan.** [ADR-5](../adr/0005-no-backend-for-frontend.md):
the shell talks to the four surfaces directly through base URLs derived from the active
connection profile; there is no server in between. [ADR-3](../adr/0003-push-is-a-hint-poll-is-truth.md):
every live view polls; pushes only shorten latency. The pause/resume toggle this plan
builds is the user-visible half of that rule — "paused" means polling stops and the screen
is explicitly stale. [ADR-7](../adr/0007-read-only-first-with-owning-repository-gates.md):
the shell exposes no control that mutates a runtime; the only requests it makes are reads.
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md):
the import boundary described above. No cross-repository ADR is needed for the shell itself;
the surfaces' health routes used by the probes are documented in each owner's guide and
summarized in the MasterPlan's endpoint inventory.

**Coordination contracts this plan owns.** The MasterPlan's Integration Points name this
plan as the owner of the shell contracts, the cross-entity link builders, the formatting
helpers, and the vocabulary rules. Five screen plans (`docs/plans/13-...` through
`docs/plans/17-...`) and the actions plan (`docs/plans/19-add-gated-operator-actions.md`)
consume them, so the module names, exports, and behaviors specified in Plan of Work are
interfaces, not suggestions. The fixed surface prefixes and dev ports come from the
MasterPlan's "Local ports and the composed-prefix convention" and are repeated here so this
file stands alone:

```text
surface   prefix     dev port   health probe path        WebSocket path(s)
shibuya   /shibuya   9090       /shibuya/health/live     /shibuya/ws
kiroku    /kiroku    9091       /kiroku/health/live      /kiroku/ws/metrics, /kiroku/ws/events
pgmq      /pgmq      9095       /pgmq/health/live        /pgmq/ws
keiro     /keiro     9093       /keiro/health            /keiro/ws
```

keiro has no `/health/live`; its `GET /health` answers 200 with
`{"status":"ok","schema_drift":[],"mutations_enabled":false}`, 503 with
`{"status":"schema_drift","schema_drift":[...],"mutations_enabled":...}` when the live
schema drifts under the host's default refuse-on-drift policy, or 503
`{"status":"unavailable","message":...}` when the database is unreachable. The other three
answer `/health/live` with 200 `{"alive":true}` without touching the database.


## Plan of Work

The work proceeds in five milestones. Each one leaves the console runnable and adds a
behavior an operator can see.


### Milestone 1 — Shell layout, theme, and placeholder routes

At the end of this milestone the console has its four regions and every page in the link
map exists as a placeholder. Run `bun run dev` and open `http://localhost:5173`: the rail,
sidebar, bottom bar, and a page header are visible; clicking a rail icon changes the
section and the sidebar's entries; the sidebar collapses to icons with its own trigger and
stays collapsed after a reload; the theme is light by default and can be switched to dark
or set to follow the operating system.

**`apps/console/src/routes/__root.tsx`** becomes the provider stack. It is created with
`createRootRouteWithContext<{ queryClient: QueryClient }>()` so route loaders can reach
the query client, and renders, in this order: `QueryClientProvider` (the client comes from
`src/router.tsx`, where plan 7 created it; if plan 7 did not, create it in
`src/query-client.ts` with `defaultOptions.queries.retry` set to 1 and `staleTime` 0),
`ThemeProvider`, `ConnectionProfileProvider`, `LivenessProvider`, `CommandRegistryProvider`,
`StatusSlotProvider`, then `<Outlet />`, then the `Toaster` from `@keiro-ui/ui/components/sonner`
(given `theme={resolved}` from `useTheme()`), and `TanStackRouterDevtools` from
`@tanstack/react-router-devtools` only when `import.meta.env.DEV`. It also sets the
document `<title>` pattern "keiro console" through the route's `head` option and renders
`<HeadContent />` from `@tanstack/react-router` in its component — without that element the
`head` output is never written to the document.

**`apps/console/src/routes/_shell.tsx`** is the pathless layout route for every page except
nothing — all pages live under it; it exists as a separate route (rather than putting the
shell in `__root.tsx`) so that a future full-screen route can opt out. It declares the
shared search schema:

```typescript
import { z } from "zod"

export const shellSearchSchema = z.object({
  sheet: z.string().optional(),
})
export type ShellSearch = z.infer<typeof shellSearchSchema>
```

(exported from `apps/console/src/shell/search.ts` and passed as `validateSearch`), and
renders `AppShell` from `apps/console/src/shell/app-shell.tsx`. `AppShell` lays out:
`SidebarProvider` wrapping a horizontal flex of `<Rail />`, `<Sidebar collapsible="icon">`
(the shadcn sidebar) containing `<SectionSidebar />`, and `<SidebarInset>` holding the page
`<Outlet />` above `<StatusBar />`; `<RightSheetOutlet />` renders last so it overlays. The
sidebar open/closed state is persisted under the localStorage key `keiro-ui.sidebar.v1`
(`{"open": boolean}`) by passing `open`/`onOpenChange` to `SidebarProvider`; the
shadcn component's own cookie persistence is not used because the console is a static
bundle with no server to read cookies.

**`apps/console/src/shell/navigation.ts`** is the single description of sections and their
pages:

```typescript
import type { LucideIcon } from "lucide-react"

export type SectionId =
  | "overview" | "aggregates" | "workflows" | "process-managers"
  | "projections" | "streams" | "queues" | "settings"

export interface SidebarEntry {
  id: string
  title: string
  href: string          // a route path such as "/streams" or "/subscriptions"
  icon?: LucideIcon
}

export interface Section {
  id: SectionId
  title: string
  icon: LucideIcon
  href: string          // the rail target
  matchPrefixes: string[]  // pathnames that belong to this section
  pages: SidebarEntry[]
}

export const sections: readonly Section[]
export function sectionForPathname(pathname: string): Section
export function entityKindSection(kind: EntityKind): SectionId
```

The initial table: Overview (`/`, matches only `/`); Aggregates (`/aggregates`); Workflows
(`/workflows`); Process Managers & Timers (`/process-managers`, also matching `/timers`;
pages "Instances" `/process-managers` and "Timers" `/timers`); Projections & Read Models
(`/projections`, also `/shards`; pages "Status" and "Shards"); Streams & Subscriptions
(`/streams`, also `/categories`, `/events`, `/subscriptions`; pages "Streams", "Categories",
"All events" `/events`, "Subscriptions"); Queues & Processors (`/queues`, also `/processors`;
pages "Queues", "Processors"); Settings (`/settings`, page "Connections"
`/settings/connections`). The page table is complete here, because every page in the link
map already has a route file; screen plans add preset entries (for example a "Running"
filter under Workflows) and recents through `registerFeature`'s `navigation` field, never
by editing this file, and they do not restructure sections. Icons come from `lucide-react`
(already a dependency of `packages/ui`).

**`apps/console/src/shell/rail.tsx`** renders one `Tooltip`-wrapped icon button per section
in order, with Settings pinned to the bottom, each a TanStack `Link` with `activeProps` so
the current section is highlighted using `sectionForPathname`. The rail is 48 px wide,
never collapses, and is the only region that is always visible on narrow viewports
(below the `md` breakpoint the sidebar becomes the shadcn sidebar's mobile sheet).

**`apps/console/src/shell/section-sidebar.tsx`** renders, for the current section: a header
with the section title, a "Pages" group from `section.pages`, a "Recent" group from the
recent store filtered to this section (Milestone 3; empty until then), and a "Pinned"
group. Active page highlighting uses the pathname. When collapsed to icons, entries show
their icon with a tooltip.

**`apps/console/src/shell/status-bar.tsx`** renders the bottom bar as a 28 px strip with
fixed slots left to right: connection profile (name, clicking opens the profile switcher
dropdown — Milestone 4), one health dot per surface (Milestone 4; gray "unknown" until
then), a free `page` slot for screens, the `store-head` slot, the liveness toggle
(Milestone 4), the version (`__APP_VERSION__` and `__GIT_COMMIT__`, injected by Vite `define`
in `apps/console/vite.config.ts` — add them if plan 7 did not: version from
`package.json`, sha from `git rev-parse --short HEAD` with `"unknown"` as the fallback),
and a `⌘K` hint rendered with `Kbd`. Slots are filled through
`apps/console/src/shell/status-slots.tsx`:

```typescript
export type StatusSlotId = "page" | "store-head"
export function useStatusSlot(id: StatusSlotId, content: React.ReactNode): void
```

`useStatusSlot` registers the node on mount and clears it on unmount; a screen that knows
the kiroku store head (the Streams plan) calls `useStatusSlot("store-head", <StoreHead />)`.

**`apps/console/src/shell/theme.tsx`** already exists from plan 7 and is reused unchanged:
`ThemeProvider` and `useTheme()` returning
`{ theme: "light" | "dark" | "system", resolved: "light" | "dark", setTheme }`, defaulting
to `light` (the console does not follow the operating-system preference unless the operator
picks `system`), applying the `dark` class to `document.documentElement` only when
`resolved` is `dark` (the `.dark` custom variant in `packages/ui/src/styles/globals.css` is
what the tokens switch on), listening to `prefers-color-scheme` only while `theme` is
`system`, and persisting under `keiro-ui.theme.v1`. This plan adds the palette action
("Toggle theme", cycling light → dark → system) and nothing else to it.

**`apps/console/src/shell/features.ts`** exports `registerFeature(feature: { id: string; sheets?: Record<string, React.ComponentType<{ ref: string }>>; commands?: Command[]; navigation?: Partial<Record<SectionId, SidebarEntry[]>> })`, a thin aggregator over `registerSheet`, the command registry, and the navigation registry, plus `registerAllFeatures()` which `apps/console/src/features/index.ts` fills with one `register<Section>Feature()` call per screen plan (`registerStreamsFeature`, `registerQueuesFeature`, `registerWorkflowsFeature`, `registerAggregatesFeature`, `registerProjectionsFeature`). `__root.tsx` calls `registerAllFeatures()` once before rendering, so a screen plan adds one line to `features/index.ts` and never touches the shell.

**Placeholder routes.** Create every route file below under `apps/console/src/routes/_shell/`
so the generated route tree contains the full link map. Each file exports
`createFileRoute("<path>")({ component })` where the component renders `PageHeader` with
the page's title and an `EmptyState` saying which plan fills it (for example "Workflow
instances arrive with docs/plans/15-build-the-workflows-screens.md"). Detail routes also
`validateSearch` with `shellSearchSchema` extended by nothing yet. The files and paths:

```text
index.tsx                                      /
aggregates/index.tsx                           /aggregates
aggregates/$type/index.tsx                     /aggregates/$type
aggregates/$type/$id.tsx                       /aggregates/$type/$id
workflows/index.tsx                            /workflows
workflows/$name/$id.tsx                        /workflows/$name/$id
process-managers/index.tsx                     /process-managers
process-managers/$name/index.tsx               /process-managers/$name
process-managers/$name/$correlation.tsx        /process-managers/$name/$correlation
timers/index.tsx                               /timers
projections/index.tsx                          /projections
projections/$group.tsx                         /projections/$group
shards/index.tsx                               /shards
streams/index.tsx                              /streams
streams/$name.tsx                              /streams/$name
categories/index.tsx                           /categories
categories/$name.tsx                           /categories/$name
events/index.tsx                               /events
events/$id.tsx                                 /events/$id
subscriptions/index.tsx                        /subscriptions
subscriptions/$name.tsx                        /subscriptions/$name
queues/index.tsx                               /queues
queues/$name/index.tsx                         /queues/$name
queues/$name/messages/$id.tsx                  /queues/$name/messages/$id
queues/$name/archive/$id.tsx                   /queues/$name/archive/$id
processors/index.tsx                           /processors
processors/$id.tsx                             /processors/$id
settings/index.tsx                             /settings  (redirects to /settings/connections)
settings/connections.tsx                       /settings/connections
```

`apps/console/src/components/page-header.tsx` exports `PageHeader({ title, description?,
actions?, children? })` rendering an `h1`, optional description, and a right-aligned
actions area; `apps/console/src/components/empty-state.tsx` exports `EmptyState({ title,
description?, action? })`. Both use only `@keiro-ui/ui` primitives and Tailwind classes.

Acceptance for Milestone 1: with no runtime surface running, `bun run dev` serves the shell;
every path in the table above renders its placeholder without a console error; the
sidebar trigger collapses the sidebar to icons and the state persists across reload;
`bun run check` passes.


### Milestone 2 — The right sheet

At the end of this milestone a page can open a sheet by kind and reference, the URL
records it, and reloading the page re-opens it.

**`apps/console/src/shell/right-sheet.tsx`** exports:

```typescript
export interface SheetProps { ref: string; close: () => void }
export function registerSheet(kind: string, component: React.ComponentType<SheetProps>): void
export function useRightSheet(): {
  current: { kind: string; ref: string } | null
  open: (target: { kind: string; ref: string }) => void
  close: () => void
}
export function RightSheetOutlet(): React.JSX.Element | null
export function encodeSheet(target: { kind: string; ref: string }): string   // "kind:ref"
export function decodeSheet(value: string | undefined): { kind: string; ref: string } | null
```

`registerSheet` writes into a module-level `Map`; screens call it at module scope (for
example `registerSheet("event", EventSheet)` in the Streams plan). `encodeSheet` joins
kind and ref with the first colon; `decodeSheet` splits on the *first* colon only, because
refs such as `orders/42:7` may themselves contain colons, and returns `null` for empty or
colon-less values. `useRightSheet` reads `sheet` from the shell layout route's search
(`getRouteApi("/_shell").useSearch()`) and navigates with
`navigate({ to: ".", search: (prev) => ({ ...prev, sheet: encodeSheet(target) }) })` to
open and `sheet: undefined` to close, so browser back closes the sheet. `RightSheetOutlet`
renders a `Sheet` from `@keiro-ui/ui/components/sheet` with `side="right"`, open when
`current` is non-null and its kind is registered, containing the registered component; an
unregistered kind renders an inline message "No inspector registered for <kind>" and a
close button rather than nothing, so a stale bookmark is explained. The sheet's width is
draggable between 360 px and 60 vw with the handle from `@keiro-ui/ui/components/resizable`
and persisted under `keiro-ui.sheet-width.v1`. Escape and clicking the backdrop close it
(React Aria's modal handles both; wire `onOpenChange(false)` to `close`).

For verification, this milestone registers one shell-owned kind, `"about"`, whose
component shows the app version and the four configured surface URLs; the Playwright test
opens it through the palette command "About this console".

Acceptance: on any page, running `useRightSheet().open({ kind: "about", ref: "console" })`
(via the palette) slides in the sheet and the URL ends with `?sheet=about%3Aconsole`;
reloading that URL shows the sheet open; Escape closes it and removes the parameter;
navigating to another section closes it.


### Milestone 3 — Command palette, recent entities, keyboard shortcuts

At the end of this milestone ⌘K opens a palette that can reach every page and every
recently visited entity, and the global shortcuts work.

**`apps/console/src/shell/commands.ts`** exports:

```typescript
export type CommandGroup = "pages" | "recent" | "jump" | "actions"
export interface Command {
  id: string
  group: CommandGroup
  label: string
  hint?: string             // shown right-aligned, e.g. a path or shortcut
  keywords?: string[]
  run: (ctx: { navigate: NavigateFn; close: () => void }) => void
}
export function useRegisterCommands(commands: Command[]): void
export function useCommands(): Command[]
export interface JumpParser {
  prefix: string                      // "workflow", "stream", ...
  placeholder: string                 // "workflow <name>/<id>"
  parse: (rest: string) => { label: string; href: LinkTarget } | null
}
export const jumpParsers: readonly JumpParser[]
export function parseJump(input: string): { label: string; href: LinkTarget } | null
```

`useRegisterCommands` adds the commands to a context store on mount and removes them on
unmount, keyed by `id`; page-level commands therefore exist only while the page is mounted.
The shell itself registers: one `pages` command per entry in `navigation.ts` (label "Go to
<Section> › <Page>", hint the path); `actions` commands "Toggle theme", "Pause live
updates" / "Resume live updates" (label depends on state), "Switch connection profile…"
(opens a sub-list of profiles), "Open shortcuts help", and "About this console". The
`jumpParsers` table covers every entity kind in the link map, one parser per kind, using
`apps/console/src/lib/links.ts` from Milestone 5 (build the parsers against the builders;
Milestone 5 completes the builders): `workflow <name>/<id>`, `aggregate <type>/<id>`,
`pm <name>/<correlation>`, `timer <id>`, `projection <group>`, `stream <name>`,
`category <name>`, `event <uuid>`, `subscription <name>`, `queue <name>`,
`message <queue>/<id>`, `processor <id>`. `parseJump` splits the input on its first space,
matches the prefix case-insensitively, and delegates the remainder. These twelve parsers
are owned here because they need nothing but `links`; screen plans do not register parsed
commands of their own — each verifies the parser for its entity kinds in its end-to-end
suite and registers only static or preset commands.

**`apps/console/src/shell/recent.ts`** exports:

```typescript
export type EntityKind =
  | "workflow" | "aggregate" | "process-manager" | "timer" | "projection"
  | "stream" | "category" | "event" | "subscription" | "queue" | "queue-message" | "processor"
export interface Visit { kind: EntityKind; label: string; href: string; at: string }
export function useRecordVisit(visit: Omit<Visit, "at">): void
export function useRecent(filter?: { section?: SectionId; limit?: number }): Visit[]
export function usePinned(): { pinned: Visit[]; isPinned(href: string): boolean; toggle(visit: Omit<Visit, "at">): void }
```

Visits persist under `keiro-ui.recent.v1` (most recent first, de-duplicated by `href`,
capped at 50) and pins under `keiro-ui.pinned.v1`; the store is a tiny external store read
with `useSyncExternalStore` so every subscriber re-renders on change. Entity detail pages
call `useRecordVisit` once their entity is known. The sidebar's "Recent" group shows the
ten most recent visits whose kind maps to the current section
(`entityKindSection`), and the palette's `recent` group shows the twenty most recent
across sections.

**`apps/console/src/shell/command-palette.tsx`** renders `CommandDialog` from
`@keiro-ui/ui/components/command` with a `CommandInput` placeholder "Jump to a page,
entity, or type `workflow <name>/<id>`", and groups in the order Jump (only when
`parseJump` returns a match for the current input), Pages, Recent, Actions. React Aria's
`Autocomplete` provides filtering (`contains`, case-insensitive) over label and
keywords; the Jump item bypasses the filter by being computed from the raw input. Enter runs
the focused command and closes; the dialog is controlled by `useCommandPalette()` from the
same module (`{ open, setOpen, toggle }`).

**`apps/console/src/shell/shortcuts.ts`** exports `useGlobalShortcuts()` (mounted once in
`AppShell`) and `ShortcutsDialog`. Bindings: `Meta+K` or `Ctrl+K` toggles the palette;
`[` toggles the sidebar; `?` opens the shortcuts dialog; `Escape` closes the right sheet
when no dialog is open; the two-key chords `g o`, `g a`, `g w`, `g p`, `g r`, `g s`,
`g q` navigate to Overview, Aggregates, Workflows, Process Managers, Projections (read
models), Streams, Queues, with a 1.5 s window after `g`. The handler ignores events whose
target is an `input`, `textarea`, `select`, or `contenteditable` element, and events with
modifier keys other than the ones named, so typing never triggers a chord.

Acceptance: ⌘K opens the palette; typing "subs" and Enter navigates to `/subscriptions`;
typing `workflow billing/inv-7` shows "Open workflow billing / inv-7" and Enter lands on
`/workflows/billing/inv-7`; visiting that page (which calls `useRecordVisit` in its
placeholder for this milestone's test) adds it to Recent in both the sidebar's Workflows
section and the palette; `[` collapses the sidebar; `?` opens the shortcuts dialog; `g s`
goes to Streams; none of these fire while the palette's input is focused.


### Milestone 4 — Connection profiles, health probes, liveness

At the end of this milestone the console knows where its surfaces are, shows whether
each is reachable, and lets the operator freeze live updates.

**`apps/console/src/settings/connection-profiles.ts`** exports:

```typescript
export type Surface = "kiroku" | "shibuya" | "pgmq" | "keiro"
export const surfacePrefixes: Record<Surface, string>   // { kiroku: "/kiroku", shibuya: "/shibuya", pgmq: "/pgmq", keiro: "/keiro" }
export interface ConnectionProfile {
  id: string
  name: string
  mode: "same-origin" | "separate"
  origins: Record<Surface, string>   // same-origin: ignored; separate: "https://host:port" each
  processManagerNames?: string[]     // keiro exposes no process-manager name discovery; EP-16 reads this
  deadLetterQueueSuffix?: string     // default "_dlq"; EP-19 uses it to recognise dead-letter queues
}
export const connectionProfileSchema: z.ZodType<ConnectionProfile>
export function ConnectionProfileProvider(props: { children: React.ReactNode }): React.JSX.Element
export function useConnectionProfiles(): {
  profiles: ConnectionProfile[]; active: ConnectionProfile
  setActive(id: string): void; upsert(p: ConnectionProfile): void; remove(id: string): void
  exportJson(): string; importJson(json: string): { imported: number }
}
export function surfaceBaseUrl(profile: ConnectionProfile, surface: Surface, origin: string): string
export function useSurfaceBaseUrl(surface: Surface): string
export function useWebSocketUrl(surface: Surface, path: string): string
```

The built-in profile `{ id: "same-origin", name: "Same origin", mode: "same-origin" }` is
always first, cannot be removed, and resolves each surface to
`window.location.origin + surfacePrefixes[surface]` — which is exactly what the Vite dev
proxy and keiro's composed mount both serve. A `separate` profile validates each origin
with `connectionProfileSchema` as an absolute `http:` or `https:` URL with no path, query,
or fragment (the servers' own CORS validators reject anything else), and
`surfaceBaseUrl` returns the origin unchanged (the surface is mounted at its root in that
deployment). `useWebSocketUrl` takes the base URL, swaps `http` for `ws` and `https` for
`wss`, and appends `path` (`/ws`, `/ws/events`, ...). Custom profiles and the active id
persist under `keiro-ui.connection-profiles.v1` as `{ version: 1, activeId, profiles }`;
the built-in profile is never stored. `exportJson` returns that object pretty-printed;
`importJson` validates and merges by `id`.

**`apps/console/src/routes/_shell/settings/connections.tsx`** becomes the real settings
page: a list of profiles with the active one marked, a form (name, mode, and when
`separate` the four origin fields with inline validation messages from the schema), Save,
Delete (disabled for the built-in), "Use this profile", and Export / Import buttons using a
`<textarea>` for the JSON. The bottom bar's profile slot opens a dropdown listing profiles
with a "Manage…" link to this page.

**`apps/console/src/shell/health.ts`** exports:

```typescript
export type HealthStatus = "up" | "degraded" | "down" | "unknown"
export interface HealthProbe { surface: Surface; status: HealthStatus; httpStatus?: number; latencyMs?: number; checkedAt: string; body?: unknown }
export const healthProbePaths: Record<Surface, string>   // "/health/live" ×3, keiro "/health"
export async function probeHealth(surface: Surface, baseUrl: string, signal?: AbortSignal): Promise<HealthProbe>
export function useSurfaceHealth(surface: Surface): HealthProbe
```

`probeHealth` performs a single `fetch` with a 5 s timeout, treats 200 as `up`, a keiro 503
whose body says `"status":"schema_drift"` as `degraded`, any other non-200 response as
`down` with the status, and a network failure as `down` without one; it parses the JSON
body when present so keiro's `mutations_enabled` and `schema_drift` are available to the
actions plan later. `HealthStatus` is therefore `"up" | "degraded" | "down" | "unknown"`.
`useSurfaceHealth` is a TanStack Query with key `["shell", "health", surface, baseUrl]`,
`refetchInterval` 30 000 ms, and `refetchIntervalInBackground` false; it keeps polling while
liveness is paused (see Decision Log). The bottom bar renders one dot per surface — green
`up`, amber `degraded`, red `down`, gray `unknown` — with a tooltip
"kiroku · up · 12 ms · checked 3 s ago" and the probed URL.

**`apps/console/src/shell/liveness.tsx`** exports the liveness contract:

```typescript
export interface LivenessController {
  paused: boolean
  pausedSince: Date | null
  pause(): void
  resume(): void             // also refreshes everything immediately
  refreshAll(): Promise<void> // invalidates every surface's query-key prefix (["kiroku"], ["pgmq"], ...)
}
export function LivenessProvider(props: { children: React.ReactNode }): React.JSX.Element
export function useLiveness(): LivenessController
export function refetchIntervalFor(paused: boolean, defaultMs: number): number | false
```

This plan implements it as a React context over `useState` plus the query client.
`refetchIntervalFor` returns `false` when paused and `defaultMs` otherwise; every polling
query a screen writes passes `refetchInterval: refetchIntervalFor(paused, 5000)` (or the
adaptive interval once the client core exists). The bottom bar's toggle shows "Live" with a
pulsing dot or "Paused 02:14" (elapsed since `pausedSince`, updating each second); clicking
flips it; the palette's action does the same. **Stub-then-swap:** when
`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
ships `LivenessProvider` and `useLiveness` from `@keiro-ui/client-core` (its `useLiveness`
returns exactly `{paused, pausedSince, pause, resume, refreshAll}`), replace the body of
`liveness.tsx` with re-exports of those two names; consumers keep importing from
`@/shell/liveness`, and the Playwright tests below must still pass unchanged. `health.ts`
stays shell-owned permanently, and `refetchIntervalFor` remains a shell-local helper used
by the shell's own test query until screens poll through the client core's
`useSurfaceQuery`, which applies the pause itself. The `LivenessController` shape above is
therefore the contract the client core must honor; record any divergence in both plans'
Decision Logs.

Acceptance (with nothing running on the four ports): the bottom bar shows four red dots whose
tooltips name the probed URLs `http://localhost:5173/kiroku/health/live`, `.../shibuya/health/live`,
`.../pgmq/health/live`, `.../keiro/health`; starting only `pgmq-inspect` on port 9095 (see
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`; optional for this
plan) turns the pgmq dot green within 30 s; creating a `separate` profile with origin
`http://127.0.0.1:9095` for pgmq and selecting it changes the probed URL to
`http://127.0.0.1:9095/health/live` (visible in the tooltip and in the browser's network
panel); clicking "Live" switches to "Paused 00:00" and the `useSurfaceHealth` queries keep
refetching while a test query created with `refetchIntervalFor` stops.


### Milestone 5 — Link builders, formatting helpers, and the end-to-end suite

At the end of this milestone every cross-entity hyperlink in the console has one typed
origin, every timestamp, duration, count, and position distance is formatted by one
module, and the shell has a Playwright suite the later plans extend.

**`apps/console/src/lib/links.ts`** exports one builder per route in the link map, each
returning an object spreadable into `<Link>` and acceptable to `navigate()` (TanStack
Router's `LinkOptions` for the route):

```typescript
export const links = {
  overview: () => ({ to: "/" }),
  aggregates: () => ({ to: "/aggregates" }),
  aggregateType: (type: string) => ({ to: "/aggregates/$type", params: { type } }),
  aggregate: (type: string, id: string) => ({ to: "/aggregates/$type/$id", params: { type, id } }),
  workflows: (search?: { status_class?: string[]; workflow_name?: string }) => ({ to: "/workflows", search }),
  workflow: (name: string, id: string) => ({ to: "/workflows/$name/$id", params: { name, id } }),
  processManagers: () => ({ to: "/process-managers" }),
  processManager: (name: string) => ({ to: "/process-managers/$name", params: { name } }),
  processManagerInstance: (name: string, correlation: string) => ({ to: "/process-managers/$name/$correlation", params: { name, correlation } }),
  timers: (search?: { manager?: string; correlation?: string; tab?: "pending" | "stuck" }) => ({ to: "/timers", search }),
  projections: () => ({ to: "/projections" }),
  projection: (group: string) => ({ to: "/projections/$group", params: { group } }),
  shards: (search?: { subscription?: string }) => ({ to: "/shards", search }),
  streams: (search?: { category?: string; prefix?: string }) => ({ to: "/streams", search }),
  stream: (name: string) => ({ to: "/streams/$name", params: { name } }),
  streamEvents: (name: string, search?: { from?: string; direction?: "forward" | "backward" }) => ({ to: "/streams/$name", params: { name }, search }),
  categories: () => ({ to: "/categories" }),
  category: (name: string) => ({ to: "/categories/$name", params: { name } }),
  categoryEvents: (name: string, search?: { from?: string }) => ({ to: "/categories/$name", params: { name }, search }),
  allEvents: (search?: { from?: string; direction?: "forward" | "backward" }) => ({ to: "/events", search }),
  event: (id: string) => ({ to: "/events/$id", params: { id } }),
  subscriptions: () => ({ to: "/subscriptions" }),
  subscription: (name: string) => ({ to: "/subscriptions/$name", params: { name } }),
  queues: () => ({ to: "/queues" }),
  queue: (name: string, search?: { tab?: "messages" | "archive" | "bindings" }) => ({ to: "/queues/$name", params: { name }, search }),
  queueMessage: (queue: string, id: string) => ({ to: "/queues/$name/messages/$id", params: { name: queue, id } }),
  archivedMessage: (queue: string, id: string) => ({ to: "/queues/$name/archive/$id", params: { name: queue, id } }),
  processors: () => ({ to: "/processors" }),
  processor: (id: string) => ({ to: "/processors/$id", params: { id } }),
  settingsConnections: () => ({ to: "/settings/connections" }),
} as const
export type LinkTarget = ReturnType<(typeof links)[keyof typeof links]>
export function hrefOf(target: LinkTarget): string   // via router.buildLocation
```

Search-parameter shapes named here (`status_class`, `workflow_name`, `manager`,
`correlation`, `subscription`, `category`, `prefix`, `from`, `direction`, `tab`) are the
ones the screen plans will validate on their routes; this plan declares them as optional
strings on the placeholder routes so the builders typecheck now. The builders' argument
shapes are the contract: `links.workflow(name, id)` and the other entity builders take
positional strings, and search objects use the keys above (`correlation`, not
`correlation_id`). Positions and ids that are `bigint` on
the wire are passed to builders as their decimal string (`String(position)`), because URL
parameters are strings. The MasterPlan's link map is implemented by these builders as
follows: workflow → `links.allEvents({ from: String(globalPosition - 1n) })` and, when the
journal stream name is known, `links.stream(name)`; kiroku dead letter → `links.event(eventId)`
and `links.subscription(name)`; aggregate → `links.stream(streamName)` and
`links.category(category)`; process manager → `links.stream(journalStreamName)` and
`links.timers({ manager, correlation })`; timer → `links.processManagerInstance(manager, correlationId)`;
projection group → `links.subscription(subscriptionName)`; queue message and processor carry
no cross-surface link (the adapter's queue-context request is still proposed upstream), and
the Processors screen states "queue context unavailable".

**`apps/console/src/lib/format.ts`** exports:

```typescript
export function formatRelativeTime(iso: string | Date, now?: Date): string   // "3 s ago", "in 2 min", "yesterday"
export function formatDuration(seconds: number): string                      // "840 ms", "3.2 s", "4 min 12 s", "2 h 05 min"
export function formatTimestamp(iso: string | Date): { absolute: string; relative: string }  // absolute = ISO 8601 UTC
export function formatInt(value: bigint | number): string                     // thin-space (U+2009) grouping: "1 234 567"
export function formatBytes(bytes: number): string
export const POSITION_DISTANCE_LABEL = "global position distance"
export function formatPositionDistance(visibleStoreHead: bigint, position: bigint): { distance: bigint; text: string }
  // distance = head − position; text = "at visible store head" when 0, else "1 234 behind visible store head"
```

and `apps/console/src/components/timestamp.tsx` exports `<Timestamp value={iso} />`
showing the relative form with the absolute form in a tooltip and a `<time dateTime>`
element. The vocabulary rule from the MasterPlan is enforced by a unit test that reads
`format.ts` as text and asserts the words "lag" and "backlog" do not occur; keiro-facing
screens use `formatPositionDistance` and `POSITION_DISTANCE_LABEL` for every head-versus-
position difference.

**Tests.** Unit tests (vitest, under `apps/console/src/**/*.test.ts(x)`): `navigation`
(`sectionForPathname` for every placeholder path, `entityKindSection` for every kind);
`links` (every builder resolves through the router's `buildLocation` to the expected
pathname); `format` (fixed inputs → fixed outputs, the vocabulary assertion, `formatInt`
with `2n ** 63n - 1n`); `connection-profiles` (default profile base URLs, schema
rejections, persistence round-trip, `useWebSocketUrl` for http and https); `right-sheet`
(`encodeSheet`/`decodeSheet` including refs with colons); `commands` (`parseJump` for every
parser and for garbage). End-to-end tests (Playwright, under `apps/console/e2e/shell/`,
project name `shell`, run against `bun run dev` with no runtime surfaces): sidebar collapse
persists across reload; ⌘K navigation to Subscriptions; the About sheet opens, the URL
contains `sheet=`, reload restores it, Escape closes it; a new `separate` profile changes
the probed health URL (asserted with `page.waitForRequest`); `[`, `?`, and `g s` work and
do not fire while typing in the palette; pause/resume flips the bottom bar label.

Acceptance: `bun run test` and `bun run test:e2e --project shell` pass; `bun run check` passes;
`bun run build` produces `apps/console/dist` with no warnings about dynamic imports failing.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
stated otherwise.

1. Confirm the prerequisites from plan 7:

   ```bash
   bun install
   bun run check
   ls packages/ui/src/components
   ```

   Expect `bun run check` to end with no errors and the component directory to list at least
   `button.tsx sidebar.tsx sheet.tsx command.tsx dialog.tsx tooltip.tsx`. Add any missing
   primitive from inside `packages/ui`:

   ```bash
   cd packages/ui && bunx shadcn@latest add sidebar sheet command dialog tooltip kbd dropdown-menu scroll-area resizable sonner input select field switch skeleton badge separator
   ```

2. Milestone 1: write `apps/console/src/shell/{app-shell,rail,section-sidebar,status-bar,status-slots,theme,navigation,search}.ts(x)`,
   `apps/console/src/components/{page-header,empty-state}.tsx`, replace
   `apps/console/src/routes/__root.tsx`, add `apps/console/src/routes/_shell.tsx`, and create
   the placeholder route files listed in Plan of Work. Then:

   ```bash
   bun run --filter @keiro-ui/console generate-routes   # or rely on the Vite plugin while `bun run dev` runs
   bun run dev
   ```

   Open `http://localhost:5173`, click through every rail icon and sidebar entry, collapse
   the sidebar, reload. Expected: the shell renders, every placeholder shows its "Coming
   in plan N" text, the browser console is clean.

3. Milestone 2: write `apps/console/src/shell/right-sheet.tsx`, mount `RightSheetOutlet`
   in `AppShell`, register the `about` sheet, add the unit test for encode/decode. Verify in
   the browser as described in the milestone, then:

   ```bash
   bun run test -- right-sheet
   ```

4. Milestone 3: write `apps/console/src/shell/{commands,recent,command-palette,shortcuts}.ts(x)`
   and mount `CommandPalette`, `ShortcutsDialog`, and `useGlobalShortcuts` in `AppShell`.
   Have the `workflows/$name/$id.tsx` placeholder call `useRecordVisit` so Recent can be
   exercised before real screens exist. Run:

   ```bash
   bun run test -- commands recent
   ```

5. Milestone 4: write `apps/console/src/settings/connection-profiles.ts`,
   `apps/console/src/shell/{health,liveness}.ts(x)`, the settings page, and the bottom-bar
   wiring. Run `bun run dev`, open `http://localhost:5173/settings/connections`, create the
   profile described in the milestone's acceptance, select it, and watch the network panel.
   Optionally start a real surface to see a green dot (plan 9 documents the stack; the
   quickest single server is `pgmq-inspect --port 9095` against any pgmq database):

   ```bash
   bun run test -- connection-profiles health liveness
   ```

6. Milestone 5: write `apps/console/src/lib/{links,format}.ts`,
   `apps/console/src/components/timestamp.tsx`, the remaining unit tests, and
   `apps/console/e2e/shell/*.spec.ts`; register the `shell` project in
   `apps/console/playwright.config.ts` (`webServer` command `bun run dev --port 5173`, `baseURL`
   `http://localhost:5173`, `reuseExistingServer` outside CI). Run:

   ```bash
   bun run check
   bun run test
   bun run test:e2e --project shell
   bun run build
   ```

   Expected tail of the end-to-end run:

   ```text
   Running 7 tests using 1 worker
     7 passed (25s)
   ```

7. Commit at each milestone boundary with the trailers:

   ```text
   feat(console): add the shell layout, theme, and placeholder routes

   MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md
   ExecPlan: docs/plans/8-build-the-console-app-shell-navigation-and-command-palette.md
   ```


## Validation and Acceptance

The plan is complete when, from a clean checkout with plan 7 complete, the following all
hold.

**Layout and navigation.** `bun run dev` serves the shell at `http://localhost:5173`. The rail
shows eight icons (seven sections plus Settings at the bottom); the active one is
highlighted according to the pathname. The sidebar lists the active section's pages and
collapses to icons via its trigger or the `[` key; after a reload it is in the same state.
Every path in the Milestone 1 table renders a page header and a placeholder without a
console error. The console loads in the light theme regardless of the operating-system
preference; the theme toggle in the palette cycles light → dark → system, and the `dark`
class appears on `<html>` accordingly.

**Right sheet.** Running the "About this console" palette action opens the right sheet and
sets `?sheet=about%3Aconsole`; reloading restores it; Escape and the backdrop close it and
clear the parameter; a URL with `?sheet=nonsense%3Ax` opens a sheet that says no inspector
is registered for `nonsense`.

**Command palette and shortcuts.** ⌘K / Ctrl+K toggles the palette anywhere. Typing part of
a page title and pressing Enter navigates there. Typing `workflow billing/inv-7` offers a
jump that lands on `/workflows/billing/inv-7`; each of the twelve parsers in `jumpParsers`
has a unit test. After visiting an entity page the entity appears under Recent in the
palette and in the matching section's sidebar. `?` opens the shortcuts dialog listing every
binding; `g s` navigates to Streams. With the palette input focused, pressing `[` inserts
the character and does not collapse the sidebar.

**Profiles, health, liveness.** The built-in "Same origin" profile resolves
`useSurfaceBaseUrl("kiroku")` to `http://localhost:5173/kiroku` in development. The
settings page rejects an origin with a path ("Origin must not contain a path") and accepts
`http://127.0.0.1:9095`. Selecting a profile changes which URLs the health probes hit, as
seen in the network panel and in the dot tooltips. With no surface running all four dots
are red; with one surface running its dot is green within 30 s. Clicking "Live" shows
"Paused 00:00" counting up; a test query written with `refetchIntervalFor` stops
refetching while paused and refetches once on resume; the health probes keep going.

**Helpers and tests.** `bun run test` passes with the unit tests named in Milestone 5;
`bun run test:e2e --project shell` passes; `bun run check` and `bun run build` pass. The
vocabulary test proves `apps/console/src/lib/format.ts` contains neither "lag" nor
"backlog".

**Integration check with plan 10 (required once both plans exist).** After the client core
ships, `liveness.tsx` is a re-export of its `LivenessProvider` and `useLiveness`, the
bottom bar's pause toggle stops a real `useSurfaceQuery` poll and resume triggers an
immediate refetch, and the `shell` Playwright project still passes without modification. This is the second early producer/consumer check in the
MasterPlan's Integration Points.

**Not required by this plan (proposals for later).** A mobile layout beyond the shadcn
sidebar's built-in sheet; a "pin to sidebar" affordance on entity pages (the store supports
it; the Streams plan may add the first button); command-palette search over entity
*contents* (needs the clients).


## Idempotence and Recovery

Every step is additive and can be re-run. Regenerating the route tree is safe at any time
(`bun run --filter @keiro-ui/console generate-routes` or simply running `bun run dev`);
`src/routeTree.gen.ts` is generated and must stay excluded from lint and format (plan 7
configured `oxlint` and `oxfmt` ignores; if not, add `apps/console/src/routeTree.gen.ts` to
both). Adding a shadcn component twice is a no-op prompt to overwrite; answer no unless
you intend to reset local edits. All persisted state lives under localStorage keys
prefixed `keiro-ui.` and versioned `.v1`; a malformed value is ignored and replaced with the
default rather than thrown, so clearing site data is the universal reset. If a milestone's
tests fail after a partial edit, `git stash` the working tree and re-run `bun run check` on
the last commit to confirm the baseline before resuming.


## Interfaces and Dependencies

**Libraries whose choice matters.** `@tanstack/react-router` with `@tanstack/router-plugin`
(file-based routes, `validateSearch`, `createRootRouteWithContext`, `getRouteApi`,
`buildLocation`); `@tanstack/react-query` 5 (the shell's health queries and the liveness
contract's `invalidateQueries`); `zod` 4 (search schemas and the profile schema — no
TanStack adapter is needed for zod 4); `@keiro-ui/ui` (every primitive, per ADR-8);
`lucide-react` for icons; `sonner` through `@keiro-ui/ui/components/sonner` for toasts;
`@tanstack/react-router-devtools` in development only.
Versions are pinned by plan 7's workspace; do not add `cmdk`, `react-hotkeys-hook`, or a
state library — the palette is React Aria's `Autocomplete`, the shortcuts hook is thirty
lines, and the stores are `useSyncExternalStore` over localStorage.

**Interfaces this plan exports for other plans** (full paths under `apps/console/src/`):
`shell/navigation.ts` (`sections`, `sectionForPathname`, `entityKindSection`),
`shell/commands.ts` (`useRegisterCommands`, `jumpParsers`, `parseJump`),
`shell/recent.ts` (`useRecordVisit`, `useRecent`, `usePinned`),
`shell/right-sheet.tsx` (`registerSheet`, `useRightSheet`, `encodeSheet`, `decodeSheet`),
`shell/status-slots.tsx` (`useStatusSlot`), `shell/search.ts` (`shellSearchSchema`),
`shell/liveness.tsx` (`LivenessController`, `useLiveness`, `refetchIntervalFor`),
`shell/health.ts` (`probeHealth`, `useSurfaceHealth`, `healthProbePaths`),
`shell/theme.tsx` (from plan 7: `ThemeProvider`, `useTheme`),
`settings/connection-profiles.ts` (`Surface`, `surfacePrefixes`, `ConnectionProfile`,
`useConnectionProfiles`, `useSurfaceBaseUrl`, `useWebSocketUrl`), `lib/links.ts` (`links`,
`LinkTarget`, `hrefOf`), `lib/format.ts` (the formatters and `POSITION_DISTANCE_LABEL`),
`components/{page-header,empty-state,timestamp}.tsx`. Screen plans import these with the
`@/` alias and never duplicate them.

**Prerequisites.** Hard: `docs/plans/7-scaffold-the-console-workspace-and-design-system.md`
Complete (workspace, `@keiro-ui/ui`, Vite proxy, toolchain). Soft:
`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`
— this plan does not wait for it; when it ships, the stub-then-swap in Milestone 4 applies.
Optional for manual verification only: any single surface from
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md` running on its
fixed port.
