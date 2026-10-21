import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The four inspection surfaces, reached under the prefixes keiro's composeSurfaces uses
// (docs/masterplans/2-build-the-keiro-runtime-console.md, "Local ports and the
// composed-prefix convention"). Application routes must never start with one of them.
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
