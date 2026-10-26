import { act, renderHook } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, expect, test } from "vitest"

import { SelectedConnectionContext } from "@/settings/connection-context"
import { selectConnection } from "@/settings/connection-targets"

import { pinnedStore, recentStore, recordVisit, usePinned, useRecent } from "./recent"
const selected = (id: string) =>
  selectConnection(
    { id, label: id, app: id, environment: "prod", surfaces: { keiro: `/${id}` } },
    "managed",
    undefined,
    "https://ops",
  )
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SelectedConnectionContext.Provider, { value: selected("orders") }, children)
beforeEach(() => {
  recentStore.set([])
  pinnedStore.set([])
})

test("same-ID recent and pinned URLs retain their app and legacy history is untouched", () => {
  const old =
    '[{"kind":"timer","label":"old","href":"/timers?sheet=timer:same-id","at":"2026-01-01"}]'
  localStorage.setItem("keiro-ui.recent.v1", old)
  localStorage.setItem("keiro-ui.pinned.v1", old)
  for (const targetId of ["orders", "billing", "orders"])
    recordVisit({
      kind: "timer",
      label: "same-id",
      targetId,
      app: targetId,
      environment: "prod",
      href: `/timers?target=${targetId}&sheet=timer:same-id`,
    })
  expect(recentStore.get()).toHaveLength(2)
  const hook = renderHook(
    () => ({ recent: useRecent(), pinned: usePinned(), all: useRecent({ allTargets: true }) }),
    { wrapper },
  )
  expect(hook.result.current.recent.map((v) => v.targetId)).toEqual(["orders"])
  expect(hook.result.current.all).toHaveLength(2)
  act(() =>
    hook.result.current.pinned.toggle({
      kind: "timer",
      label: "same-id",
      href: "/timers?target=orders&sheet=timer:same-id",
    }),
  )
  expect(pinnedStore.get()[0]).toMatchObject({
    targetId: "orders",
    app: "orders",
    environment: "prod",
  })
  expect(localStorage.getItem("keiro-ui.recent.v1")).toBe(old)
  expect(localStorage.getItem("keiro-ui.pinned.v1")).toBe(old)
})
