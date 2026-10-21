import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const appVersion: string = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version

/** `KEIRO_UI_GIT_COMMIT` wins (a build without a git checkout, such as inside Nix). */
function gitCommit(): string {
  if (process.env.KEIRO_UI_GIT_COMMIT) return process.env.KEIRO_UI_GIT_COMMIT
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "unknown"
  }
}

// The four inspection surfaces, reached under the prefixes keiro's composeSurfaces uses
// (docs/masterplans/2-build-the-keiro-runtime-console.md, "Local ports and the
// composed-prefix convention"). Application routes must never start with one of them.
const surfaces = { shibuya: 9090, kiroku: 9091, pgmq: 9095, keiro: 9093 } as const

const surfaceProxy = Object.fromEntries(
  Object.entries(surfaces).map(([name, port]) => [
    `^/${name}(/|$)`,
    {
      target: `http://127.0.0.1:${port}`,
      changeOrigin: true,
      ws: true,
      rewrite: (path: string) => path.replace(new RegExp(`^/${name}`), "") || "/",
    },
  ]),
)

/**
 * The deployment's base path (`VITE_BASE_PATH`, default `/`), normalised to start and end with
 * `/`. The router takes its basepath from it; the surfaces stay at their absolute prefixes.
 */
function basePath(): string {
  const raw = process.env.VITE_BASE_PATH ?? "/"
  const leading = raw.startsWith("/") ? raw : `/${raw}`
  return leading.endsWith("/") ? leading : `${leading}/`
}

export default defineConfig({
  base: basePath(),
  resolve: { tsconfigPaths: true },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
  },
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  // Pre-bundled so the first visit to a route that uses it does not trigger a re-optimization
  // and reload (which left a second React copy in the page until the reload finished).
  optimizeDeps: { include: ["react-resizable-panels"] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: surfaceProxy,
  },
  // `bun run preview` reaches the local stack exactly as `bun run dev` does.
  preview: { proxy: surfaceProxy },
})
