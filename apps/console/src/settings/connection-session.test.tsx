import {
  LivenessProvider,
  useFeedSubscription,
  useSurfaceQuery,
  type Dialect,
  type QueryClient,
} from "@keiro-ui/client-core"
import { act, render, screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"

import { SelectedConnectionContext } from "./connection-context"
import { ConnectionSession, useConnectionSession, type SessionToken } from "./connection-session"
import { selectConnection, type ConnectionTarget } from "./connection-targets"

class Socket extends EventTarget {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 1
  closed = false
  constructor(public url: string) {
    super()
    Socket.instances.push(this)
  }
  send() {}
  close() {
    this.closed = true
  }
  frame(value: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) }))
  }
}
const dialect: Dialect = {
  name: "test",
  subscribe: () => null,
  unsubscribe: () => null,
  ping: { type: "ping" },
  frameTypes: {
    snapshot: "snapshot",
    delta: "update",
    error: "error",
    goodbye: "goodbye",
    pong: "pong",
  },
  overflowCodes: ["overflow"],
  isResync: () => false,
}

test("late reads, queued frames, cache scans and repeated switches remain in one live session", async () => {
  const target: ConnectionTarget = {
    id: "orders",
    label: "Orders",
    app: "orders",
    environment: "prod",
    surfaces: { keiro: "/orders/keiro" },
  }
  const clients: QueryClient[] = []
  const tokens: SessionToken[] = []
  let finish!: (value: string) => void
  const delayed = new Promise<string>((resolve) => {
    finish = resolve
  })
  let label = "Orders"
  function Consumer() {
    const session = useConnectionSession()!
    if (!tokens.includes(session)) tokens.push(session)
    const query = useSurfaceQuery({
      surface: "keiro",
      queryKey: ["keiro", "same-id"],
      queryFn: () => (label === "Orders" ? delayed : Promise.resolve(label)),
      poll: false,
    })
    useFeedSubscription({
      url: `ws://console/${label}`,
      dialect,
      WebSocket: Socket as unknown as typeof WebSocket,
      invalidate: ["keiro"],
      applyToCache: (cache, frame) => cache.setQueryData(["keiro", "same-id"], frame.value),
    })
    return <p>{query.data}</p>
  }
  const tree = (t: ConnectionTarget) => {
    const selected = selectConnection(t, "managed", undefined, "http://console")
    return (
      <SelectedConnectionContext.Provider value={selected}>
        <ConnectionSession
          key={selected.sessionKey}
          onSession={(client) => {
            if (!clients.includes(client)) clients.push(client)
          }}
        >
          <LivenessProvider>
            <Consumer />
          </LivenessProvider>
        </ConnectionSession>
      </SelectedConnectionContext.Provider>
    )
  }
  const view = render(tree(target))
  const oldSocket = Socket.instances.at(-1)!
  label = "Billing"
  view.rerender(tree({ ...target, id: "billing", surfaces: { keiro: "/billing/keiro" } }))
  await screen.findByText("Billing")
  expect(oldSocket.closed).toBe(true)
  act(() => {
    oldSocket.frame({ type: "snapshot", value: "late Orders" })
    finish("late Orders response")
  })
  await waitFor(() => expect(clients[0]!.getQueryCache().getAll()).toHaveLength(0))
  expect(clients[1]!.getQueryData(["keiro", "same-id"])).toBe("Billing")
  expect(tokens[0]!.active).toBe(false)
  label = "Updated endpoint"
  view.rerender(tree({ ...target, id: "billing", surfaces: { keiro: "/billing-v2/keiro" } }))
  await screen.findByText("Updated endpoint")
  expect(clients).toHaveLength(3)
  expect(Socket.instances.filter((s) => !s.closed)).toHaveLength(1)
  view.unmount()
  expect(Socket.instances.filter((s) => !s.closed)).toHaveLength(0)
})
