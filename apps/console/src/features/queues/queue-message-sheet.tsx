import { SheetDescription, SheetHeader, SheetTitle } from "@keiro-ui/ui/components/sheet"
import { Skeleton } from "@keiro-ui/ui/components/skeleton"
import { Link } from "@tanstack/react-router"

import { links } from "@/lib/links"
import type { SheetProps } from "@/shell/right-sheet"

import { MessageDetail, parseMessageRef } from "./message-detail"
import { messageIdFrom, useQueueMessage } from "./queries"

/** Sheet kind `queue-message`, ref `<queue>/<msg_id>`: a peek at one message. */
export function QueueMessageSheet({ entityRef }: SheetProps) {
  const { queue, id } = parseMessageRef(entityRef)
  const msgId = messageIdFrom(id)
  const located = useQueueMessage(queue, msgId)
  return (
    <>
      <SheetHeader>
        <SheetTitle>Message {id}</SheetTitle>
        <SheetDescription>in {queue}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {msgId === undefined && (
          <p className="text-sm text-destructive">“{id}” is not a message id.</p>
        )}
        {msgId !== undefined && located.isPending && <Skeleton className="h-32" />}
        {located.isError && (
          <p className="text-sm text-destructive">
            {located.error.status === 404
              ? "No message with this id in the queue or its archive."
              : located.error.message}
          </p>
        )}
        {located.data && (
          <>
            <MessageDetail located={located.data} />
            <Link
              {...(located.data.where === "archive"
                ? links.archivedMessage(queue, id)
                : links.queueMessage(queue, id))}
              className="text-sm underline-offset-2 hover:underline"
            >
              Open full page
            </Link>
          </>
        )}
      </div>
    </>
  )
}
