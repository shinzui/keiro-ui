import { Button } from "@keiro-ui/ui/components/button"

/**
 * First / Previous / Next over a cursor kept in the URL. `trail` is the session's stack of
 * earlier cursors (cursors cannot be computed backwards); `onNavigate` writes the new cursor
 * (undefined = first page) to the URL.
 */
export function CursorPager({
  cursor,
  nextCursor,
  trail,
  onNavigate,
  itemCount,
}: {
  cursor: string | undefined
  nextCursor: string | undefined
  trail: (string | undefined)[]
  onNavigate: (cursor: string | undefined, trail: (string | undefined)[]) => void
  itemCount?: number
}) {
  const onFirst = cursor === undefined
  return (
    <nav aria-label="Pages" className="flex items-center gap-2 text-xs">
      <Button
        size="xs"
        variant="outline"
        isDisabled={onFirst}
        onPress={() => onNavigate(undefined, [])}
      >
        First
      </Button>
      <Button
        size="xs"
        variant="outline"
        isDisabled={onFirst || trail.length === 0}
        onPress={() => onNavigate(trail.at(-1), trail.slice(0, -1))}
      >
        Previous
      </Button>
      <Button
        size="xs"
        variant="outline"
        isDisabled={nextCursor === undefined}
        onPress={() => onNavigate(nextCursor, [...trail, cursor])}
      >
        Next
      </Button>
      {itemCount !== undefined && (
        <span className="text-muted-foreground">{itemCount} on this page</span>
      )}
    </nav>
  )
}
