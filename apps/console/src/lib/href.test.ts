import { createMemoryHistory, createRouter } from "@tanstack/react-router"
import { expect, test } from "vitest"

import { routeTree } from "@/routeTree.gen"

import { navigateToHref, publicHref, withoutBasepath } from "./href"
import { bindLinkRouter, hrefOf, links } from "./links"
import { parseSearch, stringifySearch } from "./search"

async function routerAt(basepath: string, url: string) {
  const router = createRouter({
    routeTree,
    basepath,
    parseSearch,
    stringifySearch,
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  bindLinkRouter(router)
  await router.load()
  return router
}

test.each([
  ["/console/streams/a?target=t", "/streams/a?target=t"],
  ["/console", "/"],
  ["/console?target=t", "/?target=t"],
  ["/streams/a", "/streams/a"],
  ["/consoles/x", "/consoles/x"],
])("withoutBasepath(%s) under /console/", async (href, expected) => {
  const router = await routerAt("/console/", "/console/")
  expect(withoutBasepath(router, href)).toBe(expected)
})

test("a recorded href navigates once under a sub-path deployment", async () => {
  const router = await routerAt("/console/", "/console/streams?target=a&worker=w")
  const href = hrefOf(links.stream("notification-x"))
  expect(href).toBe("/streams/notification-x?target=a&worker=w")
  expect(publicHref(router, href)).toBe("/console/streams/notification-x?target=a&worker=w")
  await navigateToHref(router, href)
  expect(router.history.location.pathname).toBe("/console/streams/notification-x")
})

test("an href stored with the base path (before the fix) still navigates once", async () => {
  const router = await routerAt("/console/", "/console/streams?target=a&worker=w")
  await navigateToHref(router, "/console/streams/notification-x?target=a&worker=w")
  expect(router.history.location.pathname).toBe("/console/streams/notification-x")
})
