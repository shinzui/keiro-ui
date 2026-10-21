import { Tooltip, TooltipTrigger } from "@keiro-ui/ui/components/tooltip"

import { formatTimestamp } from "@/lib/format"

/** The relative time, with the absolute UTC timestamp in a tooltip. */
export function Timestamp({ value }: { value: string | Date }) {
  const { absolute, relative } = formatTimestamp(value)
  return (
    <TooltipTrigger>
      <time dateTime={absolute} tabIndex={0} className="outline-none">
        {relative}
      </time>
      <Tooltip>{absolute}</Tooltip>
    </TooltipTrigger>
  )
}
