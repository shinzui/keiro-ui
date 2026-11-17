import { Button } from "@keiro-ui/ui/components/button"
import { Copy } from "lucide-react"

/** Shortened text with a control that copies the full value. */
export function CopyText({ shown, value, label }: { shown: string; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="font-mono text-xs" title={value}>
        {shown}
      </code>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Copy ${label}`}
        onPress={() => void navigator.clipboard?.writeText(value)}
      >
        <Copy />
      </Button>
    </span>
  )
}
