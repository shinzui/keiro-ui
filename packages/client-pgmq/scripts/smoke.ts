// Prints the service descriptor and the first page of the first queue (bun run --filter @keiro-ui/client-pgmq smoke).
import { createPgmqClient } from "../src/client"

const pgmq = createPgmqClient({ baseUrl: process.env.PGMQ_URL ?? "http://127.0.0.1:9095" })
console.log(await pgmq.service())
const [first] = await pgmq.queues.list()
if (first) {
  const page = await pgmq.messages.page(first.queue_name, { limit: 10 })
  for (const message of page.items)
    console.log(`${first.queue_name} ${String(message.msg_id)} read_ct=${String(message.read_ct)}`)
}
