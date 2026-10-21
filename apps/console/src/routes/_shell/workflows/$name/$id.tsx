import { isApiError } from "@keiro-ui/client-core"
import { isCursorMismatch } from "@keiro-ui/client-keiro"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@keiro-ui/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@keiro-ui/ui/components/toggle-group"
import { createFileRoute, Link } from "@tanstack/react-router"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Timestamp } from "@/components/timestamp"
import {
  AwakeablesTable,
  ChildrenTable,
  LoadMore,
  StepsTable,
} from "@/features/workflows/components/DetailTables"
import { WorkflowHeader } from "@/features/workflows/components/WorkflowHeader"
import { WorkflowTimeline } from "@/features/workflows/components/WorkflowTimeline"
import { journalEntryRef } from "@/features/workflows/journal"
import {
  useAwakeables,
  useChildren,
  useJournal,
  useSteps,
  useWorkflowHeader,
} from "@/features/workflows/queries"
import {
  type JournalLens,
  journalLenses,
  type WorkflowTab,
  workflowSearch,
} from "@/features/workflows/search"
import { hrefOf, links } from "@/lib/links"
import { useLiveness } from "@/shell/liveness"
import { useRecordVisit } from "@/shell/recent"
import { useRightSheet } from "@/shell/right-sheet"

export const Route = createFileRoute("/_shell/workflows/$name/$id")({
  validateSearch: workflowSearch,
  component: WorkflowPage,
})

function errorMessage(error: unknown): string {
  if (isCursorMismatch(error)) return "The page cursor belongs to another generation; reloading."
  return error instanceof Error ? error.message : String(error)
}

function WorkflowPage() {
  const { name, id } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { paused } = useLiveness()
  const header = useWorkflowHeader(name, id)
  const tab = search.tab ?? "journal"
  useRecordVisit({
    kind: "workflow",
    label: `${name} / ${id}`,
    href: hrefOf(links.workflow(name, id)),
  })

  const notFound = isApiError(header.error, "command_failed")
  return (
    <>
      <PageHeader
        title={id}
        description={
          <span className="flex flex-wrap items-center gap-x-2">
            <Link
              {...links.workflows({ workflow_name: name })}
              className="underline-offset-2 hover:underline"
            >
              {name}
            </Link>
            {header.data && (
              <span>
                · as of <Timestamp value={header.data.updated_at} /> ·{" "}
                {paused ? "paused" : "polling (no feed for one instance)"}
              </span>
            )}
          </span>
        }
      >
        {header.data && (
          <WorkflowHeader
            workflow={header.data}
            generation={search.generation}
            onGeneration={(generation) =>
              void navigate({ search: (prev) => ({ ...prev, generation }) })
            }
          />
        )}
        {header.isPending && <Skeleton className="h-12" />}
      </PageHeader>
      <div className="flex flex-col gap-3 p-6">
        {notFound ? (
          <EmptyState
            title="No such workflow"
            description={header.error?.message}
            action={
              <Link {...links.workflows()} className="text-sm underline-offset-2 hover:underline">
                Back to workflows
              </Link>
            }
          />
        ) : (
          <>
            {header.isError && <p className="text-sm text-destructive">{header.error.message}</p>}
            <Tabs
              selectedKey={tab}
              onSelectionChange={(key) =>
                void navigate({ search: (prev) => ({ ...prev, tab: key as WorkflowTab }) })
              }
            >
              <TabsList aria-label="Instance views">
                <TabsTrigger id="journal">Journal</TabsTrigger>
                <TabsTrigger id="steps">Steps</TabsTrigger>
                <TabsTrigger id="children">Children</TabsTrigger>
                <TabsTrigger id="awakeables">Awakeables</TabsTrigger>
              </TabsList>
              <TabsContent id="journal">
                <JournalTab
                  name={name}
                  id={id}
                  generation={search.generation}
                  lens={search.lens ?? "all"}
                  createdAt={header.data?.created_at}
                  onLens={(lens) =>
                    void navigate({
                      search: (prev) => ({ ...prev, lens: lens === "all" ? undefined : lens }),
                    })
                  }
                />
              </TabsContent>
              <TabsContent id="steps">
                <StepsTab name={name} id={id} generation={search.generation} />
              </TabsContent>
              <TabsContent id="children">
                <ChildrenTab name={name} id={id} />
              </TabsContent>
              <TabsContent id="awakeables">
                <AwakeablesTab name={name} id={id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  )
}

function JournalTab({
  name,
  id,
  generation,
  lens,
  createdAt,
  onLens,
}: {
  name: string
  id: string
  generation: number | undefined
  lens: JournalLens
  createdAt: string | undefined
  onLens: (lens: JournalLens) => void
}) {
  const journal = useJournal(name, id, generation)
  const { open } = useRightSheet()
  // Journal pages also carry the generation they read and when they were observed.
  const first = journal.data?.pages[0] as { generation: number; observed_at?: string } | undefined
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <ToggleGroup
          aria-label="Lens"
          selectionMode="single"
          size="sm"
          variant="outline"
          spacing={1}
          selectedKeys={[lens]}
          onSelectionChange={(keys) => {
            const [value] = [...keys]
            if (value) onLens(value as JournalLens)
          }}
        >
          {journalLenses.map((l) => (
            <ToggleGroupItem key={l} id={l}>
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {first && <span>generation {first.generation}</span>}
        {first?.observed_at && (
          <span>
            as of <Timestamp value={first.observed_at} />
          </span>
        )}
      </div>
      {journal.isError && <p className="text-sm text-destructive">{errorMessage(journal.error)}</p>}
      {journal.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <WorkflowTimeline
          entries={journal.items}
          createdAt={createdAt}
          lens={lens}
          onOpen={(entry) =>
            open({ kind: "journal-entry", ref: journalEntryRef(name, id, entry.event_id) })
          }
        />
      )}
      <LoadMore
        hasMore={journal.hasMore}
        isFetching={journal.isFetchingNextPage}
        onMore={() => void journal.fetchNextPage()}
      />
    </div>
  )
}

function StepsTab({ name, id, generation }: { name: string; id: string; generation?: number }) {
  const steps = useSteps(name, id, generation)
  return (
    <div className="flex flex-col gap-3">
      {steps.isError && <p className="text-sm text-destructive">{errorMessage(steps.error)}</p>}
      <StepsTable steps={steps.items} isPending={steps.isPending} />
      <LoadMore
        hasMore={steps.hasMore}
        isFetching={steps.isFetchingNextPage}
        onMore={() => void steps.fetchNextPage()}
      />
    </div>
  )
}

function ChildrenTab({ name, id }: { name: string; id: string }) {
  const children = useChildren(name, id)
  return (
    <div className="flex flex-col gap-3">
      {children.isError && <p className="text-sm text-destructive">{children.error.message}</p>}
      <ChildrenTable rows={children.items} isPending={children.isPending} />
      <LoadMore
        hasMore={children.hasMore}
        isFetching={children.isFetchingNextPage}
        onMore={() => void children.fetchNextPage()}
      />
    </div>
  )
}

function AwakeablesTab({ name, id }: { name: string; id: string }) {
  const awakeables = useAwakeables(name, id)
  return (
    <div className="flex flex-col gap-3">
      {awakeables.isError && <p className="text-sm text-destructive">{awakeables.error.message}</p>}
      <AwakeablesTable awakeables={awakeables.items} isPending={awakeables.isPending} />
      <LoadMore
        hasMore={awakeables.hasMore}
        isFetching={awakeables.isFetchingNextPage}
        onMore={() => void awakeables.fetchNextPage()}
      />
    </div>
  )
}
