import { QueryClient } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { SelectedConnectionContext } from "@/settings/connection-context"
import { ConnectionSession } from "@/settings/connection-session"
import { selectConnection } from "@/settings/connection-targets"

import { MutationFlow } from "./mutation-flow"
import { clearSessionAudit, useSessionAudit } from "./session-audit"

afterEach(clearSessionAudit)
const preview = { outcome: "preview" as const, result: { changes: true } }
const executed = { outcome: "executed" as const, result: { outcome: "transitioned" } }
function Audit() {
  return <pre data-testid="audit">{JSON.stringify(useSessionAudit())}</pre>
}
function connection(id: string) {
  return selectConnection(
    { id, label: id, app: id, environment: "prod", surfaces: { keiro: `/${id}/keiro` } },
    "managed",
    undefined,
    "http://console",
  )
}
const flowProps = {
  isOpen: true,
  onOpenChange: () => {},
  title: "Cancel timer",
  description: "Cancel fixture timer",
  target: "same-id",
  summarize: () => ({ headline: "would cancel", changes: true }),
  resultHeadline: () => "transitioned",
  invalidate: [["keiro"]],
  audit: { action: "timer cancel" },
}

test("delayed previews cannot revive after retirement or execute on the new target", async () => {
  let finish!: (value: typeof preview) => void
  const handle = {
    preview: () =>
      new Promise<typeof preview>((resolve) => {
        finish = resolve
      }),
    execute: vi.fn(async () => executed),
  }
  const tree = (id: string) => (
    <>
      <Audit />
      <SelectedConnectionContext.Provider value={connection(id)}>
        <ConnectionSession key={id}>
          {id === "orders" && <MutationFlow {...flowProps} handle={handle} />}
        </ConnectionSession>
      </SelectedConnectionContext.Provider>
    </>
  )
  const view = render(tree("orders"))
  await screen.findByRole("dialog", { name: "Cancel timer" })
  view.rerender(tree("billing"))
  await act(async () => finish(preview))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(handle.execute).not.toHaveBeenCalled()
})

test("submitted execution completes against its captured identity and never invalidates the new session", async () => {
  let finish!: (value: typeof executed) => void
  const handle = {
    preview: async () => preview,
    execute: vi.fn(
      () =>
        new Promise<typeof executed>((resolve) => {
          finish = resolve
        }),
    ),
  }
  const caches: QueryClient[] = []
  const collect = (client: QueryClient) => {
    if (!caches.includes(client)) caches.push(client)
  }
  const tree = (id: string) => (
    <>
      <Audit />
      <SelectedConnectionContext.Provider value={connection(id)}>
        <ConnectionSession key={id} onSession={collect}>
          {id === "orders" && <MutationFlow {...flowProps} handle={handle} />}
        </ConnectionSession>
      </SelectedConnectionContext.Provider>
    </>
  )
  const view = render(tree("orders"))
  const dialog = await screen.findByRole("dialog", { name: "Cancel timer" })
  await within(dialog).findByText("would cancel")
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Confirmation" }), {
    target: { value: "same-id" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Execute" }))
  await waitFor(() => expect(handle.execute).toHaveBeenCalledTimes(1))
  view.rerender(tree("billing"))
  const invalidate = vi.spyOn(caches.at(-1)!, "invalidateQueries")
  await act(async () => finish(executed))
  await waitFor(() => expect(screen.getByTestId("audit")).toHaveTextContent('"targetId":"orders"'))
  expect(screen.getByTestId("audit")).toHaveTextContent('"environment":"prod"')
  expect(screen.getByTestId("audit")).toHaveTextContent(
    '"endpoints":{"keiro":"http://console/orders/keiro"}',
  )
  expect(invalidate).not.toHaveBeenCalled()
})

test("a typed but unsubmitted confirmation is discarded when changing app", async () => {
  const handle = { preview: async () => preview, execute: vi.fn(async () => executed) }
  const tree = (id: string) => (
    <SelectedConnectionContext.Provider value={connection(id)}>
      <ConnectionSession key={id}>
        {id === "orders" && <MutationFlow {...flowProps} handle={handle} />}
      </ConnectionSession>
    </SelectedConnectionContext.Provider>
  )
  const view = render(tree("orders"))
  const dialog = await screen.findByRole("dialog", { name: "Cancel timer" })
  await within(dialog).findByText("would cancel")
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Confirmation" }), {
    target: { value: "same-id" },
  })
  expect(within(dialog).getByRole("button", { name: "Execute" })).toBeEnabled()
  view.rerender(tree("billing"))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(handle.execute).not.toHaveBeenCalled()
})
