import type { AnyRouter } from "@tanstack/react-router"

/**
 * Internal hrefs ("/workflows?status_class=running") are application paths without the
 * deployment's base path. They are split into `to` and a parsed search object so the
 * router, not string concatenation, applies the base path when the console is served
 * under a sub-path.
 */
export function splitHref(
  router: AnyRouter,
  href: string,
): { to: string; search: Record<string, unknown>; hash?: string } {
  const url = new URL(withoutBasepath(router, href), "http://console.invalid")
  const search = router.options.parseSearch(url.search) as Record<string, unknown>
  const current = router.state.location.search as Record<string, unknown>
  // A scoped recent/pinned href for another application must not inherit this app's worker.
  if (search.target !== undefined && search.target !== current.target && !("worker" in search))
    search.worker = undefined
  const hash = url.hash ? url.hash.slice(1) : undefined
  return hash ? { to: url.pathname, search, hash } : { to: url.pathname, search }
}

/**
 * Removes the deployment's base path from an href that carries it. TanStack's
 * `buildLocation().href` includes the base path, and recents and pins recorded before
 * `hrefOf` stripped it are still stored with it; navigating such an href would apply the
 * base path twice ("/console/console/streams/..."). Application routes never start with the
 * base path's segment, so stripping it is unambiguous.
 */
export function withoutBasepath(router: AnyRouter, href: string): string {
  const base = (router.basepath ?? "/").replace(/\/+$/, "")
  if (!base || !href.startsWith(base)) return href
  const rest = href.slice(base.length)
  if (rest === "") return "/"
  if (rest.startsWith("?") || rest.startsWith("#")) return `/${rest}`
  return rest.startsWith("/") ? rest : href
}

export function navigateToHref(
  router: AnyRouter,
  href: string,
  options?: { replace?: boolean },
): Promise<void> {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
    window.location.assign(href)
    return Promise.resolve()
  }
  const { to, search, hash } = splitHref(router, href)
  return router.navigate({ to, search, hash, replace: options?.replace } as never)
}

/** The href to render in an anchor's `href` attribute (base path included). */
export function publicHref(router: AnyRouter, href: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return href
  const { to, search, hash } = splitHref(router, href)
  return router.buildLocation({ to, search, hash } as never).publicHref
}
