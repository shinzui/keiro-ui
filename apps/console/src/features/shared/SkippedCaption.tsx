import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"

/** "N streams in category … skipped", with why in a tooltip. */
export function SkippedCaption({
  skipped,
  category,
  what,
}: {
  skipped: number
  category: string
  what: string
}) {
  if (skipped <= 0) return null
  return (
    <TooltipTrigger>
      <span
        role="button"
        tabIndex={0}
        className="text-xs text-muted-foreground outline-none"
        data-testid="skipped"
      >
        {skipped} streams in category {category} skipped: {what}
      </span>
      <Tooltip className="max-w-sm">
        keiro lists the category's streams and skips those whose name does not parse as this kind's
        instance id.
      </Tooltip>
    </TooltipTrigger>
  )
}
