import { Button } from "@keiro-ui/ui/components/button"
import { cn } from "cn"
import { ChevronDown, ChevronRight, Copy } from "lucide-react"
import { useMemo, useState } from "react"

/** JSON text with bigint values written as their exact digits. */
export function toJsonText(value: unknown, indent = 2): string {
  const marker = "\u0000bigint:"
  const text =
    JSON.stringify(
      value,
      (_key, item: unknown) => (typeof item === "bigint" ? `${marker}${item}` : item),
      indent,
    ) ?? "undefined"
  return text.replace(/"\\u0000bigint:(-?\d+)"/g, "$1")
}

const RAW_THRESHOLD = 200 * 1024

function Scalar({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (typeof value === "string")
    return <span className="text-emerald-700 dark:text-emerald-400">{JSON.stringify(value)}</span>
  if (typeof value === "bigint")
    return <span className="text-sky-700 dark:text-sky-400">{value.toString()}</span>
  if (typeof value === "number")
    return <span className="text-sky-700 dark:text-sky-400">{String(value)}</span>
  if (typeof value === "boolean")
    return <span className="text-violet-700 dark:text-violet-400">{String(value)}</span>
  return <span>{String(value)}</span>
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const container = typeof value === "object" && value !== null
  const [open, setOpen] = useState(depth < 2)
  const label = name !== undefined && <span className="text-muted-foreground">{name}: </span>
  if (!container) {
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        {label}
        <Scalar value={value} />
      </div>
    )
  }
  const entries = Array.isArray(value)
    ? value.map((item, i) => [String(i), item] as const)
    : Object.entries(value as Record<string, unknown>)
  const [openBracket, closeBracket] = Array.isArray(value) ? ["[", "]"] : ["{", "}"]
  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {label}
        <span className="text-muted-foreground">
          {openBracket}
          {!open && ` ${entries.length} ${entries.length === 1 ? "item" : "items"} ${closeBracket}`}
        </span>
      </button>
      {open && (
        <>
          {entries.map(([key, item]) => (
            <Node key={key} name={key} value={item} depth={1} />
          ))}
          <div className="text-muted-foreground">{closeBracket}</div>
        </>
      )}
    </div>
  )
}

/** A collapsible JSON tree with a raw/pretty toggle and copy; bigint values render as digits. */
export function JsonViewer({
  value,
  label,
  className,
}: {
  value: unknown
  label?: string
  className?: string
}) {
  const text = useMemo(() => toJsonText(value), [value])
  const large = text.length > RAW_THRESHOLD
  const [raw, setRaw] = useState(large)
  return (
    <section
      aria-label={label ?? "JSON"}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {label && <span className="font-medium">{label}</span>}
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant="ghost" onPress={() => setRaw(!raw)}>
            {raw ? "Tree" : "Raw"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Copy ${label ?? "JSON"}`}
            onPress={() => void navigator.clipboard?.writeText(text)}
          >
            <Copy />
          </Button>
        </div>
      </div>
      {raw ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all">{text}</pre>
      ) : (
        <div className="max-h-96 overflow-auto font-mono">
          <Node value={value} depth={0} />
        </div>
      )}
    </section>
  )
}
