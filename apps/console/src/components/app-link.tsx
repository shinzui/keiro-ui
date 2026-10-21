import { useRouter } from "@tanstack/react-router"
import type { ComponentProps, MouseEvent } from "react"

import { navigateToHref, publicHref } from "@/lib/href"

/**
 * An anchor for an internal href string (recents, pins, sidebar presets) that navigates
 * client-side on a plain click and leaves modified clicks to the browser. Typed targets use
 * TanStack's `<Link {...links.x()}>` instead.
 */
export function AppLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  const router = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target
    ) {
      return
    }
    event.preventDefault()
    void navigateToHref(router, href)
  }
  return <a href={publicHref(router, href)} onClick={handleClick} {...props} />
}
