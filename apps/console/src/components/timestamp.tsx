import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"

import { formatTimestamp } from "@/lib/format"

/**
 * The relative time, with the absolute UTC timestamp (and an optional `hint`) in a tooltip.
 * React Aria requires a tooltip trigger with an interactive role, hence `role="button"`.
 */
export function Timestamp({ value, hint }: { value: string | Date; hint?: string }) {
  const { absolute, relative } = formatTimestamp(value)
  return (
    <TooltipTrigger>
      <time dateTime={absolute} tabIndex={0} role="button" className="outline-none">
        {relative}
      </time>
      <Tooltip>
        {absolute}
        {hint && ` — ${hint}`}
      </Tooltip>
    </TooltipTrigger>
  )
}
