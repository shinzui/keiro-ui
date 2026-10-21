import "./styles.css"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { router } from "./router"

async function main() {
  // VITE_MOCK=1 serves recorded fixtures through MSW instead of the live surfaces. The
  // condition is replaced at build time, so production bundles never include the worker.
  if (import.meta.env.VITE_MOCK === "1") {
    const { startMockWorker } = await import("@keiro-ui/testing/browser")
    await startMockWorker()
  }

  const root = document.getElementById("root")
  if (!root) throw new Error("missing #root element")

  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void main()
