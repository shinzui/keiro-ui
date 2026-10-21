---
id: 7
slug: scaffold-the-console-workspace-and-design-system
title: "Scaffold the console workspace and design system"
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
---

# Scaffold the console workspace and design system

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.
If durable project context changes, update or create ADRs in docs/adr/ in the same change.


## Purpose / Big Picture

This repository holds the plans, conventions, and decisions for the keiro runtime console
but no application code. After this plan, it holds a working bun workspace: a React
application in `apps/console` that starts with `bun run dev`, a repository-owned component
package in `packages/ui` built from shadcn/ui's React Aria base, the Paper Mono typeface
vendored and declared once, light and dark theme tokens, and the toolchain every later plan
assumes (TypeScript, oxlint, oxfmt, vitest, Playwright, a `justfile`, and a Nix flake whose
dev shell also provides `caddy`, which docs/plans/18-package-the-console-for-deployment.md
uses for the composed-origin smoke test).

You can see it working by cloning the repository, running `bun install`, then
`bun run check && bun run test && bun run build && bun run test:e2e`, and seeing all four succeed.
Running `bun run dev` and opening `http://localhost:5173` shows a placeholder page set in
Paper Mono with a working dark-mode toggle, a shadcn Button, and a Sheet that slides in from
the right. The Vite development server also proxies `/kiroku`, `/shibuya`, `/pgmq`, and
`/keiro` to the four inspection servers on ports 9091, 9090, 9092, and 9093, which is how
every screen built later talks to the runtime without any CORS configuration.

No screen, client, or shell navigation is built here. Those belong to the plans listed in
the parent MasterPlan, `docs/masterplans/2-build-the-keiro-runtime-console.md`; this plan
exists so that each of them adds code, not configuration.


## Progress

- [ ] M1 — Workspace and toolchain: root `package.json` with `workspaces`, shared
  `tsconfig.base.json`, oxlint and oxfmt configuration, vitest and Playwright wiring, and
  the empty-but-wired `packages/client-core` and `packages/testing` manifests exist;
  `bun install` and `bun run check` succeed on a tree with no application code yet.
- [ ] M2 — Design system package: `packages/ui` (`@keiro-ui/ui`) is generated from the
  shadcn React Aria base with the `aria-nova` style, ships the initial component set, the
  vendored Paper Mono variable font with its OFL licence, and the light/dark oklch tokens;
  `bun run test` renders the Button component through vitest and passes.
- [ ] M3 — Console application skeleton: `apps/console` builds with Vite 8, the TanStack
  Router file-based plugin, Tailwind 4, and the four-surface dev proxy; `bun run dev` serves
  the placeholder page in Paper Mono with a dark-mode toggle, a Button, and a Sheet; the
  Playwright smoke test passes against `vite preview`.
- [ ] M4 — Developer entry points: `justfile`, Nix flake dev shell, `.gitignore`
  additions, and a README quickstart exist; `nix develop -c bun run check` succeeds.


## Surprises & Discoveries

(None yet.)


## Decision Log

- Decision: The component package is generated from shadcn/ui's official React Aria base
  with the Nova style (`components.json` style `aria-nova`), and screens import UI
  primitives only from `@keiro-ui/ui`; `react-aria-components` is a dependency of
  `packages/ui` alone.
  Rationale: Fixed by the parent MasterPlan and recorded in
  `docs/adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md`.
  Nova's reduced padding suits a dense operations console; the sibling console
  `mori://shinzui/keiro-runtime-kenshou-insights` proves the `aria-*` toolchain works.
  Date: 2026-10-21

- Decision: The workspace is scaffolded by hand, mirroring the shadcn `vite-monorepo`
  template, and the shadcn CLI is used only for `init` inside `packages/ui` and for
  `add`. The CLI's one-shot monorepo scaffold is an optional shortcut whose output is
  reconciled against the hand-written layout, never the source of truth.
  Rationale: The template targets ESLint, Prettier, and Turbo; this workspace uses oxlint,
  oxfmt, and plain package scripts run by bun. Mirroring the layout keeps the generated
  `components.json` aliases and `exports` identical to what later plans import, while the
  CLI remains the only thing that writes component source.
  Date: 2026-10-21

- Decision: Paper Mono is vendored from the upstream repository at the `v1.000` tag as
  the single variable WOFF2 file (`PaperMono[wght].woff2`, weights 100–800) with
  `OFL.txt` beside it, checksummed, and declared by one `@font-face`; both `--font-sans`
  and `--font-mono` resolve to it.
  Rationale: Fixed by the MasterPlan; the font is SIL OFL 1.1 with no Reserved Font Name,
  there is no npm distribution, and vendoring a tagged artifact is reproducible.
  Date: 2026-10-21

- Decision: The Vite dev server emulates the composed deployment: `/kiroku`, `/shibuya`,
  `/pgmq`, and `/keiro` are proxied to ports 9091, 9090, 9092, and 9093 with the prefix
  stripped and WebSocket upgrades forwarded. Application routes must never start with one
  of these four prefixes.
  Rationale: Fixed by the MasterPlan's port and prefix table; one "same origin" connection
  profile then works in development, behind a reverse proxy, and in keiro's composed mount.
  Date: 2026-10-21


## Outcomes & Retrospective

(To be filled during and after implementation.)


## Context and Orientation

**What exists today.** The repository has no `package.json`, no application source, and no
Nix flake. It holds `docs/` (architecture documents, ADRs, MasterPlans, ExecPlans),
`agents/skills/` (the plan tooling), `mori.dhall`, `mina.kdl`, `.seihou/`, and a
`.gitignore` that ignores only agent configuration. Everything this plan creates is new.

**The target layout** is fixed by the parent MasterPlan's Integration Points (section
"Workspace layout and package names"). After this plan the tree looks like this:

```text
keiro-ui/
├── package.json                 workspace root: scripts dev/build/check/test/test:e2e
├── bun.lock                     bun's text lockfile
├── bunfig.toml                  optional bun settings (only if needed)
├── tsconfig.base.json           shared strict compiler options
├── .oxlintrc.json  .oxfmtrc.json
├── vitest.config.ts             projects: apps/*, packages/*
├── justfile
├── flake.nix  flake.lock  nix/
├── apps/
│   └── console/                 @keiro-ui/console — the browser application
│       ├── index.html  vite.config.ts  tsconfig.json  components.json
│       ├── playwright.config.ts  e2e/smoke.spec.ts
│       └── src/
│           ├── main.tsx  router.tsx  routeTree.gen.ts  styles.css
│           ├── routes/__root.tsx  routes/index.tsx
│           └── components/theme-provider.tsx
└── packages/
    ├── ui/                      @keiro-ui/ui — shadcn React Aria components, fonts, tokens
    │   ├── package.json  components.json  tsconfig.json  vitest.config.ts
    │   └── src/
    │       ├── components/*.tsx   (generated by the shadcn CLI)
    │       ├── hooks/*.ts         (generated: use-mobile.ts, ...)
    │       ├── lib/utils.ts
    │       ├── styles/globals.css
    │       └── fonts/PaperMono[wght].woff2  OFL.txt  CHECKSUMS.txt  fonts.css
    ├── client-core/             @keiro-ui/client-core — placeholder manifest (EP-10 fills it)
    └── testing/                 @keiro-ui/testing — placeholder manifest (EP-9 fills it)
```

**Terms used in this plan.** A *bun workspace* is a directory of several npm packages
installed together by bun (listed in the root `package.json` `workspaces` field), where one
package can depend on another by name
(`"@keiro-ui/ui": "workspace:*"`) without publishing. *shadcn/ui* is not a library you
install; it is a command-line tool (`shadcn`) that copies component source files into your
own repository, after which you own and edit them. Its *base* is the accessibility
primitive library the copied components are written against — Radix UI, Base UI, or, as
chosen here, *React Aria Components* (the `react-aria-components` package, which provides
accessible, unstyled building blocks such as `Dialog`, `Menu`, `Autocomplete`, and
`Table`). Its *style* (Vega, Nova, Maia, ...) is a preset of spacing and radius tokens; the
combination is written as the `style` field of `components.json`, for example
`aria-nova`. *Tailwind CSS 4* is a utility-class CSS framework configured in CSS itself
(`@import "tailwindcss"`, `@theme`, `@source`) rather than a JavaScript config file.
*TanStack Router* is a type-safe React router; its Vite plugin scans `src/routes/` and
writes `src/routeTree.gen.ts`, so adding a file adds a route. A *Vite proxy* is the
development server forwarding some URL prefixes to another HTTP server, so the browser only
ever talks to one origin. *oklch* is the CSS colour space shadcn's tokens use. A *variable
font* is one file whose weight is a continuous axis, so one `@font-face` serves every
weight. *OFL* is the SIL Open Font License 1.1, which permits bundling the font as long as
its licence text travels with it.

**Where the component source comes from.** The shadcn registry's React Aria base lives in
the shadcn repository corpus registered in Mori as `mori://shadcn-ui/ui`, under
`apps/v4/registry/bases/aria/` (component source in `ui/`, hooks in `hooks/`), with
documentation under `apps/v4/content/docs/components/aria/*.mdx`; the CLI's `init`
command accepts `--base aria` and a `--preset` such as `aria-nova`, and the monorepo
template this plan mirrors is `templates/vite-monorepo` (artifact-level Mori URI pending;
the local checkout is at `/Users/shinzui/Keikaku/hub/ui-libraries/shadcn-ui-project/ui`
when you want to read it). Components generated by shadcn 4.x import the `cn` class
helper from the `cn` npm package, not from a local utilities file, and the stylesheet
imports `shadcn/tailwind.css` from the `shadcn` package, so both are dependencies of
`packages/ui`.

**The sibling to imitate.** `mori://shinzui/keiro-runtime-kenshou-insights` (local checkout
`/Users/shinzui/Keikaku/bokuno/keiro-runtime-kenshou-insights`) is an existing console in
the keiro family built with shadcn `aria-vega`, TanStack Router, Tailwind 4, oxlint, oxfmt,
Playwright, and a Nix flake. Its `src/styles.css` is the model for the token block, its
`tsconfig.json` for compiler strictness, its `flake.nix`, `nix/bun.nix`, `nix/tooling.nix`,
and `nix/pre-commit.nix` for the Nix shell, and its `justfile` for recipes. It uses bun, and so
does this workspace (the parent MasterPlan's Decision Log records the switch from the
direction document's original pnpm wording).

**Relevant decisions.** [ADR-5](../adr/0005-no-backend-for-frontend.md) fixes the package
split (one typed client per surface, consumed directly by the browser), which is why
`packages/client-core` and `packages/testing` are created now as empty manifests.
[ADR-6](../adr/0006-design-system-adapter-defers-the-component-library-choice.md) is
superseded: the adapter package it described is not created.
[ADR-8](../adr/0008-shadcn-ui-on-the-react-aria-base-is-the-console-component-library.md)
is the decision this plan implements: shadcn on the React Aria base, `packages/ui` as the
only place UI primitives are imported from, Paper Mono as the typeface. Cross-repository:
`mori://shinzui/keiro/okf/adrs/concepts/ADR-57` is why the proxy prefixes are exactly
`/keiro`, `/kiroku`, `/shibuya`, `/pgmq` — keiro's `composeSurfaces` mounts the surfaces
under those names. No other ADR bears on this plan.

**Dependency versions.** The versions below were verified with `npm view <pkg> version` on
2026-10-21 and are floors: re-run `npm view` before pinning and prefer the newest patch of
the same major. react 19.3.1, react-dom 19.3.1, vite 8.3.5, @vitejs/plugin-react 6.1.2,
typescript 7.0.2, @tanstack/react-router 1.170.45, @tanstack/router-plugin 1.168.47,
@tanstack/react-query 5.104.5, react-aria-components 1.22.1, shadcn 4.22.1, tailwindcss
4.3.3, @tailwindcss/vite 4.3.3, zod 4.6.7, vitest 5.0.5, @playwright/test 1.64.1. Use
exact versions (no caret) in every `package.json` so the lockfile and the plan agree.
bun 1.4 (`bun --version`) is the package manager, workspace manager, and script runner.
Node 22 (`node --version` prints `v22.x`) must also be on the path: `bun run` honors the
`node` shebang of the vitest and Playwright binaries, so tests execute on Node while bun
installs packages and runs scripts.


## Plan of Work

### Milestone 1 — Workspace and toolchain

Create the workspace skeleton so that `bun install` and `bun run check` succeed before any
component or screen exists. The root `package.json` is private, `"type": "module"`,
declares `"packageManager": "bun@1.4.2"` (or the installed bun), lists the workspaces, and
exposes the five scripts every later plan and the `justfile` call (always `bun run <name>`:
a bare `bun test` would start bun's own test runner instead of vitest):

```json
{
  "name": "keiro-ui",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.2",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --filter @keiro-ui/console dev",
    "build": "bun run --filter './packages/*' build && bun run --filter @keiro-ui/console build",
    "typecheck": "bun run --filter './packages/*' typecheck && bun run --filter './apps/*' typecheck",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt --write .",
    "format:check": "oxfmt --check .",
    "check": "bun run typecheck && bun run lint && bun run format:check",
    "test": "vitest run",
    "test:e2e": "bun run --filter @keiro-ui/console test:e2e"
  }
}
```

The `workspaces` field replaces pnpm's the root `package.json` `workspaces` field; packages depend on each other
with `"workspace:*"`, which bun resolves. bun does not run dependencies' lifecycle scripts
unless they are listed in the root `trustedDependencies`; start with none and add a package
there only if `bun install` warns that it blocked a script you actually need (`esbuild` and
`@tailwindcss/oxide` ship platform binaries as optional dependencies and need no scripts;
`msw`'s postinstall only prints a message). `bunfig.toml` is optional; add it only when a
setting is needed (for example `[install] exact = true` so `bun add` pins exact versions). `tsconfig.base.json` holds
the strict options copied from the sibling's `tsconfig.json` (`strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`,
`moduleResolution: "bundler"`, `module: "ESNext"`, `target: "ESNext"`, `jsx: "react-jsx"`,
`lib: ["ESNext", "DOM", "DOM.Iterable"]`, `skipLibCheck`, `noEmit`); every package's
`tsconfig.json` extends it and adds its own `paths` and `include`. The packages do not
emit JavaScript: Vite bundles source directly, so each package's `exports` map points at
`.ts`/`.tsx` files and `build` is a no-op except in `apps/console`.

Create the two placeholder packages now so later plans never touch workspace
configuration: `packages/client-core/package.json` (`"name": "@keiro-ui/client-core"`,
`"exports": { ".": "./src/index.ts" }`, scripts `typecheck`), `packages/client-core/src/index.ts`
containing only `export {}` and a comment pointing at
`docs/plans/10-implement-the-client-core-for-http-cursors-int64-websocket-and-live-queries.md`;
and the same shape for `packages/testing` (`@keiro-ui/testing`, with an empty
`fixtures/.gitkeep`, pointing at
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`).

Add `.oxlintrc.json` (recommended rules plus the React and TypeScript plugins, ignoring
`**/routeTree.gen.ts`, `dist`, `node_modules`) and `.oxfmtrc.json` (the sibling's choices:
no semicolons, double quotes, sorted imports, 100-column width, ignoring
`routeTree.gen.ts` and `bun.lock`). Add a root `vitest.config.ts` that declares
`test.projects: ["apps/*", "packages/*"]` so `vitest run` at the root discovers each
package's own `vitest.config.ts`; packages without tests simply have none yet.

The milestone is done when `bun install` completes, `bun run check` prints no errors, and
`bun run test` reports no test files (exit code 0 with `--passWithNoTests` set in the root
config).

### Milestone 2 — The design system package

Create `packages/ui` by hand first (manifest, tsconfig, `components.json`) so the shadcn
CLI finds the aliases it needs, then let the CLI generate every component.

`packages/ui/package.json` is `@keiro-ui/ui`, private, `"type": "module"`, with this
`exports` map (the paths later plans import):

```json
{
  "name": "@keiro-ui/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./fonts.css": "./src/fonts/fonts.css",
    "./fonts/*": "./src/fonts/*",
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./lib/*": "./src/lib/*.ts"
  },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" }
}
```

Its `tsconfig.json` extends the base and maps `"@keiro-ui/ui/*": ["./src/*"]` so that the
CLI's alias resolution and TypeScript agree. `packages/ui/components.json` mirrors the
shadcn Vite monorepo template's `packages/ui/components.json` with these values:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "aria-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@keiro-ui/ui/components",
    "utils": "@keiro-ui/ui/lib/utils",
    "hooks": "@keiro-ui/ui/hooks",
    "lib": "@keiro-ui/ui/lib",
    "ui": "@keiro-ui/ui/components"
  }
}
```

If you prefer to let the CLI write this file, run `bunx shadcn@latest init --base aria
--preset aria-nova --cwd packages/ui` and then diff the result against the block above; the
only acceptable differences are field order. If the CLI rejects `aria-nova` as a preset
name, run `init` without `--preset`, choose "React Aria" and "Nova" interactively, and
confirm `components.json` says `"style": "aria-nova"` (the sibling's file says
`"aria-vega"`, which shows the `<base>-<style>` naming).

Write `packages/ui/src/styles/globals.css` modelled on the sibling's `src/styles.css`:
import `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, and `../fonts/fonts.css`;
declare `@source` globs that cover both this package and the applications (from this
file's directory, `../**/*.{ts,tsx}` for the package and `../../../../apps/**/*.{ts,tsx}`
for the apps — verify the relative depth by checking that a class used only by the Sheet
component, such as `cn-sheet-content`, appears in the built CSS); declare
`@custom-variant dark (&:is(.dark *));`; an `@theme inline` block mapping every
`--color-*`, `--radius-*`, and the two font variables; the `:root` light tokens and the
`.dark` tokens in oklch (copy the sibling's values — neutral greys, `--radius: 0.625rem` —
and keep the `--sidebar-*` and `--chart-*` tokens because the sidebar and chart components
read them); and the base layer that applies `border-border` and `bg-background
text-foreground` to `*` and `body`. The two font variables are the only typographic
decision:

```css
@theme inline {
  --font-sans: "Paper Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-mono: "Paper Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  /* colour and radius mappings follow */
}
```

Vendor the font. Download the variable WOFF2 and the licence from the upstream
repository at its `v1.000` tag, verify, and record checksums:

```bash
cd packages/ui/src/fonts
curl -fsSL -o 'PaperMono[wght].woff2' \
  'https://raw.githubusercontent.com/paper-design/paper-mono/v1.000/fonts/webfonts/PaperMono%5Bwght%5D.woff2'
curl -fsSL -o OFL.txt 'https://raw.githubusercontent.com/paper-design/paper-mono/v1.000/OFL.txt'
file 'PaperMono[wght].woff2'          # expect: Web Open Font Format (Version 2)
head -3 OFL.txt                       # expect the Paper-Mono.Git Project Authors copyright and OFL 1.1
shasum -a 256 'PaperMono[wght].woff2' OFL.txt > CHECKSUMS.txt
```

If the tag path returns 404, download the release zip from
`https://github.com/paper-design/paper-mono/releases/tag/v1.000`, extract
`webfonts/PaperMono[wght].woff2` and `OFL.txt` from it, and record in `CHECKSUMS.txt`
which asset you used. `fonts.css` declares the family once:

```css
@font-face {
  font-family: "Paper Mono";
  src: url("./PaperMono[wght].woff2") format("woff2");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
```

Add the initial component set with the CLI from inside `packages/ui`, so that `add` reads
this package's `components.json` and installs `react-aria-components`, `cn`,
`class-variance-authority`, `lucide-react`, `sonner`, `react-resizable-panels`, and
`@tanstack/react-table` as it goes:

```bash
cd packages/ui
bunx shadcn@latest add button sidebar sheet command dialog alert-dialog tabs table \
  data-table badge tooltip kbd resizable separator scroll-area skeleton sonner input \
  input-group select dropdown-menu breadcrumb popover toggle switch empty spinner card \
  field collapsible
```

Open two of the generated files to confirm the base: `src/components/button.tsx` imports
`Button as ButtonPrimitive` from `react-aria-components`, and `src/components/command.tsx`
imports `Autocomplete`, `Menu`, and `useFilter` from the same package (this is the
command-palette foundation the shell plan builds on). If any generated file imports from
`next-themes` (the registry's `sonner` wrapper does), remove that import: `packages/ui`
cannot depend on the application's theme hook, so make the `Toaster` accept a `theme`
prop defaulting to `"system"` and let the shell pass the current theme in. Note the edit
in Surprises & Discoveries. The generated `hooks/use-mobile.ts` stays.

Add the package's `vitest.config.ts` (environment `jsdom`, setup file registering
`@testing-library/jest-dom/vitest`) and one test,
`packages/ui/src/components/button.test.tsx`, that renders `<Button onPress={spy}>Save</Button>`,
finds it by role `button` and name `Save`, presses it with `@testing-library/user-event`,
and asserts the spy was called once. The milestone is done when `bun run test` reports that
test passing and `bun run check` is still clean.

### Milestone 3 — The console application skeleton

Create `apps/console` as `@keiro-ui/console`, depending on `@keiro-ui/ui` by
`workspace:*`, `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`,
and `zod`, with dev dependencies `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`,
`@tanstack/router-plugin`, `@tanstack/router-devtools`, `@playwright/test`, `typescript`,
and the React type packages. Its `components.json` mirrors the template's `apps/web/components.json`:
same `style`, `tailwind.css` pointing at `../../packages/ui/src/styles/globals.css`,
aliases `components: "@/components"`, `hooks: "@/hooks"`, `lib: "@/lib"`,
`utils: "@keiro-ui/ui/lib/utils"`, `ui: "@keiro-ui/ui/components"` — so a future
`shadcn add` run inside the app would place a block under `apps/console/src/components`
while primitives keep coming from the package. Its `tsconfig.json` maps `"@/*": ["./src/*"]`.

`apps/console/vite.config.ts` registers the plugins in the order the router plugin
requires and defines the proxy from the MasterPlan's port table:

```ts
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const surfaces = { shibuya: 9090, kiroku: 9091, pgmq: 9092, keiro: 9093 } as const

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      Object.entries(surfaces).map(([name, port]) => [
        `^/${name}(/|$)`,
        {
          target: `http://127.0.0.1:${port}`,
          changeOrigin: true,
          ws: true,
          rewrite: (path: string) => path.replace(new RegExp(`^/${name}`), "") || "/",
        },
      ]),
    ),
  },
})
```

The regular-expression keys (`^/kiroku(/|$)`) stop `/kirokux` from matching, and the
`rewrite` strips the prefix so the servers see the same paths they serve when mounted at
their roots. If `resolve.tsconfigPaths` is not recognised by the installed Vite, add
`vite-tsconfig-paths` instead.

`src/main.tsx` renders `<RouterProvider router={router} />` inside a
`QueryClientProvider` and the `ThemeProvider`; `src/router.tsx` creates the router from
`routeTree.gen.ts` with `defaultPreload: "intent"` and `scrollRestoration: true`, and
registers the type with `declare module "@tanstack/react-router"`.
`src/routes/__root.tsx` is `createRootRoute` whose component renders an `<Outlet />` and the
router devtools in development; `src/routes/index.tsx` is the placeholder page: a heading
"keiro runtime console", a paragraph set at several weights (`font-thin` through
`font-extrabold`) to prove the variable axis works, a line of digits and brackets to show
the monospace alignment, a `Button` from `@keiro-ui/ui/components/button` that opens a
`Sheet` from `@keiro-ui/ui/components/sheet` with `side="right"`, and a dark-mode toggle
from `src/components/theme-provider.tsx` (copy the template's provider: it toggles the
`dark` class on `document.documentElement`, persists the choice under the localStorage key
`keiro-ui.theme`, and exposes `useTheme()`; the shell plan reuses this hook). `src/styles.css`
imports `@keiro-ui/ui/globals.css`. Commit the generated `src/routeTree.gen.ts`; it is
regenerated by the plugin on every dev and build run and ignored by the linter and
formatter.

Add Playwright: `apps/console/playwright.config.ts` with `testDir: "e2e"`, a `webServer`
that runs `bunx vite preview --port 4173 --strictPort` after `bun run build`, and
`e2e/smoke.spec.ts` which opens `/`, expects the heading, asserts
`document.fonts.check('400 16px "Paper Mono"')` is true after `document.fonts.ready`,
clicks the toggle and expects `html` to have class `dark`, and opens the sheet and expects
a dialog to be visible. The milestone is done when `bun run build` writes `apps/console/dist`
and `bun run test:e2e` passes.

### Milestone 4 — Developer entry points

Write the `justfile` (recipes `install`, `dev`, `build`, `typecheck`, `lint`, `lint-fix`,
`format`, `format-check`, `check`, `test`, `test-e2e`, each delegating to the matching
package script, with `default` listing recipes). Write the Nix flake by copying the sibling's
`flake.nix`, `nix/bun.nix`, `nix/tooling.nix`, `nix/tooling-sources.json`, and
`nix/pre-commit.nix` unchanged: `nix/bun.nix` already provides `pkgs.bun`, `pkgs.just`, and
the `tooling` derivations for `typescript`, `oxlint`, and `oxfmt`, and its shell hook installs
the pre-commit hooks and prints a reminder to run `just install` when `node_modules` is
missing. Add a committed `flake.module.nix` (the sibling keeps the template as
`flake.module.nix.example`) that sets `bunProject.extraDevPackages = [ pkgs.nodejs_22 pkgs.caddy ]`
— Node 22 because vitest and Playwright execute on Node, caddy for
docs/plans/18-package-the-console-for-deployment.md. Playwright browsers are installed by
`bunx playwright install chromium`
into the default cache rather than from Nix; on NixOS the Chromium it downloads will not
start, so document the alternative of setting `PLAYWRIGHT_BROWSERS_PATH` to
`${pkgs.playwright-driver.browsers}` in `flake.module.nix` (keep the sibling's
`flake.module.nix.example` convention for such customisations). Pin the flake inputs to the
same revisions the sibling pins, then run `nix flake update` only if evaluation fails.

Extend `.gitignore` with `node_modules`, `dist`, `.vite`, `.tanstack/`, `test-results/`,
`playwright-report/`, `.direnv`, `result`, `result-*`, `*.log`, `.env`, `.env.local`,
`.pre-commit-config.yaml`, and `.DS_Store`. Write a `README.md` quickstart: prerequisites
(Nix, or bun 1.4 plus Node 22), the five commands, the port and prefix table, and a pointer
to `docs/architecture/ui-direction.md`. The milestone is done when `nix develop -c bun run check`
succeeds and `just --list` shows the recipes.


## Concrete Steps

All commands run from the repository root `/Users/shinzui/Keikaku/bokuno/keiro-ui` unless
a `cd` is shown. bun 1.4 and Node 22 must be on the path (`bun --version`,
`node --version`).

1. Verify the dependency floors before pinning:

```bash
for p in react vite @vitejs/plugin-react typescript @tanstack/react-router @tanstack/router-plugin \
  @tanstack/react-query react-aria-components shadcn tailwindcss @tailwindcss/vite zod vitest @playwright/test; do
  printf '%-28s %s\n' "$p" "$(npm view "$p" version)"
done
```

Expect each line to show a version at or above the floor listed in Context and
Orientation.

2. Create the Milestone 1 files, then install and check:

```bash
bun install
bun run check
bun run test
```

Expected tail of the transcript:

```text
> keiro-ui@ check /Users/shinzui/Keikaku/bokuno/keiro-ui
> bun run typecheck && bun run lint && bun run format:check
...
Found 0 warnings and 0 errors.
...
No test files found, exiting with code 0
```

3. Create `packages/ui` (manifest, tsconfig, `components.json`, `globals.css`,
`fonts.css`), vendor the font as shown in Milestone 2, then generate the components:

```bash
cd packages/ui
bunx shadcn@latest add button sidebar sheet command dialog alert-dialog tabs table \
  data-table badge tooltip kbd resizable separator scroll-area skeleton sonner input \
  input-group select dropdown-menu breadcrumb popover toggle switch empty spinner card \
  field collapsible
grep -l "react-aria-components" src/components/*.tsx | wc -l   # expect most files listed
grep -n '"style"' components.json                                # expect "aria-nova"
cd ../..
bun install
bun run test
```

Expected: `✓ packages/ui/src/components/button.test.tsx (1 test)` and
`Test Files  1 passed (1)`.

4. Create `apps/console` as described in Milestone 3, then:

```bash
bun run dev
```

Expected output includes `Local: http://localhost:5173/`. In a second terminal:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/pgmq/health/live
```

Expected `200` with a pgmq-inspect server on port 9092 (see
`docs/plans/9-provision-the-local-runtime-stack-and-recorded-fixtures.md`), or `502`
printed by the Vite proxy when nothing listens there — either proves the prefix maps to
port 9092; a `404` from the SPA would mean the proxy is not matching. Stop the dev server,
then:

```bash
bunx playwright install chromium
bun run build
bun run test:e2e
```

Expected: `vite v8.x building for production...` followed by `✓ built in`, and Playwright
reporting `1 passed`.

5. Create the `justfile`, the flake, `.gitignore` additions, and `README.md`, then:

```bash
just --list
nix develop -c bun run check
```

6. Commit at each milestone boundary with the trailers the MasterPlan requires:

```text
feat(workspace): scaffold the bun workspace and toolchain

MasterPlan: docs/masterplans/2-build-the-keiro-runtime-console.md
ExecPlan: docs/plans/7-scaffold-the-console-workspace-and-design-system.md
```


## Validation and Acceptance

Required acceptance, all from a fresh clone (`git clone` into a scratch directory, then
`bun install`):

- `bun run check` exits 0 with no lint or format findings and no type errors across
  `apps/console`, `packages/ui`, `packages/client-core`, and `packages/testing`.
- `bun run test` runs the Button component test under jsdom and passes.
- `bun run build` produces `apps/console/dist/index.html` and a CSS bundle that contains the
  string `Paper Mono` (the `@font-face` survived) and a class emitted only by the Sheet
  component (the `@source` globs reach `packages/ui`).
- `bun run test:e2e` passes the smoke test: heading visible, `document.fonts.check` true for
  Paper Mono, dark class toggles, sheet opens as a dialog.
- `bun run dev` serves `http://localhost:5173`; the placeholder page renders in Paper Mono
  (inspect the computed `font-family` of the heading in browser devtools, or use the
  Playwright check), weights from thin to extra-bold are visibly distinct, and the toggle
  switches between light and dark tokens.
- Through the dev server, `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/pgmq/health/live`
  returns `200` when a pgmq-inspect server listens on 9092 and `502` otherwise; the same
  for `/kiroku/health/live` (9091), `/shibuya/health/live` (9090), and `/keiro/health`
  (9093). A WebSocket upgrade to `ws://localhost:5173/pgmq/ws` reaches port 9092 when it is
  running (verify with `bunx wscat -c ws://localhost:5173/pgmq/ws` and a `{"type":"ping"}`
  frame answered by `{"type":"pong"}`).
- `components.json` in `packages/ui` reads `"style": "aria-nova"`, and no file outside
  `packages/ui` imports from `react-aria-components`
  (`grep -rl react-aria-components apps packages --include=*.tsx --include=*.ts | grep -v packages/ui` prints nothing).
- `nix develop -c bun run check` succeeds and `just --list` prints the recipes.

Proposed, not required: a GitHub Actions workflow running `bun run check && bun run test && bun run build`
can be added here or by the packaging plan
(`docs/plans/18-package-the-console-for-deployment.md`); this plan only needs the local
commands to pass.


## Idempotence and Recovery

Every step can be repeated. `bun install` is idempotent; `shadcn add` refuses to overwrite
existing component files unless `--overwrite` is passed, so re-running the `add` command
after a partial failure is safe and only writes the missing files. If a generated
component is edited by hand later and a re-add is needed, pass `--overwrite` for that one
name only. The font download can be repeated; `CHECKSUMS.txt` lets you confirm the vendored
bytes with `shasum -a 256 -c CHECKSUMS.txt` from `packages/ui/src/fonts`. The TanStack
plugin rewrites `routeTree.gen.ts` on every run, so a stale tree is fixed by starting
`bun run dev` once. If `bun install` reports that it blocked a lifecycle script a package needs, add that
package to `trustedDependencies` in the root `package.json` and re-run. To roll back a milestone, `git checkout`
the files it added and delete `node_modules` — nothing in this plan touches anything
outside the repository except the Playwright browser cache.


## Interfaces and Dependencies

This plan is the first child of `docs/masterplans/2-build-the-keiro-runtime-console.md` and
has no prerequisite plan. The artifacts it defines and that other plans depend on are:

- The workspace scripts `bun run dev`, `bun run build`, `bun run check`, `bun run test`, and
  `bun run test:e2e` at the repository root, and the `justfile` recipes of the same names.
- `@keiro-ui/ui` and its export paths `@keiro-ui/ui/globals.css`, `@keiro-ui/ui/components/<name>`,
  `@keiro-ui/ui/hooks/<name>`, `@keiro-ui/ui/lib/utils`, `@keiro-ui/ui/fonts/*`; the rule that
  a new primitive is added by running `bunx shadcn@latest add <name>` inside
  `packages/ui` and committing the generated source; the theme tokens in
  `packages/ui/src/styles/globals.css`.
- `apps/console` with the Vite proxy for `/kiroku` → 9091, `/shibuya` → 9090, `/pgmq` → 9092,
  `/keiro` → 9093 (prefix stripped, WebSocket forwarded), the router created in
  `apps/console/src/router.tsx`, the root route in `apps/console/src/routes/__root.tsx`,
  and `useTheme()` from `apps/console/src/components/theme-provider.tsx`.
- The placeholder manifests `packages/client-core` (`@keiro-ui/client-core`) and
  `packages/testing` (`@keiro-ui/testing`), each exporting `./src/index.ts`.
- `tsconfig.base.json`, `.oxlintrc.json`, `.oxfmtrc.json`, and the root `vitest.config.ts`
  project discovery, which every package inherits.

Libraries whose choice matters: `react-aria-components` (only inside `packages/ui`),
`shadcn` (CLI and `shadcn/tailwind.css`), `tailwindcss` with `@tailwindcss/vite`,
`@tanstack/router-plugin` and `@tanstack/react-router`, `@tanstack/react-query` (installed
now so the shell and client plans share one version), `vitest` with `jsdom`,
`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and
`@react-aria/test-utils`, `@playwright/test`, `oxlint`, and `oxfmt`.
