import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"
import { createFileRoute, Link } from "@tanstack/react-router"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { useCategoriesPage } from "@/features/streams/queries"
import { categoriesSearch } from "@/features/streams/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { links } from "@/lib/links"

export const Route = createFileRoute("/_shell/categories/")({
  validateSearch: categoriesSearch,
  component: CategoriesPage,
})

function CategoriesPage() {
  const search = Route.useSearch()
  const page = useCategoriesPage(search)
  const pager = useCursorTrail()
  return (
    <>
      <PageHeader
        title="Categories"
        description="Stream categories, in the database's collation order."
      />
      <div className="flex flex-col gap-3 p-6">
        {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
        <Table aria-label="Categories">
          <TableHeader>
            <TableHead isRowHeader>Category</TableHead>
            <TableHead>Streams</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {page.isPending ? "Loading…" : "No categories."}
              </p>
            )}
          >
            {(page.data?.items ?? []).map((category) => (
              <TableRow key={category.name} id={category.name}>
                <TableCell>
                  <Link
                    {...links.category(category.name)}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {category.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    {...links.streams({ category: category.name })}
                    className="text-muted-foreground underline-offset-2 hover:underline"
                  >
                    list streams
                  </Link>
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
