import { Badge } from "@keiro-ui/ui/components/badge"
import { Button } from "@keiro-ui/ui/components/button"
import { Input } from "@keiro-ui/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { PositionBadge } from "@/components/PositionBadge"
import { Timestamp } from "@/components/timestamp"
import { useStreamsPage } from "@/features/streams/queries"
import { streamsSearch } from "@/features/streams/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/streams/")({
  validateSearch: streamsSearch,
  component: StreamsPage,
})

function StreamsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const page = useStreamsPage(search)
  const pager = useCursorTrail()
  const [category, setCategory] = useState(search.category ?? "")
  const [prefix, setPrefix] = useState(search.prefix ?? "")

  const apply = () => {
    pager.reset()
    void navigate({
      search: (prev) => ({
        ...prev,
        category: category || undefined,
        prefix: prefix || undefined,
        from: undefined,
      }),
    })
  }

  return (
    <>
      <PageHeader
        title="Streams"
        description="Every stream in the event store, in byte order of its name."
      >
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <label className="flex flex-col gap-1 text-xs">
            Category
            <Input
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Name prefix
            <Input
              aria-label="Name prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-56"
            />
          </label>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
      </PageHeader>
      <div className="flex flex-col gap-3 p-6">
        {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
        <Table aria-label="Streams">
          <TableHeader>
            <TableHead isRowHeader>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>State</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {page.isPending ? "Loading…" : "No streams."}
              </p>
            )}
          >
            {(page.data?.items ?? []).map((stream) => (
              <TableRow key={stream.name} id={stream.name}>
                <TableCell>
                  <Link
                    {...links.stream(stream.name)}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {stream.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    {...links.category(stream.category)}
                    className="underline-offset-2 hover:underline"
                  >
                    {stream.category}
                  </Link>
                </TableCell>
                <TableCell>
                  <PositionBadge value={stream.version} label="version" />
                </TableCell>
                <TableCell>
                  <Timestamp value={stream.created_at} />
                </TableCell>
                <TableCell>
                  {stream.deleted_at ? <Badge variant="destructive">deleted</Badge> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CursorPager
          cursor={search.from}
          nextCursor={page.data?.nextCursor}
          trail={pager.trail}
          onNavigate={pager.go}
          itemCount={page.data?.items.length}
        />
      </div>
    </>
  )
}
