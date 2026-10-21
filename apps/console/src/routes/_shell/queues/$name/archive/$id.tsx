import { createFileRoute } from "@tanstack/react-router"

import { QueueMessagePage } from "@/features/queues/queue-message-page"
import { shellSearchSchema } from "@/shell/search"

export const Route = createFileRoute("/_shell/queues/$name/archive/$id")({
  validateSearch: shellSearchSchema,
  component: Page,
})

function Page() {
  const { name, id } = Route.useParams()
  return <QueueMessagePage queue={name} id={id} archive />
}
