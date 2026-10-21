import { Button } from "@keiro-ui/ui/components/button"
import { Input } from "@keiro-ui/ui/components/input"
import { useState } from "react"

const QUICK = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "1 h", seconds: 60 * 60 },
  { label: "24 h", seconds: 24 * 60 * 60 },
] as const

function IsoInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string | undefined
  onCommit: (value: string | undefined) => void
}) {
  // Keyed by `value` at the call site, so a URL change remounts it with a fresh draft.
  const [draft, setDraft] = useState(value ?? "")
  const commit = () => {
    const text = draft.trim()
    if (text === (value ?? "")) return
    if (text === "") return onCommit(undefined)
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) onCommit(parsed.toISOString().replace(/\.000Z$/, "Z"))
  }
  return (
    <Input
      aria-label={label}
      placeholder="UTC, e.g. 2026-10-21T09:00Z"
      className="w-52 font-mono text-xs placeholder:font-sans"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
    />
  )
}

/** A since/before pair of UTC instants with quick "last N" ranges. */
export function TimeWindowFilter({
  label,
  since,
  before,
  onChange,
}: {
  label: string
  since: string | undefined
  before: string | undefined
  onChange: (window: { since?: string; before?: string }) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2 text-xs">
      <legend className="sr-only">{label}</legend>
      <span className="w-14 text-muted-foreground">{label}</span>
      <IsoInput
        key={`since:${since ?? ""}`}
        label={`${label} since`}
        value={since}
        onCommit={(v) => onChange({ since: v, before })}
      />
      <span className="text-muted-foreground">to</span>
      <IsoInput
        key={`before:${before ?? ""}`}
        label={`${label} before`}
        value={before}
        onCommit={(v) => onChange({ since, before: v })}
      />
      {QUICK.map((range) => (
        <Button
          key={range.label}
          size="xs"
          variant="ghost"
          onPress={() =>
            onChange({
              since: new Date(Date.now() - range.seconds * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, "Z"),
              before: undefined,
            })
          }
        >
          {range.label}
        </Button>
      ))}
      {(since || before) && (
        <Button size="xs" variant="ghost" onPress={() => onChange({})}>
          Clear
        </Button>
      )}
    </fieldset>
  )
}
