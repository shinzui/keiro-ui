import { Input } from "@keiro-ui/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@keiro-ui/ui/components/select"
import { ToggleGroup, ToggleGroupItem } from "@keiro-ui/ui/components/toggle-group"
import { useState } from "react"

import { DEFAULT_LIMIT, STATUS_CLASSES, type WorkflowsSearch } from "../search"
import { TimeWindowFilter } from "./TimeWindowFilter"

/** Submits on Enter or blur; keyed by the URL value so navigation resets the draft. */
function NameInput({
  value,
  onCommit,
}: {
  value: string | undefined
  onCommit: (value: string | undefined) => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  const commit = () => {
    const next = draft.trim()
    if (next !== (value ?? "")) onCommit(next || undefined)
  }
  return (
    <Input
      aria-label="Workflow name"
      placeholder="Workflow name"
      className="w-48"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
    />
  )
}

type Change = Partial<Omit<WorkflowsSearch, "after" | "sheet">>

/** Status-class chips (none selected means all), name, time windows, ordering, page size. */
export function WorkflowFilters({
  search,
  onChange,
}: {
  search: WorkflowsSearch
  onChange: (change: Change) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          aria-label="Status class"
          selectionMode="multiple"
          size="sm"
          variant="outline"
          spacing={1}
          selectedKeys={search.status_class ?? []}
          onSelectionChange={(keys) => {
            const selected = STATUS_CLASSES.filter((c) => keys.has(c))
            onChange({ status_class: selected.length ? selected : undefined })
          }}
        >
          {STATUS_CLASSES.map((c) => (
            <ToggleGroupItem key={c} id={c}>
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <NameInput
          key={search.workflow_name ?? ""}
          value={search.workflow_name}
          onCommit={(workflow_name) => onChange({ workflow_name })}
        />
        <Select
          aria-label="Ordering"
          value={search.ordering ?? "key"}
          onChange={(value) =>
            onChange({ ordering: value === "created_desc" ? "created_desc" : undefined })
          }
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="key">By name and id</SelectItem>
            <SelectItem id="created_desc">Newest first</SelectItem>
          </SelectContent>
        </Select>
        <Select
          aria-label="Page size"
          value={String(search.limit ?? DEFAULT_LIMIT)}
          onChange={(value) => onChange({ limit: Number(value) })}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 250, 500].map((n) => (
              <SelectItem key={n} id={String(n)}>
                {`${n} / page`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TimeWindowFilter
        label="Created"
        since={search.created_since}
        before={search.created_before}
        onChange={(w) => onChange({ created_since: w.since, created_before: w.before })}
      />
      <TimeWindowFilter
        label="Updated"
        since={search.updated_since}
        before={search.updated_before}
        onChange={(w) => onChange({ updated_since: w.since, updated_before: w.before })}
      />
    </div>
  )
}
