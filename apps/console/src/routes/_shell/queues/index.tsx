import { Input } from "@keiro-ui/ui/components/input"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"

import { PageHeader } from "@/components/page-header"
import { useQueueInventory } from "@/features/queues/queries"
import { QueueTable } from "@/features/queues/queue-table"
import { queuesSearch } from "@/features/queues/search"
import { DEFAULT_SORT, defaultDirection, filterQueues, sortQueues } from "@/features/queues/sort"

export const Route = createFileRoute("/_shell/queues/")({
  validateSearch: queuesSearch,
  component: QueuesPage,
})

function QueuesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const inventory = useQueueInventory()
  const sort = search.sort ?? DEFAULT_SORT
  const dir = search.dir ?? defaultDirection(sort)
  const rows = useMemo(
    () => sortQueues(filterQueues(inventory.rows, search.q), sort, dir),
    [inventory.rows, search.q, sort, dir],
  )
  return (
    <>
      <PageHeader
        title="Queues"
        description="Oldest message first: a queue's latency is its headline, its counts come after."
        actions={
          <Input
            aria-label="Filter queues"
            placeholder="Filter by name"
            className="w-56"
            value={search.q ?? ""}
            onChange={(event) => {
              const q = event.target.value
              void navigate({
                search: (prev) => ({ ...prev, q: q === "" ? undefined : q }),
                replace: true,
              })
            }}
          />
        }
      />
      <div className="flex flex-col gap-3 p-6">
        {inventory.error && <p className="text-sm text-destructive">{inventory.error.message}</p>}
        <QueueTable
          rows={rows}
          isPending={inventory.isPending}
          sort={sort}
          direction={dir}
          onSortChange={(nextSort, nextDir) =>
            void navigate({ search: (prev) => ({ ...prev, sort: nextSort, dir: nextDir }) })
          }
        />
      </div>
    </>
  )
}
