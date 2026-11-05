import { useSurfaceQuery } from "@keiro-ui/client-core"
import { feedScript, type MockServer, startMockServer } from "@keiro-ui/testing/node"
import { renderHook, waitFor } from "@testing-library/react"
import { ws } from "msw"
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { keiroKeys, useKeiroClient } from "../src"
import {
  mergeFeedFrame,
  useProjectionGroupsFeed,
  useTimersFeed,
  useWorkflowsFeed,
  workflowKey,
} from "../src/feeds"
import { makeWrapper } from "./support"

const item = (id: string, status = "running") => ({ workflow_name: "w", workflow_id: id, status })

describe("mergeFeedFrame", () => {
  test("snapshot replaces, update upserts and removes", () => {
    const snap = mergeFeedFrame(
      undefined,
      { type: "snapshot", sequence: 0, items: [item("a"), item("b")] },
      workflowKey,
    )
    expect(snap.items.map((i) => i.workflow_id)).toEqual(["a", "b"])
    const next = mergeFeedFrame(
      snap,
      {
        type: "update",
        sequence: 1,
        changed: [item("b", "completed"), item("c")],
        removed: [{ workflow_name: "w", workflow_id: "a" }],
      },
      workflowKey,
    )
    expect(next.items).toEqual([item("b", "completed"), item("c")])
    expect(next.resync).toBe(false)
  })

  test("a sequence gap asks for a resync", () => {
    const snap = mergeFeedFrame(
      undefined,
      { type: "snapshot", sequence: 4, items: [] },
      workflowKey,
    )
    expect(
      mergeFeedFrame(snap, { type: "update", sequence: 6, changed: [], removed: [] }, workflowKey)
        .resync,
    ).toBe(true)
  })
})

describe("feed hooks", () => {
  let mock: MockServer
  beforeAll(() => {
    mock = startMockServer()
  })
  afterEach(() => mock.reset())
  afterAll(() => mock.close())

  test("the timers feed filters by `correlation_id` on the wire", async () => {
    const sent: unknown[] = []
    mock.use(
      ws.link("ws://*/keiro/ws").addEventListener("connection", ({ client }) => {
        client.addEventListener("message", (event) => sent.push(JSON.parse(String(event.data))))
      }),
    )
    const { wrapper } = makeWrapper()
    renderHook(() => useTimersFeed({ manager: "m", correlation: "c", limit: 5 }), { wrapper })
    await waitFor(() =>
      expect(sent).toContainEqual({
        type: "subscribe",
        feed: "timers",
        manager: "m",
        correlation_id: "c",
        limit: 5,
      }),
    )
  })

  test("a view_retiring refusal retries the subscription on the same socket", async () => {
    // Sockets from earlier tests in this file may reconnect here, so only this feed counts.
    const sockets: string[] = []
    mock.use(
      ws.link("ws://*/keiro/ws").addEventListener("connection", ({ client }) => {
        client.addEventListener("message", (event) => {
          const frame = JSON.parse(String(event.data)) as { type: string; feed?: string }
          if (frame.type !== "subscribe" || frame.feed !== "projection_groups") return
          sockets.push(client.id)
          if (sockets.length > 1) return
          client.send(
            JSON.stringify({
              type: "error",
              code: "view_retiring",
              message: "subscription could not be initialized",
              feed: "projection_groups",
            }),
          )
        })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useProjectionGroupsFeed(), { wrapper })
    await waitFor(() => expect(sockets).toHaveLength(2), { timeout: 3000 })
    expect(sockets[1]).toBe(sockets[0])
    expect(result.current.status).toBe("live")
  })

  test("the workflows feed writes the list entry and re-reads on queue_overflow", async () => {
    feedScript("keiro", { append: 1, overflowAfter: 1, intervalMs: 10 })
    const { wrapper, queryClient } = makeWrapper()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const filters = { limit: 100 }
    const { result } = renderHook(
      () => {
        const client = useKeiroClient()
        const list = useSurfaceQuery({
          surface: "keiro",
          queryKey: keiroKeys.workflows.list(filters),
          queryFn: ({ signal }) => client.workflows.list(filters, signal),
        })
        return { feed: useWorkflowsFeed(filters), list }
      },
      { wrapper },
    )
    await waitFor(() => expect(result.current.feed.status).toBe("live"), { timeout: 3000 })
    await waitFor(
      () =>
        expect(invalidate).toHaveBeenCalledWith({ queryKey: keiroKeys.workflows.list(filters) }),
      { timeout: 3000 },
    )
    expect(result.current.list.data?.items.length).toBeGreaterThan(0)
  })

  test("a list with a time window is poll-only: the feed stays off", () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useWorkflowsFeed({ created_since: "2026-10-01T00:00:00Z" }),
      { wrapper },
    )
    expect(result.current.status).toBe("off")
  })

  test("the projection groups feed fills the status entry", async () => {
    feedScript("keiro", { append: 0, intervalMs: 10 })
    const { wrapper, queryClient } = makeWrapper()
    const { result } = renderHook(() => useProjectionGroupsFeed(), { wrapper })
    await waitFor(
      () =>
        expect(
          queryClient.getQueryData<{ items: unknown[] }>(keiroKeys.projections.status())?.items
            .length,
        ).toBeGreaterThan(0),
      { timeout: 3000 },
    )
    expect(result.current.status).toBe("live")
    const page = queryClient.getQueryData<{ visible_store_head?: unknown }>(
      keiroKeys.projections.status(),
    )
    expect(typeof page?.visible_store_head).toBe("bigint")
  })

  test("the projection groups feed keeps feeding_subscriptions through a snapshot and an update", async () => {
    feedScript("keiro", { append: 2, intervalMs: 10, changedFields: { lifecycle_phase: "paused" } })
    const { wrapper, queryClient } = makeWrapper()
    renderHook(() => useProjectionGroupsFeed(), { wrapper })
    const rows = () =>
      queryClient.getQueryData<{
        items: { group_id: string; lifecycle_phase: string; feeding_subscriptions?: string[] }[]
      }>(keiroKeys.projections.status())?.items ?? []
    await waitFor(() => expect(rows().some((r) => r.lifecycle_phase === "paused")).toBe(true), {
      timeout: 3000,
    })
    expect(rows().every((r) => Array.isArray(r.feeding_subscriptions))).toBe(true)
    expect(
      rows().find((r) => r.group_id === "jitsurei-order-search")?.feeding_subscriptions,
    ).toEqual(["jitsurei-order-search", "jitsurei-order-search-facets"])
  })
})
