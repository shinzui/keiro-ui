import { usePgmqQueue } from "@keiro-ui/client-pgmq"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@keiro-ui/ui/components/tabs"
import { createFileRoute, Link } from "@tanstack/react-router"

import { CursorPager } from "@/components/CursorPager"
import { PageHeader } from "@/components/page-header"
import { BindingsTab } from "@/features/queues/bindings-tab"
import { DeadLetterRedrive } from "@/features/queues/dead-letter-redrive"
import { MessagesTable } from "@/features/queues/messages-table"
import { NotifyThrottle } from "@/features/queues/notify-throttle"
import {
  messageIdFrom,
  useArchivePage,
  useMessagesPage,
  useQueueMetrics,
} from "@/features/queues/queries"
import { QueueMetricsHeader } from "@/features/queues/queue-metrics-header"
import { type QueueTab, queueSearch } from "@/features/queues/search"
import { useCursorTrail } from "@/features/streams/useCursorTrail"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

export const Route = createFileRoute("/_shell/queues/$name/")({
  validateSearch: queueSearch,
  component: QueuePage,
})

function QueuePage() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queue = usePgmqQueue(name)
  const { metrics, feed } = useQueueMetrics(name)
  const tab = search.tab ?? "messages"
  const pager = useCursorTrail()
  useRecordVisit({ kind: "queue", label: name, href: hrefOf(links.queue(name)) })

  const notFound = queue.isError && queue.error.code === "queue_not_found"
  return (
    <>
      <PageHeader
        title={name}
        description={
          notFound ? (
            <span className="text-destructive">No queue with this name.</span>
          ) : (
            <span className="flex flex-wrap gap-2">
              <Link {...links.queues()} className="underline-offset-2 hover:underline">
                Queues
              </Link>
              {queue.data?.is_partitioned && <span>· partitioned</span>}
              {queue.data?.is_unlogged && <span>· unlogged</span>}
            </span>
          )
        }
      >
        {!notFound && (
          <>
            <QueueMetricsHeader
              metrics={metrics.data}
              partitioned={queue.data?.is_partitioned}
              source={feed.source}
              push={feed.push}
            />
            <NotifyThrottle queue={name} />
          </>
        )}
      </PageHeader>
      <div className="flex flex-col gap-3 p-6">
        {!notFound && <DeadLetterRedrive queue={name} length={metrics.data?.queue_length} />}
        {metrics.isError && !notFound && (
          <p className="text-sm text-destructive">{metrics.error.message}</p>
        )}
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            pager.reset()
            void navigate({
              search: (prev) => ({ ...prev, tab: key as QueueTab, from: undefined }),
            })
          }}
        >
          <TabsList aria-label="Queue views">
            <TabsTrigger id="messages">Messages</TabsTrigger>
            <TabsTrigger id="archive">Archive</TabsTrigger>
            <TabsTrigger id="bindings">Bindings</TabsTrigger>
          </TabsList>
          <TabsContent id="messages">
            <MessagesPanel queue={name} from={search.from} limit={search.limit} pager={pager} />
          </TabsContent>
          <TabsContent id="archive">
            <ArchivePanel queue={name} from={search.from} limit={search.limit} pager={pager} />
          </TabsContent>
          <TabsContent id="bindings">
            <BindingsTab queue={name} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

interface PanelProps {
  queue: string
  from?: string
  limit?: number
  pager: ReturnType<typeof useCursorTrail>
}

function MessagesPanel({ queue, from, limit, pager }: PanelProps) {
  const page = useMessagesPage(queue, { from: messageIdFrom(from), limit })
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        A peek: browsing never leases, so visibility and read counts are unchanged.
      </p>
      {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
      <MessagesTable queue={queue} messages={page.data?.items ?? []} isPending={page.isPending} />
      <CursorPager
        cursor={from}
        nextCursor={page.data?.nextCursor?.toString()}
        trail={pager.trail}
        onNavigate={pager.go}
        itemCount={page.data?.items.length}
      />
    </div>
  )
}

function ArchivePanel({ queue, from, limit, pager }: PanelProps) {
  const page = useArchivePage(queue, { from: messageIdFrom(from), limit })
  return (
    <div className="flex flex-col gap-3">
      {page.isError && <p className="text-sm text-destructive">{page.error.message}</p>}
      <MessagesTable
        queue={queue}
        messages={page.data?.items ?? []}
        isPending={page.isPending}
        archive
      />
      <CursorPager
        cursor={from}
        nextCursor={page.data?.nextCursor?.toString()}
        trail={pager.trail}
        onNavigate={pager.go}
        itemCount={page.data?.items.length}
      />
    </div>
  )
}
