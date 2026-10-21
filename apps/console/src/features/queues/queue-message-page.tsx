import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { hrefOf, links } from "@/lib/links"
import { useRecordVisit } from "@/shell/recent"

import { MessageDetail } from "./message-detail"
import { messageIdFrom, useQueueMessage } from "./queries"

/** The full-width message page; `archive` reads the archive table only. */
export function QueueMessagePage({
  queue,
  id,
  archive = false,
}: {
  queue: string
  id: string
  archive?: boolean
}) {
  const msgId = messageIdFrom(id)
  const located = useQueueMessage(queue, msgId, archive ? "archive" : undefined)
  const target = archive ? links.archivedMessage(queue, id) : links.queueMessage(queue, id)
  useRecordVisit({ kind: "queue-message", label: `${queue}/${id}`, href: hrefOf(target) })
  return (
    <>
      <PageHeader
        title={`Message ${id}`}
        description={
          <span>
            {archive ? "archived from " : "in "}
            <Link
              {...links.queue(queue, archive ? { tab: "archive" } : undefined)}
              className="underline-offset-2 hover:underline"
            >
              {queue}
            </Link>
          </span>
        }
      />
      <div className="flex max-w-4xl flex-col gap-3 p-6">
        {msgId === undefined && (
          <p className="text-sm text-destructive">“{id}” is not a message id.</p>
        )}
        {msgId !== undefined && located.isPending && <Skeleton className="h-48" />}
        {located.isError && (
          <p className="text-sm text-destructive">
            {located.error.status === 404
              ? archive
                ? "No archived message with this id."
                : "No message with this id in the queue or its archive."
              : located.error.message}
          </p>
        )}
        {located.data && <MessageDetail located={located.data} />}
      </div>
    </>
  )
}
